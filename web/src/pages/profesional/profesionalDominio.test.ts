import { describe, expect, it } from 'vitest';
import {
  construirRangoBloqueo,
  diaSiguienteIso,
  etiquetaDiaSemana,
  formatearArs,
  OPCIONES_DURACION_MIN,
  OPCIONES_HORA_15,
} from './formatos';
import { MENU_PROFESIONAL } from './menuProfesional';
import {
  agruparEstadosPorPieza,
  CUADRANTES_PERMANENTES,
  CUADRANTES_TEMPORARIOS,
  esEstadoSoloPiezaCompleta,
  mapearCarasFdi,
  nombreAnatomicoFdi,
} from './odontogramaFdi';

describe('formatos.ts — Helpers puros de moneda ARS, grilla 15 min y bloqueos', () => {
  it('formatea montos en pesos argentinos (ARS) con separador de miles y dos decimales', () => {
    expect(formatearArs(0)).toMatch(/^\$\s?0,00$/);
    expect(formatearArs(18000)).toMatch(/^\$\s?18\.000,00$/);
    expect(formatearArs(30000.5)).toMatch(/^\$\s?30\.000,50$/);
  });

  it('expone OPCIONES_DURACION_MIN con únicamente múltiplos de 15 entre 15 y 180', () => {
    expect(OPCIONES_DURACION_MIN).toEqual([15, 30, 45, 60, 75, 90, 105, 120, 150, 180]);
    for (const min of OPCIONES_DURACION_MIN) {
      expect(min % 15).toBe(0);
      expect(min).toBeGreaterThanOrEqual(15);
      expect(min).toBeLessThanOrEqual(180);
    }
  });

  it('expone OPCIONES_HORA_15 solo con minutos :00, :15, :30 y :45', () => {
    expect(OPCIONES_HORA_15.length).toBeGreaterThan(40);
    for (const hora of OPCIONES_HORA_15) {
      expect(hora).toMatch(/^([01]\d|2[0-3]):(00|15|30|45)$/);
    }
    expect(OPCIONES_HORA_15[0]).toBe('07:00');
    expect(OPCIONES_HORA_15[OPCIONES_HORA_15.length - 1]).toBe('21:45');
  });

  it('calcula diaSiguienteIso respetando fin de mes y cambio de año', () => {
    expect(diaSiguienteIso('2026-11-23')).toBe('2026-11-24');
    expect(diaSiguienteIso('2026-11-30')).toBe('2026-12-01');
    expect(diaSiguienteIso('2026-12-31')).toBe('2027-01-01');
  });

  it('construye intervalo semiabierto [diaDesdeT00:00:00-03:00, diaSiguiente(diaHasta)T00:00:00-03:00) para día completo', () => {
    const rango = construirRangoBloqueo({
      diaDesde: '2026-11-24',
      diaHasta: '2026-11-26',
      diaCompleto: true,
    });
    expect(rango).toEqual({
      inicio: '2026-11-24T00:00:00-03:00',
      fin: '2026-11-27T00:00:00-03:00',
    });
  });

  it('construye intervalo horario puntual cuando día completo está desmarcado', () => {
    const rango = construirRangoBloqueo({
      diaDesde: '2026-11-25',
      diaHasta: '2026-11-25',
      diaCompleto: false,
      horaDesde: '08:00',
      horaHasta: '09:00',
    });
    expect(rango).toEqual({
      inicio: '2026-11-25T08:00:00-03:00',
      fin: '2026-11-25T09:00:00-03:00',
    });
  });

  it('etiqueta correctamente los días de la semana 1..7', () => {
    expect(etiquetaDiaSemana(1)).toBe('Lunes');
    expect(etiquetaDiaSemana(5)).toBe('Viernes');
    expect(etiquetaDiaSemana(7)).toBe('Domingo');
  });
});

describe('menuProfesional.ts — Ítems del menú profesional sin proximamente', () => {
  it('expone los 5 destinos del área profesional habilitados para el rol profesional', () => {
    expect(MENU_PROFESIONAL.map((i) => i.ruta)).toEqual([
      '/profesional/agenda',
      '/profesional/catalogo',
      '/profesional/horarios',
      '/profesional/ganancias',
      '/profesional/clinica',
    ]);
    for (const item of MENU_PROFESIONAL) {
      expect(item.roles).toEqual(['profesional']);
      expect(item.proximamente).toBeFalsy();
    }
  });
});

describe('odontogramaFdi.ts — Cuadrantes FDI, orientación anatómica y estados de pieza completa', () => {
  it('define las 32 piezas permanentes (11–48) y las 20 temporarias (51–85) en orden anatómico', () => {
    const permanentes = [
      ...CUADRANTES_PERMANENTES.q1,
      ...CUADRANTES_PERMANENTES.q2,
      ...CUADRANTES_PERMANENTES.q4,
      ...CUADRANTES_PERMANENTES.q3,
    ];
    const temporarias = [
      ...CUADRANTES_TEMPORARIOS.q5,
      ...CUADRANTES_TEMPORARIOS.q6,
      ...CUADRANTES_TEMPORARIOS.q8,
      ...CUADRANTES_TEMPORARIOS.q7,
    ];
    expect(permanentes).toHaveLength(32);
    expect(temporarias).toHaveLength(20);
    expect(CUADRANTES_PERMANENTES.q1).toEqual([18, 17, 16, 15, 14, 13, 12, 11]);
    expect(CUADRANTES_PERMANENTES.q2).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
    expect(CUADRANTES_PERMANENTES.q4).toEqual([48, 47, 46, 45, 44, 43, 42, 41]);
    expect(CUADRANTES_PERMANENTES.q3).toEqual([31, 32, 33, 34, 35, 36, 37, 38]);
    expect(CUADRANTES_TEMPORARIOS.q5).toEqual([55, 54, 53, 52, 51]);
    expect(CUADRANTES_TEMPORARIOS.q6).toEqual([61, 62, 63, 64, 65]);
  });

  it('mapea las 5 caras espejadas anatómicamente según cuadrante FDI', () => {
    // Cuadrante 1 (sup. derecho): arriba vestibular, abajo lingual, izq distal, der mesial
    expect(mapearCarasFdi(16)).toEqual({
      top: 'vestibular',
      bottom: 'lingual',
      left: 'distal',
      right: 'mesial',
      center: 'oclusal',
    });
    // Cuadrante 2 (sup. izquierdo): izq mesial, der distal
    expect(mapearCarasFdi(26)).toEqual({
      top: 'vestibular',
      bottom: 'lingual',
      left: 'mesial',
      right: 'distal',
      center: 'oclusal',
    });
    // Cuadrante 4 (inf. derecho): arriba lingual, abajo vestibular, izq distal, der mesial
    expect(mapearCarasFdi(46)).toEqual({
      top: 'lingual',
      bottom: 'vestibular',
      left: 'distal',
      right: 'mesial',
      center: 'oclusal',
    });
    // Cuadrante 3 (inf. izquierdo): arriba lingual, abajo vestibular, izq mesial, der distal
    expect(mapearCarasFdi(36)).toEqual({
      top: 'lingual',
      bottom: 'vestibular',
      left: 'mesial',
      right: 'distal',
      center: 'oclusal',
    });
  });

  it('identifica los 4 estados exclusivos de pieza completa (C-09)', () => {
    expect(esEstadoSoloPiezaCompleta('ausente')).toBe(true);
    expect(esEstadoSoloPiezaCompleta('corona')).toBe(true);
    expect(esEstadoSoloPiezaCompleta('endodoncia')).toBe(true);
    expect(esEstadoSoloPiezaCompleta('a_extraer')).toBe(true);
    expect(esEstadoSoloPiezaCompleta('sano')).toBe(false);
    expect(esEstadoSoloPiezaCompleta('caries')).toBe(false);
    expect(esEstadoSoloPiezaCompleta('obturado')).toBe(false);
  });

  it('devuelve nombres anatómicos claros y agrupa estados de piezas/caras', () => {
    expect(nombreAnatomicoFdi(16)).toBe('Primer molar superior derecho');
    expect(nombreAnatomicoFdi(51)).toContain('temporario');

    const mapa = agruparEstadosPorPieza([
      {
        id: 'ep-1',
        odontogramaId: 'odo-1',
        pieza: 16,
        cara: 'oclusal',
        estado: 'caries',
        registradoPor: 'prof-1',
        fecha: '2026-11-23T10:00:00Z',
      },
      {
        id: 'ep-2',
        odontogramaId: 'odo-1',
        pieza: 26,
        estado: 'corona',
        registradoPor: 'prof-1',
        fecha: '2026-11-23T10:05:00Z',
      },
    ]);
    expect(mapa.get(16)?.caras.oclusal).toBe('caries');
    expect(mapa.get(26)?.completa).toBe('corona');
  });
});
