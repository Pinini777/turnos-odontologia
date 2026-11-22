import type { Clock } from '../../shared/clock';
import type { Repositorios } from '../../shared/repositorios';
import type { AuthPort } from '../../shared/sesion';

/**
 * STUB de C-01, dueño C-04 (cuentas-y-pacientes): rechaza todo token → 401.
 * C-04 reemplaza este archivo con la verificación JWT real, sin tocar src/app.ts.
 * Recibe el Clock de buildApp para calcular el vencimiento del token.
 */
export function crearAuth(_repos: Repositorios, _clock: Clock): AuthPort {
  return {
    async verificar() {
      return null;
    },
  };
}
