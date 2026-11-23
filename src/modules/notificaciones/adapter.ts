import nodemailer from 'nodemailer';
import type { Adjunto, MensajeEmail, Notificador } from '../../shared/puertos';

const MAIL_FROM_POR_DEFECTO = 'turnos@example.com';
const SMTP_PORT_POR_DEFECTO = 1025;

export interface FalloEnvio {
  readonly para: string;
  readonly asunto: string;
  readonly motivo: string;
}

export interface NotificadorConBandeja extends Notificador {
  readonly bandeja: MensajeEmail[];
  readonly fallos: FalloEnvio[];
}

/** Alias retrocompatible con el stub inicial de C-01. */
export type NotificadorEnMemoria = NotificadorConBandeja;

export interface AdjuntoSmtp {
  readonly filename: string;
  readonly content: string;
  readonly contentType: string;
}

export interface CorreoSmtp {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly attachments?: AdjuntoSmtp[];
}

export interface TransporteSmtp {
  sendMail(correo: CorreoSmtp): Promise<unknown>;
}

export interface ConfigSmtp {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly requireTLS: boolean;
  readonly auth?: {
    readonly user: string;
    readonly pass: string;
  };
}

export interface OpcionesSmtp {
  readonly from: string;
  readonly transporte?: TransporteSmtp;
  readonly config?: ConfigSmtp;
  readonly crearTransporte?: (config: ConfigSmtp) => TransporteSmtp;
  readonly passParaRedaccion?: string;
  readonly onError?: (fallo: FalloEnvio) => void | Promise<void>;
}

export interface OpcionesNotificador {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly from?: string;
  readonly smtp?: ConfigSmtp;
  readonly transporte?: TransporteSmtp;
  readonly crearTransporte?: (config: ConfigSmtp) => TransporteSmtp;
  readonly onError?: (fallo: FalloEnvio) => void | Promise<void>;
}

function mapearAdjuntos(adjuntos: Adjunto[] | undefined): AdjuntoSmtp[] | undefined {
  if (!adjuntos || adjuntos.length === 0) return undefined;
  return adjuntos.map((a) => ({
    filename: a.nombre,
    content: a.contenido,
    contentType: a.tipo,
  }));
}

function extraerMotivoSeguro(error: unknown, secreto?: string): string {
  const bruto = error instanceof Error ? error.message : String(error);
  if (!secreto) return bruto;
  return bruto.replaceAll(secreto, '[REDACTADO]');
}

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function esHostLocal(host: string): boolean {
  return HOSTS_LOCALES.has(host.toLowerCase());
}

function construirConfigSmtpDesdeEnv(env: Readonly<Record<string, string | undefined>>): ConfigSmtp | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;

  const puertoBruto = env.SMTP_PORT ? Number(env.SMTP_PORT) : SMTP_PORT_POR_DEFECTO;
  const port = Number.isFinite(puertoBruto) && puertoBruto > 0 ? puertoBruto : SMTP_PORT_POR_DEFECTO;
  const secure = port === 465;
  // Fuera del puerto 465 se exige STARTTLS; solo un host loopback con bandera explícita puede omitirlo.
  const permitirSinTlsLocal = env.SMTP_ALLOW_INSECURE_LOCAL === 'true' && esHostLocal(host);
  const requireTLS = !secure && !permitirSinTlsLocal;
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;

  return {
    host,
    port,
    secure,
    requireTLS,
    ...(user && pass !== undefined ? { auth: { user, pass } } : {}),
  };
}

function crearTransporteNodemailer(config: ConfigSmtp): TransporteSmtp {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    ...(config.auth ? { auth: config.auth } : {}),
  });
}

/** Outbox en memoria para tests: guarda copias de los mensajes sin conexión de red. */
export function crearNotificadorEnMemoria(): NotificadorConBandeja {
  const bandeja: MensajeEmail[] = [];
  const fallos: FalloEnvio[] = [];
  return {
    bandeja,
    fallos,
    async enviar(mensaje) {
      bandeja.push(structuredClone(mensaje));
    },
  };
}

/**
 * Adaptador SMTP con nodemailer.
 * Cumple RN-NO-02: si el envío falla, registra el error y nunca lanza excepción
 * para no revertir la creación ni la reprogramación del turno.
 */
export function crearNotificadorSmtp(opciones: OpcionesSmtp): NotificadorConBandeja {
  const bandeja: MensajeEmail[] = [];
  const fallos: FalloEnvio[] = [];
  const fabrica = opciones.crearTransporte ?? crearTransporteNodemailer;
  const transporte =
    opciones.transporte ??
    (opciones.config ? fabrica(opciones.config) : undefined);

  if (!transporte) {
    throw new Error('crearNotificadorSmtp requiere transporte o config SMTP');
  }

  const secreto = opciones.passParaRedaccion ?? opciones.config?.auth?.pass;
  const onError =
    opciones.onError ??
    ((fallo: FalloEnvio) => {
      console.error(`[notificaciones] Error al enviar email a ${fallo.para}: ${fallo.motivo}`);
    });

  return {
    bandeja,
    fallos,
    async enviar(mensaje) {
      const correo: CorreoSmtp = {
        from: opciones.from,
        to: mensaje.para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        ...(mensaje.html !== undefined ? { html: mensaje.html } : {}),
        ...(mensaje.adjuntos && mensaje.adjuntos.length > 0
          ? { attachments: mapearAdjuntos(mensaje.adjuntos) }
          : {}),
      };

      try {
        await transporte.sendMail(correo);
        bandeja.push(structuredClone(mensaje));
      } catch (error: unknown) {
        const fallo: FalloEnvio = {
          para: mensaje.para,
          asunto: mensaje.asunto,
          motivo: extraerMotivoSeguro(error, secreto),
        };
        fallos.push(fallo);
        try {
          await onError(fallo);
        } catch {
          // Un fallo del callback onError nunca debe propagarse ni revertir el turno (RN-NO-02).
        }
      }
    },
  };
}

/**
 * Fábrica por defecto consumida por src/app.ts sin argumentos.
 * - Si SMTP_HOST (o config/transporte) está configurado, envía vía SMTP con nodemailer.
 * - Si no hay SMTP_HOST (entorno de tests sin .env), usa outbox en memoria.
 */
export function crearNotificador(opciones: OpcionesNotificador = {}): NotificadorConBandeja {
  const env = opciones.env ?? process.env;
  const from = opciones.from ?? env.MAIL_FROM?.trim() ?? MAIL_FROM_POR_DEFECTO;

  if (opciones.transporte) {
    return crearNotificadorSmtp({
      from,
      transporte: opciones.transporte,
      onError: opciones.onError,
    });
  }

  const config = opciones.smtp ?? construirConfigSmtpDesdeEnv(env);
  if (config) {
    return crearNotificadorSmtp({
      from,
      config,
      crearTransporte: opciones.crearTransporte,
      onError: opciones.onError,
    });
  }

  return crearNotificadorEnMemoria();
}
