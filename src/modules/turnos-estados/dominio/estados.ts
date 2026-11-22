import type { EstadoTurno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';

/**
 * Máquina de estados del turno (RN-TU-01). Los estados con lista vacía son finales.
 * La exportan C-10 (¿se puede reprogramar?) y C-11 (cancelar como paciente).
 */
export const TRANSICIONES: Readonly<Record<EstadoTurno, readonly EstadoTurno[]>> = {
  reservado: ['confirmado', 'cancelado'],
  confirmado: ['atendido', 'ausente', 'cancelado'],
  atendido: [],
  ausente: [],
  cancelado: [],
};

export interface MomentoDelTurno {
  /** Hora actual, siempre desde `Clock` (DD-08). */
  ahora: Date;
  inicio: Date;
}

/** Estados que solo se marcan cuando el turno ya empezó (decisión del explore de C-05). */
const REQUIEREN_INICIO: readonly EstadoTurno[] = ['atendido', 'ausente'];

/**
 * Lanza `TRANSICION_INVALIDA` si el turno no puede pasar de `desde` a `hacia`:
 * la transición no está en la tabla, o es a atendido/ausente antes del inicio.
 * Compara instantes, así que no depende de la zona horaria.
 */
export function validarTransicion(desde: EstadoTurno, hacia: EstadoTurno, { ahora, inicio }: MomentoDelTurno): void {
  if (!TRANSICIONES[desde].includes(hacia)) throw new ReglaDeNegocioError('TRANSICION_INVALIDA');
  if (REQUIEREN_INICIO.includes(hacia) && ahora.getTime() < inicio.getTime()) {
    throw new ReglaDeNegocioError('TRANSICION_INVALIDA');
  }
}
