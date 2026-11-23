import type { CaraPiezaApi, EstadoDePiezaApi, EstadoPiezaApi } from './apiProfesional';

export const CUADRANTES_PERMANENTES = {
  q1: [18, 17, 16, 15, 14, 13, 12, 11] as const,
  q2: [21, 22, 23, 24, 25, 26, 27, 28] as const,
  q4: [48, 47, 46, 45, 44, 43, 42, 41] as const,
  q3: [31, 32, 33, 34, 35, 36, 37, 38] as const,
} as const;

export const CUADRANTES_TEMPORARIOS = {
  q5: [55, 54, 53, 52, 51] as const,
  q6: [61, 62, 63, 64, 65] as const,
  q8: [85, 84, 83, 82, 81] as const,
  q7: [71, 72, 73, 74, 75] as const,
} as const;

export const ESTADOS_SOLO_PIEZA_COMPLETA: ReadonlySet<EstadoDePiezaApi> = new Set<EstadoDePiezaApi>([
  'ausente',
  'corona',
  'endodoncia',
  'a_extraer',
]);

export const ETIQUETA_ESTADO_PIEZA: Readonly<Record<EstadoDePiezaApi, string>> = {
  sano: 'Sano',
  caries: 'Caries',
  obturado: 'Obturado',
  corona: 'Corona',
  endodoncia: 'Endodoncia',
  ausente: 'Ausente',
  a_extraer: 'A extraer',
};

export const ETIQUETA_CARA_PIEZA: Readonly<Record<CaraPiezaApi, string>> = {
  oclusal: 'Oclusal',
  mesial: 'Mesial',
  distal: 'Distal',
  vestibular: 'Vestibular',
  lingual: 'Lingual / Palatina',
};

const NOMBRES_POSICION: Readonly<Record<number, string>> = {
  1: 'Incisivo central',
  2: 'Incisivo lateral',
  3: 'Canino',
  4: 'Primer premolar',
  5: 'Segundo premolar',
  6: 'Primer molar',
  7: 'Segundo molar',
  8: 'Tercer molar',
};

const NOMBRES_CUADRANTE: Readonly<Record<number, string>> = {
  1: 'superior derecho',
  2: 'superior izquierdo',
  3: 'inferior izquierdo',
  4: 'inferior derecho',
  5: 'superior derecho (temporario)',
  6: 'superior izquierdo (temporario)',
  7: 'inferior izquierdo (temporario)',
  8: 'inferior derecho (temporario)',
};

export interface MapaCarasPieza {
  readonly top: CaraPiezaApi;
  readonly bottom: CaraPiezaApi;
  readonly left: CaraPiezaApi;
  readonly right: CaraPiezaApi;
  readonly center: CaraPiezaApi;
}

export interface EstadoVisualPieza {
  readonly completa?: EstadoDePiezaApi;
  readonly caras: Readonly<Partial<Record<CaraPiezaApi, EstadoDePiezaApi>>>;
}

export function esEstadoSoloPiezaCompleta(estado: EstadoDePiezaApi): boolean {
  return ESTADOS_SOLO_PIEZA_COMPLETA.has(estado);
}

export function mapearCarasFdi(pieza: number): MapaCarasPieza {
  const cuadrante = Math.floor(pieza / 10);
  const esSuperior = cuadrante === 1 || cuadrante === 2 || cuadrante === 5 || cuadrante === 6;
  const esDerechaPaciente = cuadrante === 1 || cuadrante === 4 || cuadrante === 5 || cuadrante === 8;

  return {
    top: esSuperior ? 'vestibular' : 'lingual',
    bottom: esSuperior ? 'lingual' : 'vestibular',
    left: esDerechaPaciente ? 'distal' : 'mesial',
    right: esDerechaPaciente ? 'mesial' : 'distal',
    center: 'oclusal',
  };
}

export function nombreAnatomicoFdi(pieza: number): string {
  const cuadrante = Math.floor(pieza / 10);
  const posicion = pieza % 10;
  const pos = NOMBRES_POSICION[posicion] ?? 'Pieza dental';
  const cuad = NOMBRES_CUADRANTE[cuadrante] ?? '';
  return cuad ? `${pos} ${cuad}` : pos;
}

export function agruparEstadosPorPieza(
  piezas: readonly EstadoPiezaApi[],
): Map<number, EstadoVisualPieza> {
  const mapa = new Map<
    number,
    { completa?: EstadoDePiezaApi; caras: Partial<Record<CaraPiezaApi, EstadoDePiezaApi>> }
  >();

  for (const registro of piezas) {
    const actual = mapa.get(registro.pieza) ?? { caras: {} };
    if (registro.cara === undefined) {
      actual.completa = registro.estado;
    } else {
      actual.caras[registro.cara] = registro.estado;
    }
    mapa.set(registro.pieza, actual);
  }

  return mapa;
}
