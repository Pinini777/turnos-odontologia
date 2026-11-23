import type { Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';

/**
 * Reglas puras de autogestión del paciente (C-11, RN-RE-02, RN-RE-03).
 * Sin Fastify, sin repositorios y sin leer la hora del sistema: todo llega por parámetro (DD-08).
 */

/** Anticipación mínima requerida para que el paciente cancele o reprograme su turno (RN-RE-02). */
export const VENTANA_AUTOGESTION_MS = 24 * 60 * 60 * 1000;

/**
 * Verifica que el turno exista y pertenezca al paciente autenticado (RN-RE-03).
 * Ante turno inexistente o ajeno responde NO_ENCONTRADO (404) para no revelar su existencia.
 */
export function verificarPropiedadTurno(turno: Turno | undefined, pacienteId: string): Turno {
  if (!turno || turno.pacienteId !== pacienteId) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  return turno;
}

/**
 * Verifica que falten al menos 24 horas exactas hasta el inicio del turno (RN-RE-02).
 * El borde exacto (`inicio - ahora === 24 h`) está permitido.
 */
export function verificarPlazo24h(inicio: Date, ahora: Date): void {
  const anticipacionMs = inicio.getTime() - ahora.getTime();
  if (!(anticipacionMs >= VENTANA_AUTOGESTION_MS)) {
    throw new ReglaDeNegocioError('PLAZO_VENCIDO');
  }
}
