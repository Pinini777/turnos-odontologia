import { describe, expect, it } from 'vitest';
import type { EstadoPieza } from '../../src/shared/entidades';
import {
  CARAS_PIEZA,
  ESTADOS_DE_PIEZA,
  ESTADOS_SOLO_PIEZA_COMPLETA,
  clavePiezaCara,
  esEstadoSoloPiezaCompleta,
  esPiezaFdiValida,
  tieneClavesDuplicadas,
  tieneMezclaPiezaCompletaYCara,
} from '../../src/modules/clinica/dominio/fdi';
import {
  ordenarCronologicamente,
  proyectarEstadoActual,
} from '../../src/modules/clinica/dominio/proyeccion';

describe('Dominio clínico — FDI y consistencia intra-lote (Task 1.1)', () => {
  it('expone las listas canónicas congeladas de estados, caras y estados exclusivos de pieza completa', () => {
    expect(ESTADOS_DE_PIEZA).toEqual([
      'sano',
      'caries',
      'obturado',
      'ausente',
      'corona',
      'endodoncia',
      'a_extraer',
    ]);
    expect(CARAS_PIEZA).toEqual(['oclusal', 'mesial', 'distal', 'vestibular', 'lingual']);
    expect(ESTADOS_SOLO_PIEZA_COMPLETA).toEqual(['ausente', 'corona', 'endodoncia', 'a_extraer']);
  });

  it('acepta exactamente las 52 piezas FDI válidas (32 permanentes y 20 temporarias) y rechaza huecos/bordes', () => {
    const validasEsperadas: number[] = [];
    for (const c of [1, 2, 3, 4]) {
      for (let p = 1; p <= 8; p++) validasEsperadas.push(c * 10 + p);
    }
    for (const c of [5, 6, 7, 8]) {
      for (let p = 1; p <= 5; p++) validasEsperadas.push(c * 10 + p);
    }
    expect(validasEsperadas).toHaveLength(52);

    for (const pieza of validasEsperadas) {
      expect(esPiezaFdiValida(pieza), `pieza ${pieza} debe ser válida`).toBe(true);
    }

    const invalidas = [
      -11, -1, 0, 1, 10, 19, 20, 29, 30, 39, 40, 49, 50,
      56, 57, 58, 59, 60, 66, 67, 68, 69, 70, 76, 77, 78, 79, 80, 86, 91, 99, 111,
      11.5, 16.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
    ];
    for (const pieza of invalidas) {
      expect(esPiezaFdiValida(pieza), `pieza ${pieza} debe ser inválida`).toBe(false);
    }

    // Verificación exhaustiva sobre enteros de -10 a 100
    const setValidas = new Set(validasEsperadas);
    for (let n = -10; n <= 100; n++) {
      expect(esPiezaFdiValida(n)).toBe(setValidas.has(n));
    }
  });

  it('clasifica correctamente estados exclusivos de pieza completa vs. estados con cara opcional', () => {
    for (const estado of ['ausente', 'corona', 'endodoncia', 'a_extraer'] as const) {
      expect(esEstadoSoloPiezaCompleta(estado)).toBe(true);
    }
    for (const estado of ['caries', 'obturado', 'sano'] as const) {
      expect(esEstadoSoloPiezaCompleta(estado)).toBe(false);
    }
  });

  it('construye clavePiezaCara y detecta duplicados y mezcla de pieza completa con cara', () => {
    expect(clavePiezaCara(16)).toBe('16:*');
    expect(clavePiezaCara(16, 'oclusal')).toBe('16:oclusal');

    expect(
      tieneClavesDuplicadas([
        { pieza: 16, cara: 'oclusal' },
        { pieza: 16, cara: 'mesial' },
        { pieza: 21 },
      ]),
    ).toBe(false);
    expect(
      tieneClavesDuplicadas([
        { pieza: 16, cara: 'oclusal' },
        { pieza: 16, cara: 'oclusal' },
      ]),
    ).toBe(true);
    expect(tieneClavesDuplicadas([{ pieza: 21 }, { pieza: 21 }])).toBe(true);

    expect(
      tieneMezclaPiezaCompletaYCara([
        { pieza: 16, cara: 'oclusal' },
        { pieza: 16, cara: 'mesial' },
        { pieza: 21 },
      ]),
    ).toBe(false);
    expect(
      tieneMezclaPiezaCompletaYCara([{ pieza: 16 }, { pieza: 16, cara: 'oclusal' }]),
    ).toBe(true);
    expect(
      tieneMezclaPiezaCompletaYCara([{ pieza: 16, cara: 'mesial' }, { pieza: 16 }]),
    ).toBe(true);
  });
});

function estadoPieza(
  id: string,
  pieza: number,
  estado: EstadoPieza['estado'],
  isoFecha: string,
  cara?: EstadoPieza['cara'],
): EstadoPieza {
  return {
    id,
    odontogramaId: 'odo-ficticio-1',
    pieza,
    ...(cara === undefined ? {} : { cara }),
    estado,
    registradoPor: 'prof-ficticio-1',
    fecha: new Date(isoFecha),
  };
}

describe('Dominio clínico — ordenamiento cronológico y proyección del odontograma (Task 1.2)', () => {
  it('ordena cronológicamente ascendente preservando el orden de inserción ante empates sin mutar la entrada', () => {
    const t1 = new Date('2026-11-23T10:00:00.000Z');
    const t2 = new Date('2026-11-23T11:00:00.000Z');
    const original = [
      { id: 'c', fecha: t2 },
      { id: 'a', fecha: t1 },
      { id: 'b', fecha: t1 },
    ];
    const copiaAntes = original.map((x) => x.id);

    const ordenado = ordenarCronologicamente(original);

    expect(ordenado.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(original.map((x) => x.id)).toEqual(copiaAntes);
  });

  it('devuelve arreglo vacío ante historial vacío', () => {
    expect(proyectarEstadoActual([])).toEqual([]);
  });

  it('proyecta múltiples piezas y conserva distintas caras de la misma pieza ordenadas determinísticamente', () => {
    const historial: EstadoPieza[] = [
      estadoPieza('e1', 21, 'sano', '2026-11-23T10:00:00.000Z'),
      estadoPieza('e2', 16, 'caries', '2026-11-23T10:00:00.000Z', 'oclusal'),
      estadoPieza('e3', 16, 'obturado', '2026-11-23T10:30:00.000Z', 'mesial'),
      estadoPieza('e4', 16, 'obturado', '2026-11-23T11:00:00.000Z', 'oclusal'),
    ];

    const actual = proyectarEstadoActual(historial);

    expect(actual.map((e) => ({ id: e.id, pieza: e.pieza, cara: e.cara, estado: e.estado }))).toEqual([
      { id: 'e3', pieza: 16, cara: 'mesial', estado: 'obturado' },
      { id: 'e4', pieza: 16, cara: 'oclusal', estado: 'obturado' },
      { id: 'e1', pieza: 21, cara: undefined, estado: 'sano' },
    ]);
    expect(historial).toHaveLength(4);
  });

  it('una cara específica desplaza a una entrada previa de pieza completa en piezas preservando historial intacto', () => {
    const historial: EstadoPieza[] = [
      estadoPieza('e1', 16, 'sano', '2026-11-23T10:00:00.000Z'),
      estadoPieza('e2', 16, 'caries', '2026-11-23T11:00:00.000Z', 'oclusal'),
    ];

    const actual = proyectarEstadoActual(historial);

    expect(actual.map((e) => ({ id: e.id, pieza: e.pieza, cara: e.cara, estado: e.estado }))).toEqual([
      { id: 'e2', pieza: 16, cara: 'oclusal', estado: 'caries' },
    ]);
    expect(historial.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('una pieza completa desplaza a todas las entradas previas por cara de esa pieza preservando otras piezas y el historial', () => {
    const historial: EstadoPieza[] = [
      estadoPieza('e1', 16, 'caries', '2026-11-23T10:00:00.000Z', 'oclusal'),
      estadoPieza('e2', 16, 'obturado', '2026-11-23T10:05:00.000Z', 'mesial'),
      estadoPieza('e3', 21, 'caries', '2026-11-23T10:10:00.000Z', 'vestibular'),
      estadoPieza('e4', 16, 'corona', '2026-11-23T11:00:00.000Z'),
    ];

    const actual = proyectarEstadoActual(historial);

    expect(actual.map((e) => ({ id: e.id, pieza: e.pieza, cara: e.cara, estado: e.estado }))).toEqual([
      { id: 'e4', pieza: 16, cara: undefined, estado: 'corona' },
      { id: 'e3', pieza: 21, cara: 'vestibular', estado: 'caries' },
    ]);
    expect(historial.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('ante empate exacto de timestamp aplica el último según orden de inserción', () => {
    const historial: EstadoPieza[] = [
      estadoPieza('e1', 16, 'caries', '2026-11-23T10:00:00.000Z', 'oclusal'),
      estadoPieza('e2', 16, 'obturado', '2026-11-23T10:00:00.000Z', 'oclusal'),
    ];

    const actual = proyectarEstadoActual(historial);

    expect(actual.map((e) => ({ id: e.id, estado: e.estado }))).toEqual([
      { id: 'e2', estado: 'obturado' },
    ]);
  });
});
