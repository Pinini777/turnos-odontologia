import { randomUUID } from 'node:crypto';
import type { Box, Paciente, Prestacion, Profesional, Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import { conflictoPaciente, conflictos, enGrilla } from '../../turnos-alta/dominio/agenda';
import { armarEmailDeAlta } from '../../turnos-alta/aplicacion/email';
import { esReprogramable, intervaloNuevo, sinElPropio } from '../dominio/reprogramacion';

/** Lo mínimo que necesita el caso de uso; C-11 lo llama con sus propias deps (design D8). */
export type DepsReprogramacion = Pick<Deps, 'repos' | 'clock' | 'conLockDeAgenda' | 'disponibilidad' | 'notificador'>;

export interface CambiosReprogramacion {
  inicio: Date;
  /** Si se omite, se conserva el actual. */
  profesionalId?: string;
  /** Si se omite, se conserva el actual. */
  boxId?: string;
}

export interface ReprogramarTurno {
  turnoId: string;
  cambios: CambiosReprogramacion;
  /** usuarioId de la sesión, o "paciente" cuando llama C-11. */
  actor: string;
}

/** Lo que se audita del turno antes y después (design D5). */
type Foto = Pick<Turno, 'estado' | 'inicio' | 'fin' | 'profesionalId' | 'boxId'>;

const foto = ({ estado, inicio, fin, profesionalId, boxId }: Turno): Foto => ({ estado, inicio, fin, profesionalId, boxId });

interface DatosDelEmail {
  paciente: Paciente;
  profesional: Profesional;
  box: Box;
  prestacion: Prestacion;
}

/**
 * Mueve un turno a otro intervalo, profesional o box (US-012, F-02) con las validaciones del alta,
 * excluyendo al propio turno (RN-TU-04). Un turno reprogramado queda siempre `reservado` (design D4).
 */
export async function reprogramarTurno(
  { turnoId, cambios, actor }: ReprogramarTurno,
  deps: DepsReprogramacion,
): Promise<Turno> {
  const { turno, datos } = await deps.conLockDeAgenda(() => validarYGuardar(turnoId, cambios, actor, deps));
  try {
    await deps.notificador.enviar(armarEmailDeAlta(turno, datos));
  } catch {
    // La falla de notificación no revierte la reprogramación (RN-NO-02).
  }
  return turno;
}

/** Todo dentro del lock de agenda: el orden de los rechazos es el de design D3. */
async function validarYGuardar(
  turnoId: string,
  cambios: CambiosReprogramacion,
  actor: string,
  deps: DepsReprogramacion,
): Promise<{ turno: Turno; datos: DatosDelEmail }> {
  const original = await deps.repos.turnos.buscarPorId(turnoId);
  if (!original) throw new ReglaDeNegocioError('NO_ENCONTRADO');
  if (!esReprogramable(original.estado)) throw new ReglaDeNegocioError('TRANSICION_INVALIDA');
  if (!enGrilla(cambios.inicio)) throw new ReglaDeNegocioError('FUERA_DE_GRILLA');
  const ahora = deps.clock.ahora();
  if (cambios.inicio < ahora) throw new ReglaDeNegocioError('EN_EL_PASADO');

  const profesionalId = cambios.profesionalId ?? original.profesionalId;
  const boxId = cambios.boxId ?? original.boxId;
  const [profesional, box, prestacion, paciente] = await Promise.all([
    deps.repos.profesionales.buscarPorId(profesionalId),
    deps.repos.boxes.buscarPorId(boxId),
    deps.repos.prestaciones.buscarPorId(original.prestacionId),
    deps.repos.pacientes.buscarPorId(original.pacienteId),
  ]);
  if (!profesional || !box || !prestacion || !paciente) throw new ReglaDeNegocioError('NO_ENCONTRADO');
  // La prestación no cambia: no se exige que siga activa (design D3).
  if (!profesional.activo || !box.activo) throw new ReglaDeNegocioError('RECURSO_INACTIVO');

  const turno: Turno = {
    ...original,
    ...intervaloNuevo(cambios.inicio, prestacion.duracionMin),
    profesionalId,
    boxId,
    estado: 'reservado',
  };

  const codigo = await deps.disponibilidad.verificar({ profesionalId, boxId, inicio: turno.inicio, fin: turno.fin });
  if (codigo) throw new ReglaDeNegocioError(codigo);
  const otros = await deps.repos.turnos.listar(
    (t) => t.profesionalId === profesionalId || t.boxId === boxId || t.pacienteId === original.pacienteId,
  );
  const sinPropio = sinElPropio(otros, turnoId);
  const choque = conflictos(sinPropio, turno);
  if (choque.profesional) throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');
  if (choque.box) throw new ReglaDeNegocioError('SOLAPAMIENTO_BOX');
  if (conflictoPaciente(sinPropio, turno)) throw new ReglaDeNegocioError('SOLAPAMIENTO_PACIENTE');

  // Auditar ANTES de guardar (design D5): el turno solo cambia si su registro ya existe.
  await auditar(turnoId, actor, ahora, { antes: foto(original), despues: foto(turno) }, deps);
  try {
    await deps.repos.turnos.guardar(turno);
  } catch (error) {
    await registrarReversion(turnoId, actor, ahora, { antes: foto(turno), despues: foto(original) }, deps);
    throw error;
  }
  return { turno, datos: { paciente, profesional, box, prestacion } };
}

function auditar(
  turnoId: string,
  actor: string,
  fecha: Date,
  detalle: Record<string, unknown>,
  deps: DepsReprogramacion,
): Promise<void> {
  return deps.repos.auditoria.agregar({ id: randomUUID(), turnoId, accion: 'reprogramado', actor, fecha, detalle });
}

/**
 * Guardar falló después de auditar: la auditoría es append-only, así que se agrega la reversión.
 * Si esto también falla, queda auditado un intento no aplicado (registra de más, nunca de menos).
 */
async function registrarReversion(
  turnoId: string,
  actor: string,
  fecha: Date,
  detalle: { antes: Foto; despues: Foto },
  deps: DepsReprogramacion,
): Promise<void> {
  try {
    await auditar(turnoId, actor, fecha, { ...detalle, revertido: true }, deps);
  } catch {
    // Se ignora a propósito: el error que importa es el de guardar, que relanza validarYGuardar.
  }
}
