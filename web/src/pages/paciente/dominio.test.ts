import { describe, expect, it } from 'vitest';
import {
  construirLinkGoogleCalendar,
  esErrorConflictoHueco,
  etiquetaBox,
  etiquetaProfesional,
  fechaBloqueCalendario,
  horaEnZona,
  puedeAutogestionarTurno,
  rangoDiaConsultorio,
  separarMananaTarde,
  sumarDiasIso,
} from './dominio';

describe('dominio web-paciente (funciones puras)', () => {
  it('permite cancelar/reprogramar cuando faltan más de 24 h (RN-RE-02)', () => {
    const ahora = new Date('2026-11-24T09:00:00-03:00');
    expect(puedeAutogestionarTurno('2026-11-25T10:00:00-03:00', 'reservado', ahora)).toBe(true);
    expect(puedeAutogestionarTurno('2026-11-25T10:00:00-03:00', 'confirmado', ahora)).toBe(true);
  });

  it('permite cancelar/reprogramar en el borde exacto de 24 h antes del inicio', () => {
    const ahora = new Date('2026-11-24T09:00:00-03:00');
    expect(puedeAutogestionarTurno('2026-11-25T09:00:00-03:00', 'reservado', ahora)).toBe(true);
  });

  it('deshabilita autogestión si faltan menos de 24 h o si el turno no está activo', () => {
    const ahora = new Date('2026-11-24T09:00:01-03:00');
    expect(puedeAutogestionarTurno('2026-11-25T09:00:00-03:00', 'reservado', ahora)).toBe(false);
    expect(puedeAutogestionarTurno('2026-11-28T09:00:00-03:00', 'cancelado', ahora)).toBe(false);
    expect(puedeAutogestionarTurno('2026-11-28T09:00:00-03:00', 'atendido', ahora)).toBe(false);
    expect(puedeAutogestionarTurno('2026-11-28T09:00:00-03:00', 'ausente', ahora)).toBe(false);
  });

  it('arma rango diario en America/Argentina/Mendoza con offset -03:00 y suma días sin desfase', () => {
    expect(rangoDiaConsultorio('2026-11-26')).toEqual({
      desde: '2026-11-26T00:00:00-03:00',
      hasta: '2026-11-26T23:59:59-03:00',
    });
    expect(sumarDiasIso('2026-11-30', 1)).toBe('2026-12-01');
    expect(horaEnZona('2026-11-26T10:30:00-03:00')).toBe('10:30');
  });

  it('separa huecos en mañana (< 13:00) y tarde (>= 13:00)', () => {
    const huecos = [
      { inicio: '2026-11-26T09:00:00-03:00', fin: '2026-11-26T09:30:00-03:00', profesionalId: 'p1', boxIds: ['b1'] },
      { inicio: '2026-11-26T12:30:00-03:00', fin: '2026-11-26T13:00:00-03:00', profesionalId: 'p1', boxIds: ['b1'] },
      { inicio: '2026-11-26T15:00:00-03:00', fin: '2026-11-26T15:30:00-03:00', profesionalId: 'p2', boxIds: ['b2'] },
    ];
    const { manana, tarde } = separarMananaTarde(huecos);
    expect(manana).toHaveLength(2);
    expect(tarde).toHaveLength(1);
  });

  it('genera enlace de Google Calendar en UTC con los datos del turno y sin precios', () => {
    const url = construirLinkGoogleCalendar({
      prestacionNombre: 'Consulta',
      profesionalNombre: 'Dra. Ana Pérez',
      boxNombre: 'Box 1',
      inicioIso: '2026-11-26T10:00:00-03:00',
      finIso: '2026-11-26T10:30:00-03:00',
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('dates')).toBe('20261126T130000Z/20261126T133000Z');
    expect(parsed.searchParams.get('text')).toContain('Consulta');
    expect(parsed.searchParams.get('details')).toContain('Dra. Ana Pérez');
    expect(parsed.searchParams.get('details')).toContain('Box 1');
    expect(url).not.toContain('$');
    expect(url.toLowerCase()).not.toContain('precio');
  });

  it('identifica códigos de conflicto de hueco y resuelve etiquetas legibles sin UUIDs crudos', () => {
    expect(esErrorConflictoHueco('SOLAPAMIENTO_PROFESIONAL')).toBe(true);
    expect(esErrorConflictoHueco('SOLAPAMIENTO_BOX')).toBe(true);
    expect(esErrorConflictoHueco('EN_BLOQUEO')).toBe(true);
    expect(esErrorConflictoHueco('PLAZO_VENCIDO')).toBe(false);

    expect(etiquetaProfesional('00000000-0000-4000-8000-000000000101')).toBe('Dra. Ana Pérez');
    expect(etiquetaProfesional('00000000-0000-4000-8000-000000000102')).toBe('Dr. Bruno Gómez');
    expect(etiquetaProfesional('otro-id-dinamico')).toBe('Profesional asignado');

    expect(etiquetaBox('00000000-0000-4000-8000-000000000201')).toBe('Box 1');
    expect(etiquetaBox('00000000-0000-4000-8000-000000000202')).toBe('Box 2');
    expect(etiquetaBox('otro-box')).toBe('Box asignado');

    const bloque = fechaBloqueCalendario('2026-11-26T10:00:00-03:00');
    expect(bloque.dia).toBe('26');
    expect(bloque.mesCorto).toBe('NOV');
  });
});
