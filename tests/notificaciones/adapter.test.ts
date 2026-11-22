import { describe, expect, it, vi } from 'vitest';
import type { MensajeEmail } from '../../src/shared/puertos';
import {
  crearNotificador,
  crearNotificadorEnMemoria,
  crearNotificadorSmtp,
  type CorreoSmtp,
  type TransporteSmtp,
} from '../../src/modules/notificaciones/adapter';

const mensajeEjemplo: MensajeEmail = {
  para: 'paciente1@example.com',
  asunto: 'Confirmación de turno - Consulta (23/11/2026 09:00)',
  texto: 'Turno confirmado con Dra. Ana Pérez en Box 1.',
  html: '<p>Turno confirmado con Dra. Ana Pérez en Box 1.</p>',
  adjuntos: [
    {
      nombre: 'turno.ics',
      contenido: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
      tipo: 'text/calendar; charset=utf-8; method=PUBLISH',
    },
  ],
};

describe('Adaptador de notificaciones (outbox en memoria y SMTP)', () => {
  it('crearNotificador sin SMTP_HOST opera en modo outbox en memoria y guarda copias en bandeja', async () => {
    const notificador = crearNotificador({ env: {} });
    const borrador: MensajeEmail = { ...mensajeEjemplo };

    await notificador.enviar(borrador);
    borrador.asunto = 'Modificado luego del envío';

    expect(notificador.bandeja).toHaveLength(1);
    expect(notificador.bandeja[0]?.asunto).toBe(mensajeEjemplo.asunto);
    expect(notificador.fallos).toEqual([]);
  });

  it('crearNotificadorEnMemoria almacena los mensajes en bandeja sin fallos', async () => {
    const outbox = crearNotificadorEnMemoria();
    await outbox.enviar(mensajeEjemplo);
    expect(outbox.bandeja).toEqual([mensajeEjemplo]);
    expect(outbox.fallos).toEqual([]);
  });

  it('crearNotificadorSmtp envía from, to, subject, text, html y adjuntos .ics correctamente', async () => {
    const enviados: CorreoSmtp[] = [];
    const transporte: TransporteSmtp = {
      async sendMail(correo) {
        enviados.push(correo);
      },
    };

    const notificador = crearNotificadorSmtp({
      from: 'turnos@example.com',
      transporte,
    });

    await notificador.enviar(mensajeEjemplo);

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toEqual({
      from: 'turnos@example.com',
      to: 'paciente1@example.com',
      subject: mensajeEjemplo.asunto,
      text: mensajeEjemplo.texto,
      html: mensajeEjemplo.html,
      attachments: [
        {
          filename: 'turno.ics',
          content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
          contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
        },
      ],
    });
    expect(notificador.bandeja).toEqual([mensajeEjemplo]);
    expect(notificador.fallos).toEqual([]);
  });

  it('RN-NO-02: si SMTP falla, NO lanza excepción, registra el fallo sin credenciales e invoca onError', async () => {
    const claveFalsa = 'clave-secreta-ejemplo-123';
    const onError = vi.fn();
    const transporteQueFalla: TransporteSmtp = {
      async sendMail() {
        throw new Error(`ECONNREFUSED auth failed with ${claveFalsa}`);
      },
    };

    const notificador = crearNotificadorSmtp({
      from: 'turnos@example.com',
      transporte: transporteQueFalla,
      passParaRedaccion: claveFalsa,
      onError,
    });

    await expect(notificador.enviar(mensajeEjemplo)).resolves.toBeUndefined();

    expect(notificador.bandeja).toEqual([]);
    expect(notificador.fallos).toHaveLength(1);
    expect(notificador.fallos[0]?.para).toBe('paciente1@example.com');
    expect(notificador.fallos[0]?.asunto).toBe(mensajeEjemplo.asunto);
    expect(notificador.fallos[0]?.motivo).toContain('ECONNREFUSED');
    expect(notificador.fallos[0]?.motivo).not.toContain(claveFalsa);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(notificador.fallos[0]);
  });

  it('crearNotificador con SMTP_HOST en env construye el adaptador SMTP con SMTP_* y MAIL_FROM', async () => {
    const sendMail = vi.fn(async () => undefined);
    const crearTransporte = vi.fn(() => ({ sendMail }));

    const notificador = crearNotificador({
      env: {
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_USER: 'usuario-ejemplo',
        SMTP_PASS: 'clave-ejemplo',
        MAIL_FROM: 'consultorio@example.com',
      },
      crearTransporte,
    });

    await notificador.enviar(mensajeEjemplo);

    expect(crearTransporte).toHaveBeenCalledWith({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: {
        user: 'usuario-ejemplo',
        pass: 'clave-ejemplo',
      },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'consultorio@example.com' }));
  });
});
