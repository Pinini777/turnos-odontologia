import type { CaraPieza, EstadoDePieza } from '../../../shared/entidades';

export const ESTADOS_DE_PIEZA = [
  'sano',
  'caries',
  'obturado',
  'ausente',
  'corona',
  'endodoncia',
  'a_extraer',
] as const satisfies readonly EstadoDePieza[];

export const ESTADOS_SOLO_PIEZA_COMPLETA = [
  'ausente',
  'corona',
  'endodoncia',
  'a_extraer',
] as const satisfies readonly EstadoDePieza[];

export const CARAS_PIEZA = [
  'oclusal',
  'mesial',
  'distal',
  'vestibular',
  'lingual',
] as const satisfies readonly CaraPieza[];

const SET_ESTADOS_SOLO_PIEZA_COMPLETA: ReadonlySet<EstadoDePieza> = new Set(
  ESTADOS_SOLO_PIEZA_COMPLETA,
);

/** Valida exactamente las 52 piezas FDI: 32 permanentes (11–48) y 20 temporarias (51–85). */
export function esPiezaFdiValida(pieza: number): boolean {
  if (!Number.isInteger(pieza) || pieza <= 0) return false;
  const cuadrante = Math.floor(pieza / 10);
  const posicion = pieza % 10;
  if (cuadrante >= 1 && cuadrante <= 4) return posicion >= 1 && posicion <= 8;
  if (cuadrante >= 5 && cuadrante <= 8) return posicion >= 1 && posicion <= 5;
  return false;
}

/** Estados que aplican únicamente a la pieza completa (no admiten `cara`). */
export function esEstadoSoloPiezaCompleta(estado: EstadoDePieza): boolean {
  return SET_ESTADOS_SOLO_PIEZA_COMPLETA.has(estado);
}

export function clavePiezaCara(pieza: number, cara?: CaraPieza): string {
  return `${pieza}:${cara ?? '*'}`;
}

export function tieneClavesDuplicadas(
  items: ReadonlyArray<{ pieza: number; cara?: CaraPieza }>,
): boolean {
  const vistas = new Set<string>();
  for (const item of items) {
    const clave = clavePiezaCara(item.pieza, item.cara);
    if (vistas.has(clave)) return true;
    vistas.add(clave);
  }
  return false;
}

export function tieneMezclaPiezaCompletaYCara(
  items: ReadonlyArray<{ pieza: number; cara?: CaraPieza }>,
): boolean {
  const conPiezaCompleta = new Set<number>();
  const conCara = new Set<number>();
  for (const item of items) {
    if (item.cara === undefined) {
      if (conCara.has(item.pieza)) return true;
      conPiezaCompleta.add(item.pieza);
    } else {
      if (conPiezaCompleta.has(item.pieza)) return true;
      conCara.add(item.pieza);
    }
  }
  return false;
}
