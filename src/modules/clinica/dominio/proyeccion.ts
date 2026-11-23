import type { CaraPieza, EstadoPieza } from '../../../shared/entidades';

/** Ordena cronológicamente ascendente preservando el orden de inserción ante empates. */
export function ordenarCronologicamente<T extends { fecha: Date }>(registros: readonly T[]): T[] {
  return [...registros].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

function compararCaras(a: CaraPieza | undefined, b: CaraPieza | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : 1;
}

/**
 * Proyecta el estado vigente no contradictorio a partir del historial append-only:
 * - Una pieza completa `(P, undefined)` reemplaza cualquier estado previo de `P` (caras o completa).
 * - Una cara específica `(P, cara)` reemplaza una entrada previa `(P, undefined)` y coexiste con otras caras de `P`.
 */
export function proyectarEstadoActual(historial: readonly EstadoPieza[]): EstadoPieza[] {
  const porPieza = new Map<number, Map<CaraPieza | null, EstadoPieza>>();

  for (const registro of ordenarCronologicamente(historial)) {
    if (registro.cara === undefined) {
      porPieza.set(registro.pieza, new Map([[null, registro]]));
      continue;
    }
    const caras = porPieza.get(registro.pieza) ?? new Map<CaraPieza | null, EstadoPieza>();
    caras.delete(null);
    caras.set(registro.cara, registro);
    porPieza.set(registro.pieza, caras);
  }

  const vigentes: EstadoPieza[] = [];
  for (const caras of porPieza.values()) {
    for (const estado of caras.values()) vigentes.push(estado);
  }

  return vigentes.sort((a, b) => a.pieza - b.pieza || compararCaras(a.cara, b.cara));
}
