import { randomUUID } from 'node:crypto';
import type { Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import type { UsuarioSesion } from '../../../shared/sesion';
import { conflictos, enGrilla } from '../dominio/agenda';
import { armarEmailDeAlta } from './email';

export interface SolicitudTurno {
  profesionalId: string;
  boxId: string;
  prestacionId: string;
  pacienteId: string;
  inicio: string;
}

export async function crearTurno(deps: Deps, sesion: UsuarioSesion, solicitud: SolicitudTurno): Promise<Turno> {
  const inicio = new Date(solicitud.inicio);
  if (!enGrilla(inicio)) throw new ReglaDeNegocioError('FUERA_DE_GRILLA');
  if (inicio < deps.clock.ahora()) throw new ReglaDeNegocioError('EN_EL_PASADO');
  const [profesional, box, prestacion, paciente] = await Promise.all([
    deps.repos.profesionales.buscarPorId(solicitud.profesionalId),
    deps.repos.boxes.buscarPorId(solicitud.boxId),
    deps.repos.prestaciones.buscarPorId(solicitud.prestacionId),
    deps.repos.pacientes.buscarPorId(solicitud.pacienteId),
  ]);
  if (!profesional || !box || !prestacion || !paciente) throw new ReglaDeNegocioError('NO_ENCONTRADO');
  if (!profesional.activo || !box.activo || !prestacion.activa) throw new ReglaDeNegocioError('RECURSO_INACTIVO');
  const turno: Turno = {
    id: randomUUID(),
    profesionalId: solicitud.profesionalId,
    boxId: solicitud.boxId,
    prestacionId: solicitud.prestacionId,
    pacienteId: solicitud.pacienteId,
    inicio,
    fin: new Date(inicio.getTime() + prestacion.duracionMin * 60_000),
    estado: 'reservado',
    origen: sesion.rol === 'profesional' ? 'profesional' : 'recepcion',
    precioAlReservar: prestacion.precio,
    creadoPor: sesion.usuarioId,
    creadoEn: deps.clock.ahora(),
  };
  await deps.conLockDeAgenda(async () => {
    const codigo = await deps.disponibilidad.verificar({
      profesionalId: turno.profesionalId, boxId: turno.boxId, inicio: turno.inicio, fin: turno.fin,
    });
    if (codigo) throw new ReglaDeNegocioError(codigo);
    const turnos = await deps.repos.turnos.listar((existente) =>
      existente.profesionalId === turno.profesionalId || existente.boxId === turno.boxId,
    );
    const choque = conflictos(turnos, turno);
    if (choque.profesional) throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');
    if (choque.box) throw new ReglaDeNegocioError('SOLAPAMIENTO_BOX');
    await deps.repos.turnos.guardar(turno);
    await deps.repos.auditoria.agregar({
      id: randomUUID(), turnoId: turno.id, accion: 'creado', actor: sesion.usuarioId,
      fecha: deps.clock.ahora(), detalle: { despues: turno },
    });
  });
  try {
    await deps.notificador.enviar(armarEmailDeAlta(turno, { paciente, profesional, box, prestacion }));
  } catch {
    // La falla de notificación no revierte el alta (RN-NO-02).
  }
  return turno;
}
