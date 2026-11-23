import { randomUUID } from 'node:crypto';
import type { EstadoTurno, Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import { validarTransicion } from '../dominio/estados';

/** Lo mínimo que necesitan los casos de uso; C-11 los llama con sus propias deps. */
export type DepsEstados = Pick<Deps, 'repos' | 'clock' | 'conLockDeAgenda'>;

export interface CancelarTurno {
  turnoId: string;
  /** usuarioId de la sesión, o "paciente" cuando llama C-11. */
  actor: string;
}

/** "Eliminar" un turno: pasa a cancelado sin borrado físico (RN-TU-03). Contrato para C-11. */
export function cancelarTurno({ turnoId, actor }: CancelarTurno, deps: DepsEstados): Promise<Turno> {
  return transicionar(turnoId, 'cancelado', actor, deps);
}

/** Estados que se marcan por `POST /estado`; cancelar tiene su propia ruta. */
export const ESTADOS_MANUALES = ['confirmado', 'atendido', 'ausente'] as const;
export type EstadoManual = (typeof ESTADOS_MANUALES)[number];

export interface CambiarEstado {
  turnoId: string;
  estado: EstadoManual;
  actor: string;
}

/** Confirmar, atender o marcar ausente un turno (US-013). */
export function cambiarEstado({ turnoId, estado, actor }: CambiarEstado, deps: DepsEstados): Promise<Turno> {
  return transicionar(turnoId, estado, actor, deps);
}

/**
 * Buscar → validar → auditar → guardar, todo dentro del lock de agenda (D5).
 * Se audita ANTES de guardar (D6): el turno solo cambia si su registro ya existe,
 * así que ninguna combinación de fallas deja un cambio sin auditoría.
 */
function transicionar(turnoId: string, hacia: EstadoTurno, actor: string, deps: DepsEstados): Promise<Turno> {
  return deps.conLockDeAgenda(async () => {
    const turno = await deps.repos.turnos.buscarPorId(turnoId);
    if (!turno) throw new ReglaDeNegocioError('NO_ENCONTRADO');
    const ahora = deps.clock.ahora();
    validarTransicion(turno.estado, hacia, { ahora, inicio: turno.inicio });
    const accion = hacia === 'cancelado' ? 'cancelado' : 'estado_cambiado';
    // Si falla, el turno ni se tocó: el error sube y no queda nada a medias.
    await deps.repos.auditoria.agregar({
      id: randomUUID(),
      turnoId,
      accion,
      actor,
      fecha: ahora,
      detalle: { antes: { estado: turno.estado }, despues: { estado: hacia } },
    });
    const actualizado: Turno = { ...turno, estado: hacia };
    try {
      await deps.repos.turnos.guardar(actualizado);
    } catch (error) {
      await registrarReversion(turno, hacia, actor, ahora, deps);
      throw error;
    }
    return actualizado;
  });
}

/**
 * Guardar falló después de auditar: la auditoría es append-only, así que en vez de borrar
 * el intento se agrega su reversión. Si esto también falla, queda auditado un intento que
 * no se aplicó (registra de más, nunca de menos) y se propaga el error original de guardar.
 */
async function registrarReversion(turno: Turno, hacia: EstadoTurno, actor: string, ahora: Date, deps: DepsEstados) {
  try {
    await deps.repos.auditoria.agregar({
      id: randomUUID(),
      turnoId: turno.id,
      accion: 'estado_cambiado',
      actor,
      fecha: ahora,
      detalle: { antes: { estado: hacia }, despues: { estado: turno.estado }, revertido: true },
    });
  } catch {
    // Se ignora a propósito: el error que importa es el de guardar, que relanza transicionar.
  }
}
