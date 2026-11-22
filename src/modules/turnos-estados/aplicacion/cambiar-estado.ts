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

/** Buscar → validar → guardar → auditar, todo dentro del lock de agenda (D5). */
function transicionar(turnoId: string, hacia: EstadoTurno, actor: string, deps: DepsEstados): Promise<Turno> {
  return deps.conLockDeAgenda(async () => {
    const turno = await deps.repos.turnos.buscarPorId(turnoId);
    if (!turno) throw new ReglaDeNegocioError('NO_ENCONTRADO');
    const ahora = deps.clock.ahora();
    validarTransicion(turno.estado, hacia, { ahora, inicio: turno.inicio });
    const actualizado: Turno = { ...turno, estado: hacia };
    // Después de guardar: si guardar falla, no queda auditado algo que no pasó (D6).
    await deps.repos.turnos.guardar(actualizado);
    try {
      await deps.repos.auditoria.agregar({
        id: randomUUID(),
        turnoId,
        accion: hacia === 'cancelado' ? 'cancelado' : 'estado_cambiado',
        actor,
        fecha: ahora,
        detalle: { antes: { estado: turno.estado }, despues: { estado: hacia } },
      });
    } catch (error) {
      // Compensación (D6): sin auditoría no hay cambio. Seguimos dentro del lock,
      // así que nadie llegó a ver el estado intermedio.
      await deps.repos.turnos.guardar(turno);
      throw error;
    }
    return actualizado;
  });
}
