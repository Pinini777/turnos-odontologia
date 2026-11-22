import type { Clock } from './clock';
import type { ConLockDeAgenda } from './lock';
import type { Repositorios } from './repositorios';
import type { AuthPort } from './sesion';

export interface Adjunto {
  nombre: string;
  contenido: string;
  tipo: string;
}

export interface MensajeEmail {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  adjuntos?: Adjunto[];
}

/** Envío de emails. Un fallo no revierte el turno (RN-NO-02). Lo implementa C-06. */
export interface Notificador {
  enviar(mensaje: MensajeEmail): Promise<void>;
}

export interface ConsultaDisponibilidad {
  profesionalId: string;
  boxId: string;
  inicio: Date;
  fin: Date;
}

/** Horario de atención y bloqueos (RN-AG-08, RN-AG-09). null = disponible. Lo implementa C-03. */
export interface DisponibilidadPort {
  verificar(consulta: ConsultaDisponibilidad): Promise<null | 'FUERA_DE_HORARIO' | 'EN_BLOQUEO'>;
}

/** Todo lo que un módulo recibe en `app.deps`. */
export interface Deps {
  clock: Clock;
  repos: Repositorios;
  auth: AuthPort;
  notificador: Notificador;
  disponibilidad: DisponibilidadPort;
  conLockDeAgenda: ConLockDeAgenda;
}
