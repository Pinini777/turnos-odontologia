import { describe, expect, it } from 'vitest';
import type { EstadoTurno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { TRANSICIONES, validarTransicion } from '../../src/modules/turnos-estados/dominio/estados';

const ESTADOS: EstadoTurno[] = ['reservado', 'confirmado', 'atendido', 'ausente', 'cancelado'];
const VALIDAS: ReadonlyArray<readonly [EstadoTurno, EstadoTurno]> = [
  ['reservado', 'confirmado'],
  ['reservado', 'cancelado'],
  ['confirmado', 'atendido'],
  ['confirmado', 'ausente'],
  ['confirmado', 'cancelado'],
];
const esValida = (desde: EstadoTurno, hacia: EstadoTurno) => VALIDAS.some(([d, h]) => d === desde && h === hacia);

// Turno de 10:00 a 10:30 en Mendoza (UTC-3), lunes 30/11/2026.
const INICIO = new Date('2026-11-30T13:00:00Z');
const YA_EMPEZO = { inicio: INICIO, ahora: new Date('2026-11-30T13:10:00Z') };

const codigoDe = (fn: () => void): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e instanceof ReglaDeNegocioError ? e.code : 'OTRO_ERROR';
  }
};

describe('Transiciones de estado válidas (RN-TU-01)', () => {
  it.each(VALIDAS)('%s → %s se permite', (desde, hacia) => {
    expect(codigoDe(() => validarTransicion(desde, hacia, YA_EMPEZO))).toBeUndefined();
  });

  const invalidas = ESTADOS.flatMap((d) => ESTADOS.map((h) => [d, h] as const)).filter(([d, h]) => !esValida(d, h));

  it.each(invalidas)('%s → %s da TRANSICION_INVALIDA', (desde, hacia) => {
    expect(codigoDe(() => validarTransicion(desde, hacia, YA_EMPEZO))).toBe('TRANSICION_INVALIDA');
  });

  it('atendido, ausente y cancelado son finales: no tienen salidas', () => {
    expect(TRANSICIONES.atendido).toEqual([]);
    expect(TRANSICIONES.ausente).toEqual([]);
    expect(TRANSICIONES.cancelado).toEqual([]);
  });
});

describe('Atendido o ausente solo después del inicio', () => {
  const UN_MINUTO_ANTES = { inicio: INICIO, ahora: new Date('2026-11-30T12:59:00Z') };
  const JUSTO_AL_INICIO = { inicio: INICIO, ahora: new Date('2026-11-30T13:00:00Z') };
  const UNA_SEMANA_ANTES = { inicio: INICIO, ahora: new Date('2026-11-23T13:00:00Z') };

  it.each(['atendido', 'ausente'] as const)('%s a las 09:59 de un turno de las 10:00 da TRANSICION_INVALIDA', (hacia) => {
    expect(codigoDe(() => validarTransicion('confirmado', hacia, UN_MINUTO_ANTES))).toBe('TRANSICION_INVALIDA');
  });

  it.each(['atendido', 'ausente'] as const)('borde: %s justo a las 10:00 se permite', (hacia) => {
    expect(codigoDe(() => validarTransicion('confirmado', hacia, JUSTO_AL_INICIO))).toBeUndefined();
  });

  it.each([
    ['reservado', 'confirmado'],
    ['reservado', 'cancelado'],
    ['confirmado', 'cancelado'],
  ] as const)('%s → %s se permite una semana antes del inicio', (desde, hacia) => {
    expect(codigoDe(() => validarTransicion(desde, hacia, UNA_SEMANA_ANTES))).toBeUndefined();
  });
});
