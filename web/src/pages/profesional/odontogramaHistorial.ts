import type {
  CaraPiezaApi,
  EstadoDePiezaApi,
  EstadoPiezaApi,
  ItemActualizacionPiezaPayload,
} from './apiProfesional';
import { esEstadoSoloPiezaCompleta } from './odontogramaFdi';

export type TipoDenticion = 'permanente' | 'temporaria' | 'mixta';

export const ESTADOS_CLINICOS_ORDEN: readonly EstadoDePiezaApi[] = [
  'sano',
  'caries',
  'obturado',
  'corona',
  'endodoncia',
  'ausente',
  'a_extraer',
];

export const CARAS_FDI_ORDEN: readonly CaraPiezaApi[] = [
  'oclusal',
  'mesial',
  'distal',
  'vestibular',
  'lingual',
];

export const SIMBOLO_ESTADO_PIEZA: Readonly<Record<EstadoDePiezaApi, string>> = {
  sano: '○',
  caries: '●',
  obturado: '■',
  corona: '◇',
  endodoncia: 'Y',
  ausente: '┄',
  a_extraer: '×',
};

export const TODAS_LAS_PIEZAS_FDI: readonly number[] = Array.from({ length: 8 }, (_, q) =>
  Array.from({ length: q < 4 ? 8 : 5 }, (_, p) => 10 * (q + 1) + p + 1),
).flat();

export function esPiezaSuperior(pieza: number): boolean {
  const c = Math.floor(pieza / 10);
  return c === 1 || c === 2 || c === 5 || c === 6;
}

export function esPiezaIzquierda(pieza: number): boolean {
  const c = Math.floor(pieza / 10);
  return c === 2 || c === 3 || c === 6 || c === 7;
}

export function esPiezaTemporaria(pieza: number): boolean {
  return pieza >= 50;
}

export function esPiezaVisibleEnDenticion(pieza: number, denticion: TipoDenticion): boolean {
  if (denticion === 'mixta') return true;
  return esPiezaTemporaria(pieza) === (denticion === 'temporaria');
}

export function etiquetaCaraAnatomica(pieza: number, cara: CaraPiezaApi): string {
  if (cara === 'lingual') {
    return esPiezaSuperior(pieza) ? 'Palatina' : 'Lingual';
  }
  const mapa: Readonly<Record<Exclude<CaraPiezaApi, 'lingual'>, string>> = {
    oclusal: 'Oclusal',
    mesial: 'Mesial',
    distal: 'Distal',
    vestibular: 'Vestibular',
  };
  return mapa[cara];
}

function compararPorFecha(a: EstadoPiezaApi, b: EstadoPiezaApi): number {
  const ta = Date.parse(a.fecha);
  const tb = Date.parse(b.fecha);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
    return ta - tb;
  }
  return a.fecha.localeCompare(b.fecha);
}

/**
 * Proyecta una secuencia cronológica de registros de odontograma aplicando las reglas C-09:
 * un registro de pieza completa reemplaza caras previas de esa pieza y un registro de cara
 * reemplaza una marca previa de pieza completa en esa misma pieza.
 */
export function proyectarEstadoActual(
  registros: readonly EstadoPiezaApi[],
): EstadoPiezaApi[] {
  const ordenados = registros
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      const cmp = compararPorFecha(a.item, b.item);
      return cmp !== 0 ? cmp : a.indice - b.indice;
    });

  const porPieza = new Map<number, Map<string, EstadoPiezaApi>>();

  for (const { item } of ordenados) {
    if (item.cara === undefined) {
      porPieza.set(item.pieza, new Map([['*', item]]));
    } else {
      const actual = porPieza.get(item.pieza) ?? new Map<string, EstadoPiezaApi>();
      actual.delete('*');
      actual.set(item.cara, item);
      porPieza.set(item.pieza, actual);
    }
  }

  const resultado: EstadoPiezaApi[] = [];
  for (const mapa of porPieza.values()) {
    for (const registro of mapa.values()) {
      resultado.push(registro);
    }
  }
  return resultado;
}

function firmaPorPieza(piezas: readonly EstadoPiezaApi[]): Map<number, string> {
  const agrupado = new Map<number, string[]>();
  for (const p of piezas) {
    const lista = agrupado.get(p.pieza) ?? [];
    lista.push(`${p.cara ?? '*'}:${p.estado}`);
    agrupado.set(p.pieza, lista);
  }
  const firmas = new Map<number, string>();
  for (const [pieza, lista] of agrupado.entries()) {
    lista.sort();
    firmas.set(pieza, lista.join('|'));
  }
  return firmas;
}

export interface SnapshotConsulta {
  readonly indice: number;
  readonly clave: string;
  readonly fecha: string;
  readonly autor: string;
  readonly cantidadRegistros: number;
  readonly piezasProyectadas: readonly EstadoPiezaApi[];
  readonly piezasCambiadas: readonly number[];
}

/**
 * Agrupa el historial cronológico por instante de registro (consulta / guardado)
 * y precomputa la proyección acumulada y las piezas modificadas respecto al paso anterior.
 */
export function construirSnapshotsHistorial(
  historial: readonly EstadoPiezaApi[],
): SnapshotConsulta[] {
  if (historial.length === 0) return [];

  const ordenados = historial
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => {
      const cmp = compararPorFecha(a.item, b.item);
      return cmp !== 0 ? cmp : a.indice - b.indice;
    })
    .map((x) => x.item);

  const grupos: { clave: string; fecha: string; autor: string; entradas: EstadoPiezaApi[] }[] = [];
  for (const entrada of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === entrada.fecha) {
      ultimo.entradas.push(entrada);
    } else {
      grupos.push({
        clave: entrada.fecha,
        fecha: entrada.fecha,
        autor: entrada.registradoPor,
        entradas: [entrada],
      });
    }
  }

  const snapshots: SnapshotConsulta[] = [];
  const acumuladas: EstadoPiezaApi[] = [];
  let firmasPrevias = new Map<number, string>();

  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    if (!grupo) continue;
    acumuladas.push(...grupo.entradas);
    const proyectadas = proyectarEstadoActual(acumuladas);
    const firmasActuales = firmaPorPieza(proyectadas);

    const cambiadas = new Set<number>();
    for (const [pieza, firma] of firmasActuales.entries()) {
      if (firmasPrevias.get(pieza) !== firma) cambiadas.add(pieza);
    }
    for (const pieza of firmasPrevias.keys()) {
      if (!firmasActuales.has(pieza)) cambiadas.add(pieza);
    }

    snapshots.push({
      indice: i,
      clave: grupo.clave,
      fecha: grupo.fecha,
      autor: grupo.autor,
      cantidadRegistros: grupo.entradas.length,
      piezasProyectadas: proyectadas,
      piezasCambiadas: Array.from(cambiadas).sort((a, b) => a - b),
    });
    firmasPrevias = firmasActuales;
  }

  return snapshots;
}

/**
 * Agrega un cambio al borrador local manteniendo invariantes C-09:
 * - Estados de pieza completa siempre omiten `cara` y limpian caras previas de esa pieza.
 * - Un cambio de cara limpia cualquier cambio de pieza completa o misma cara previo en esa pieza.
 */
export function agregarCambioBorrador(
  borrador: readonly ItemActualizacionPiezaPayload[],
  cambio: ItemActualizacionPiezaPayload,
): ItemActualizacionPiezaPayload[] {
  const esCompleta = esEstadoSoloPiezaCompleta(cambio.estado) || cambio.cara === undefined;
  const normalizado: ItemActualizacionPiezaPayload = esCompleta
    ? { pieza: cambio.pieza, estado: cambio.estado }
    : { pieza: cambio.pieza, cara: cambio.cara, estado: cambio.estado };

  const filtrado = borrador.filter((item) => {
    if (item.pieza !== normalizado.pieza) return true;
    if (normalizado.cara === undefined) return false;
    return item.cara !== undefined && item.cara !== normalizado.cara;
  });

  return [...filtrado, normalizado];
}

export function quitarCambioBorrador(
  borrador: readonly ItemActualizacionPiezaPayload[],
  indice: number,
): ItemActualizacionPiezaPayload[] {
  return borrador.filter((_, i) => i !== indice);
}

/**
 * Aplica los cambios pendientes del borrador sobre la proyección vigente para previsualización en vivo.
 */
export function aplicarBorradorSobrePiezas(
  piezasActuales: readonly EstadoPiezaApi[],
  borrador: readonly ItemActualizacionPiezaPayload[],
): EstadoPiezaApi[] {
  if (borrador.length === 0) return [...piezasActuales];
  const sinteticas: EstadoPiezaApi[] = borrador.map((item, idx) => ({
    id: `draft-${idx}-${item.pieza}-${item.cara ?? 'all'}`,
    odontogramaId: 'draft',
    pieza: item.pieza,
    ...(item.cara !== undefined ? { cara: item.cara } : {}),
    estado: item.estado,
    registradoPor: 'draft',
    fecha: `9999-12-31T23:59:${String(idx % 60).padStart(2, '0')}.000Z`,
  }));
  return proyectarEstadoActual([...piezasActuales, ...sinteticas]);
}
