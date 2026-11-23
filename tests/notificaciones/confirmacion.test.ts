import { describe, expect, it } from 'vitest';
import type { Turno } from '../../src/shared/entidades';
import { SEED } from '../../src/shared/seed';
import { armarEmailConfirmacion } from '../../src/modules/notificaciones/dominio/confirmacion';

const ZONA_MENDOZA = 'America/Argentina/Mendoza';

function turnoSemilla(overrides: Partial<Turno> = {}): Turno {
  return {
    id: '00000000-0000-4000-8000-000000000902',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-11-23T12:00:00Z'), // lunes 09:00 Mendoza
    fin: new Date('2026-11-23T12:30:00Z'), // lunes 09:30 Mendoza
    estado: 'reservado',
    origen: 'online',
    precioAlReservar: 15000,
    creadoPor: SEED.usuarios.paciente1.id,
    creadoEn: new Date('2026-11-22T20:00:00Z'),
    ...overrides,
  };
}

describe('armarEmailConfirmacion', () => {
  it('arma el email de confirmación al crear un turno con fecha/hora en APP_TZ, link GCal y adjunto .ics', () => {
    const email = armarEmailConfirmacion(
      {
        turno: turnoSemilla(),
        paciente: SEED.pacientes.uno,
        profesional: SEED.profesionales.anaPerez,
        box: SEED.boxes.box1,
        prestacion: SEED.prestaciones.consulta,
      },
      { zonaHoraria: ZONA_MENDOZA, dtstamp: new Date('2026-11-22T20:00:00Z') },
    );

    expect(email.para).toBe('paciente1@example.com');
    expect(email.asunto).toBe('Confirmación de turno - Consulta (23/11/2026 09:00)');

    expect(email.texto).toContain('Paciente Ficticio Uno');
    expect(email.texto).toContain('23/11/2026');
    expect(email.texto).toContain('09:00');
    expect(email.texto).toContain('09:30');
    expect(email.texto).toContain('Dra. Ana Pérez');
    expect(email.texto).toContain('Box 1');
    expect(email.texto).toContain('Consulta');
    expect(email.texto).toContain('Consultorio Odontológico');
    expect(email.texto).toContain('https://calendar.google.com/calendar/render?');

    expect(email.html).toBeDefined();
    expect(email.html).toContain('Agregar a Google Calendar');
    expect(email.html).toContain('Dra. Ana Pérez');
    expect(email.html).toContain('Box 1');
    expect(email.html).toContain('23/11/2026');
    expect(email.html).toContain('09:00');

    expect(email.adjuntos).toHaveLength(1);
    const adjunto = email.adjuntos?.[0];
    expect(adjunto?.nombre).toBe('turno.ics');
    expect(adjunto?.tipo).toContain('text/calendar');
    expect(adjunto?.contenido).toContain('BEGIN:VCALENDAR');
    expect(adjunto?.contenido).toContain('DTSTART:20261123T120000Z');
    expect(adjunto?.contenido).toContain('DTEND:20261123T123000Z');
    expect(adjunto?.contenido).toContain('SEQUENCE:0');
  });

  it('arma el email de turno reprogramado conservando el mismo UID y usando SEQUENCE:1 en el .ics', () => {
    const email = armarEmailConfirmacion(
      {
        turno: turnoSemilla({
          inicio: new Date('2026-11-23T13:00:00Z'), // 10:00 Mendoza
          fin: new Date('2026-11-23T13:30:00Z'), // 10:30 Mendoza
        }),
        paciente: SEED.pacientes.uno,
        profesional: SEED.profesionales.anaPerez,
        box: SEED.boxes.box2,
        prestacion: SEED.prestaciones.consulta,
        tipo: 'reprogramado',
      },
      { zonaHoraria: ZONA_MENDOZA, dtstamp: new Date('2026-11-22T21:00:00Z') },
    );

    expect(email.asunto).toBe('Turno reprogramado - Consulta (23/11/2026 10:00)');
    expect(email.texto).toContain('reprogramado');
    expect(email.texto).toContain('10:00');
    expect(email.texto).toContain('10:30');
    expect(email.texto).toContain('Box 2');

    const ics = email.adjuntos?.[0]?.contenido ?? '';
    expect(ics).toContain('UID:turno-00000000-0000-4000-8000-000000000902@turnos-odontologia.local');
    expect(ics).toContain('SEQUENCE:1');
    expect(ics).toContain('DTSTART:20261123T130000Z');
  });

  it('RN-NO-03: nunca incluye precio ni precioAlReservar en asunto, texto, html ni .ics', () => {
    const email = armarEmailConfirmacion(
      {
        turno: turnoSemilla({ precioAlReservar: 25000 }),
        paciente: SEED.pacientes.uno,
        profesional: SEED.profesionales.brunoGomez,
        box: SEED.boxes.box1,
        prestacion: SEED.prestaciones.limpieza, // precio: 25000
      },
      { zonaHoraria: ZONA_MENDOZA, dtstamp: new Date('2026-11-22T20:00:00Z') },
    );

    const todo = [
      email.asunto,
      email.texto,
      email.html ?? '',
      ...(email.adjuntos ?? []).map((a) => a.contenido),
    ].join('\n');

    expect(todo).not.toContain('25000');
    expect(todo).not.toContain('25.000');
    expect(todo).not.toContain('$');
    expect(todo.toLowerCase()).not.toContain('precio');
  });

  it('borde: escapa caracteres HTML peligrosos en el cuerpo HTML', () => {
    const email = armarEmailConfirmacion(
      {
        turno: turnoSemilla(),
        paciente: { ...SEED.pacientes.uno, nombre: '<script>alert("x")</script>', apellido: 'Ficticio & Test' },
        profesional: SEED.profesionales.anaPerez,
        box: SEED.boxes.box1,
        prestacion: { ...SEED.prestaciones.consulta, nombre: 'Control & Diagnóstico' },
      },
      { zonaHoraria: ZONA_MENDOZA, dtstamp: new Date('2026-11-22T20:00:00Z') },
    );

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(email.html).toContain('Control &amp; Diagnóstico');
  });
});
