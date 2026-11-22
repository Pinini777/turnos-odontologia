import type { MensajeEmail, Notificador } from '../../shared/puertos';

export interface NotificadorEnMemoria extends Notificador {
  readonly bandeja: MensajeEmail[];
}

/**
 * STUB de C-01, dueño C-06 (notificaciones): guarda los mensajes en una bandeja en memoria y no envía nada.
 * C-06 reemplaza este archivo con el adaptador SMTP, sin tocar src/app.ts.
 */
export function crearNotificador(): NotificadorEnMemoria {
  const bandeja: MensajeEmail[] = [];
  return {
    bandeja,
    async enviar(mensaje) {
      bandeja.push(structuredClone(mensaje));
    },
  };
}
