import type { AuditoriaTurno, Turno } from '../../../shared/entidades';

export interface RangoAgenda {
  desde: Date;
  hasta: Date;
}

export interface FiltroRecursos {
  profesionalId?: string;
  boxId?: string;
}

/** Turnos cuyo `inicio` cae en el intervalo semiabierto [desde, hasta) (D1). */
export function turnosEnRango<T extends Pick<Turno, 'inicio'>>(turnos: readonly T[], { desde, hasta }: RangoAgenda): T[] {
  return turnos.filter((t) => t.inicio.getTime() >= desde.getTime() && t.inicio.getTime() < hasta.getTime());
}

/** Filtros opcionales combinados con AND; un id desconocido simplemente no coincide (D2). */
export function filtrarPorRecursos<T extends Pick<Turno, 'profesionalId' | 'boxId'>>(
  turnos: readonly T[],
  { profesionalId, boxId }: FiltroRecursos,
): T[] {
  return turnos.filter(
    (t) => (profesionalId === undefined || t.profesionalId === profesionalId) && (boxId === undefined || t.boxId === boxId),
  );
}

/** Copia ordenada por una fecha; los empates conservan el orden de entrada por índice (D3). */
function ordenarPor<T>(xs: readonly T[], fecha: (x: T) => Date): T[] {
  return xs
    .map((x, i) => ({ x, i }))
    .sort((a, b) => fecha(a.x).getTime() - fecha(b.x).getTime() || a.i - b.i)
    .map(({ x }) => x);
}

export const ordenarPorInicio = <T extends Pick<Turno, 'inicio'>>(turnos: readonly T[]): T[] =>
  ordenarPor(turnos, (t) => t.inicio);

export const ordenarPorFecha = <T extends Pick<AuditoriaTurno, 'fecha'>>(registros: readonly T[]): T[] =>
  ordenarPor(registros, (r) => r.fecha);
