import type { EstadoTurno, Turno } from '../../../shared/entidades';

/**
 * Reglas puras de la reprogramación (C-10). Sin Fastify, sin repositorios y sin leer la hora:
 * todo llega por parámetro (DD-08).
 */

/** Solo se mueven turnos vivos (design D4). Un confirmado reprogramado vuelve a `reservado`. */
const REPROGRAMABLES: readonly EstadoTurno[] = ['reservado', 'confirmado'];

export function esReprogramable(estado: EstadoTurno): boolean {
  return REPROGRAMABLES.includes(estado);
}

/** `fin = inicio + duración de la prestación` (RN-AG-06). */
export function intervaloNuevo(inicio: Date, duracionMin: number): Pick<Turno, 'inicio' | 'fin'> {
  return { inicio, fin: new Date(inicio.getTime() + duracionMin * 60_000) };
}

/** El turno que se reprograma no cuenta como ocupado al buscar solapamientos (RN-TU-04). */
export function sinElPropio(turnos: readonly Turno[], turnoId: string): Turno[] {
  return turnos.filter((turno) => turno.id !== turnoId);
}
