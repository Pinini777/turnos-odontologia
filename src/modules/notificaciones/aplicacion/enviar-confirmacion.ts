import type { Clock } from '../../../shared/clock';
import { APP_TZ } from '../../../shared/config';
import type { Notificador } from '../../../shared/puertos';
import { armarEmailConfirmacion } from '../dominio/confirmacion';
import type { DatosConfirmacionTurno } from '../dominio/tipos';

export interface DepsConfirmacionTurno {
  readonly notificador: Notificador;
  readonly clock: Clock;
  readonly zonaHoraria?: string;
}

/**
 * Caso de uso para despachar el email de confirmación al crear (presencial u online)
 * o reprogramar un turno (C-02, C-10 y C-11).
 */
export async function enviarConfirmacionTurno(
  deps: DepsConfirmacionTurno,
  datos: DatosConfirmacionTurno,
): Promise<void> {
  const mensaje = armarEmailConfirmacion(datos, {
    zonaHoraria: deps.zonaHoraria ?? APP_TZ,
    dtstamp: deps.clock.ahora(),
  });
  await deps.notificador.enviar(mensaje);
}
