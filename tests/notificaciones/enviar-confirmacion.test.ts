import { describe, expect, it, vi } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { SEED } from '../../src/shared/seed';
import {
  crearNotificadorEnMemoria,
  crearNotificadorSmtp,
  enviarConfirmacionTurno,
} from '../../src/modules/notificaciones';

function turnoSemilla(overrides: Partial<Turno> = {}): Turno {
  return {
    id: '00000000-0000-4000-8000-000000000903',
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
    creadoEn: new Date('2026-11-22T19:00:00Z'),
    ...overrides,
  };
}

describe('enviarConfirmacionTurno (integración para C-02, C-10 y C-11)', () => {
  it('despacha el email completo sin precio usando Clock inyectable para DTSTAMP', async () => {
    const notificador = crearNotificadorEnMemoria();
    const clock = new FixedClock('2026-11-22T20:15:00Z');

    await enviarConfirmacionTurno(
      { notificador, clock },
      {
        turno: turnoSemilla(),
        paciente: SEED.pacientes.uno,
        profesional: SEED.profesionales.anaPerez,
        box: SEED.boxes.box1,
        prestacion: SEED.prestaciones.consulta,
        tipo: 'creado',
      },
    );

    expect(notificador.bandeja).toHaveLength(1);
    const enviado = notificador.bandeja[0];
    expect(enviado?.para).toBe('paciente1@example.com');
    expect(enviado?.asunto).toContain('Confirmación de turno');
    expect(enviado?.texto).toContain('https://calendar.google.com/calendar/render?');
    expect(enviado?.texto).not.toContain('15000');
    expect(enviado?.adjuntos?.[0]?.contenido).toContain('DTSTAMP:20261122T201500Z');
  });

  it('soporta reprogramación actualizando asunto y SEQUENCE:1 en el .ics', async () => {
    const notificador = crearNotificadorEnMemoria();
    const clock = new FixedClock('2026-11-22T21:00:00Z');

    await enviarConfirmacionTurno(
      { notificador, clock },
      {
        turno: turnoSemilla({
          inicio: new Date('2026-11-23T14:00:00Z'), // 11:00 Mendoza
          fin: new Date('2026-11-23T14:30:00Z'),
        }),
        paciente: SEED.pacientes.uno,
        profesional: SEED.profesionales.brunoGomez,
        box: SEED.boxes.box2,
        prestacion: SEED.prestaciones.consulta,
        tipo: 'reprogramado',
      },
    );

    expect(notificador.bandeja).toHaveLength(1);
    const enviado = notificador.bandeja[0];
    expect(enviado?.asunto).toContain('Turno reprogramado');
    expect(enviado?.texto).toContain('Dr. Bruno Gómez');
    expect(enviado?.texto).toContain('Box 2');
    expect(enviado?.adjuntos?.[0]?.contenido).toContain('SEQUENCE:1');
  });

  it('RN-NO-02: si falla el envío SMTP, el caso de uso completa sin lanzar excepción', async () => {
    const onError = vi.fn();
    const notificador = crearNotificadorSmtp({
      from: 'turnos@example.com',
      transporte: {
        async sendMail() {
          throw new Error('SMTP timeout');
        },
      },
      onError,
    });
    const clock = new FixedClock('2026-11-22T20:15:00Z');

    await expect(
      enviarConfirmacionTurno(
        { notificador, clock },
        {
          turno: turnoSemilla(),
          paciente: SEED.pacientes.uno,
          profesional: SEED.profesionales.anaPerez,
          box: SEED.boxes.box1,
          prestacion: SEED.prestaciones.consulta,
        },
      ),
    ).resolves.toBeUndefined();

    expect(notificador.fallos).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
