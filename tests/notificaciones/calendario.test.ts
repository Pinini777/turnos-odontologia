import { describe, expect, it } from 'vitest';
import type { Turno } from '../../src/shared/entidades';
import { SEED } from '../../src/shared/seed';
import { generarIcs, generarLinkGoogleCalendar } from '../../src/modules/notificaciones/dominio/calendario';

function turnoSemilla(overrides: Partial<Turno> = {}): Turno {
  return {
    id: '00000000-0000-4000-8000-000000000901',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-11-23T12:00:00Z'), // lunes 09:00 Mendoza (-03:00)
    fin: new Date('2026-11-23T12:30:00Z'), // lunes 09:30 Mendoza (-03:00)
    estado: 'reservado',
    origen: 'online',
    precioAlReservar: 15000,
    creadoPor: SEED.usuarios.paciente1.id,
    creadoEn: new Date('2026-11-22T20:00:00Z'),
    ...overrides,
  };
}

function datosBase(overrides: Partial<Parameters<typeof generarIcs>[0]> = {}) {
  return {
    turno: turnoSemilla(),
    paciente: SEED.pacientes.uno,
    profesional: SEED.profesionales.anaPerez,
    box: SEED.boxes.box1,
    prestacion: SEED.prestaciones.consulta,
    ...overrides,
  };
}

describe('generarLinkGoogleCalendar', () => {
  it('genera URL de Google Calendar con action=TEMPLATE, fechas UTC y datos del turno sin precio', () => {
    const link = generarLinkGoogleCalendar(datosBase());
    const url = new URL(link);

    expect(`${url.origin}${url.pathname}`).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261123T120000Z/20261123T123000Z');
    expect(url.searchParams.get('text')).toContain('Consulta');
    expect(url.searchParams.get('text')).toContain('Dra. Ana Pérez');
    expect(url.searchParams.get('details')).toContain('Dra. Ana Pérez');
    expect(url.searchParams.get('details')).toContain('Box 1');
    expect(url.searchParams.get('details')).toContain('Consulta');
    expect(url.searchParams.get('location')).toBe('Box 1 - Consultorio Odontológico');

    // RN-NO-03: jamás expone el precio
    expect(link).not.toContain('15000');
    expect(link).not.toContain('15.000');
    expect(link).not.toContain('$');
    expect(link.toLowerCase()).not.toContain('precio');
  });

  it('borde: turno nocturno en Mendoza (22:00-22:30 -03:00) pasa al día siguiente en UTC', () => {
    const link = generarLinkGoogleCalendar(
      datosBase({
        turno: turnoSemilla({
          inicio: new Date('2026-11-24T01:00:00Z'),
          fin: new Date('2026-11-24T01:30:00Z'),
        }),
      }),
    );
    const url = new URL(link);
    expect(url.searchParams.get('dates')).toBe('20261124T010000Z/20261124T013000Z');
  });

  it('rechaza intervalo inválido (fin <= inicio) con RangeError', () => {
    const mismoInstante = new Date('2026-11-23T12:00:00Z');
    expect(() =>
      generarLinkGoogleCalendar(datosBase({ turno: turnoSemilla({ inicio: mismoInstante, fin: mismoInstante }) })),
    ).toThrow(RangeError);

    expect(() =>
      generarLinkGoogleCalendar(
        datosBase({
          turno: turnoSemilla({
            inicio: new Date('2026-11-23T12:30:00Z'),
            fin: new Date('2026-11-23T12:00:00Z'),
          }),
        }),
      ),
    ).toThrow(RangeError);
  });
});

describe('generarIcs (RFC 5545)', () => {
  it('genera un VCALENDAR 2.0 válido con VEVENT, fechas UTC, CRLF, UID estable y sin precio', () => {
    const dtstamp = new Date('2026-11-22T20:00:00Z');
    const ics = generarIcs(datosBase(), dtstamp);

    expect(ics.endsWith('\r\n')).toBe(true);
    // Todos los saltos de línea deben ser CRLF
    expect(ics.replaceAll('\r\n', '')).not.toContain('\n');

    const desplegado = ics.replaceAll('\r\n ', '');
    const lineas = desplegado.trimEnd().split('\r\n');

    expect(lineas[0]).toBe('BEGIN:VCALENDAR');
    expect(lineas.at(-1)).toBe('END:VCALENDAR');
    expect(lineas).toContain('VERSION:2.0');
    expect(lineas).toContain('PRODID:-//Turnos Odontologia//Agenda//ES');
    expect(lineas).toContain('CALSCALE:GREGORIAN');
    expect(lineas).toContain('METHOD:PUBLISH');
    expect(lineas).toContain('BEGIN:VEVENT');
    expect(lineas).toContain('END:VEVENT');
    expect(lineas).toContain('UID:turno-00000000-0000-4000-8000-000000000901@turnos-odontologia.local');
    expect(lineas).toContain('DTSTAMP:20261122T200000Z');
    expect(lineas).toContain('DTSTART:20261123T120000Z');
    expect(lineas).toContain('DTEND:20261123T123000Z');
    expect(lineas).toContain('SEQUENCE:0');
    expect(lineas).toContain('STATUS:CONFIRMED');
    expect(lineas.some((l) => l.startsWith('SUMMARY:') && l.includes('Consulta') && l.includes('Dra. Ana Pérez'))).toBe(true);
    expect(lineas.some((l) => l.startsWith('LOCATION:') && l.includes('Box 1') && l.includes('Consultorio Odontológico'))).toBe(true);
    expect(lineas.some((l) => l.startsWith('DESCRIPTION:') && l.includes('Box 1') && l.includes('Dra. Ana Pérez'))).toBe(true);

    // RN-NO-03: jamás incluye precio
    expect(ics).not.toContain('15000');
    expect(ics).not.toContain('15.000');
    expect(ics).not.toContain('$');
    expect(ics.toLowerCase()).not.toContain('precio');
  });

  it('usa el mismo UID y SEQUENCE:1 cuando el turno fue reprogramado', () => {
    const original = generarIcs(datosBase({ tipo: 'creado' }), new Date('2026-11-22T20:00:00Z'));
    const reprogramado = generarIcs(
      datosBase({
        tipo: 'reprogramado',
        turno: turnoSemilla({
          inicio: new Date('2026-11-23T13:00:00Z'),
          fin: new Date('2026-11-23T13:30:00Z'),
        }),
      }),
      new Date('2026-11-22T21:00:00Z'),
    );

    const uidOriginal = original.split('\r\n').find((l) => l.startsWith('UID:'));
    const uidReprogramado = reprogramado.split('\r\n').find((l) => l.startsWith('UID:'));
    expect(uidReprogramado).toBe(uidOriginal);
    expect(reprogramado).toContain('SEQUENCE:1\r\n');
    expect(reprogramado).toContain('DTSTART:20261123T130000Z\r\n');
    expect(reprogramado).toContain('DTEND:20261123T133000Z\r\n');
  });

  it('borde: sin dtstamp explícito usa turno.creadoEn de forma determinista (sin reloj del sistema)', () => {
    const ics = generarIcs(datosBase());
    expect(ics).toContain('DTSTAMP:20261122T200000Z\r\n');
  });

  it('borde RFC 5545: escapa \\, ;, , y saltos de línea, y pliega líneas mayores a 75 octetos UTF-8', () => {
    const ics = generarIcs(
      datosBase({
        prestacion: {
          nombre: 'Limpieza profunda, control; revisión\\completa de diagnóstico odontológico integral',
          duracionMin: 45,
        },
        box: { nombre: 'Box 1, Planta Alta; Ala \\ Norte' },
      }),
      new Date('2026-11-22T20:00:00Z'),
    );

    const lineasFisicas = ics.trimEnd().split('\r\n');
    for (const linea of lineasFisicas) {
      expect(Buffer.byteLength(linea, 'utf8')).toBeLessThanOrEqual(75);
    }

    const desplegado = ics.replaceAll('\r\n ', '');
    expect(desplegado).toContain('Limpieza profunda\\, control\\; revisión\\\\completa');
    expect(desplegado).toContain('LOCATION:Box 1\\, Planta Alta\\; Ala \\\\ Norte');
  });

  it('rechaza intervalo inválido (fin <= inicio) con RangeError', () => {
    expect(() =>
      generarIcs(
        datosBase({
          turno: turnoSemilla({
            inicio: new Date('2026-11-23T12:30:00Z'),
            fin: new Date('2026-11-23T12:00:00Z'),
          }),
        }),
        new Date('2026-11-22T20:00:00Z'),
      ),
    ).toThrow(RangeError);
  });
});
