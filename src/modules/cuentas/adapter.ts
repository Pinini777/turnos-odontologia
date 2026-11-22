import type { Repositorios } from '../../shared/repositorios';
import type { AuthPort } from '../../shared/sesion';

/**
 * STUB de C-01, dueño C-04 (cuentas-y-pacientes): rechaza todo token → 401.
 * C-04 reemplaza este archivo con la verificación JWT real, sin tocar src/app.ts.
 */
export function crearAuth(_repos: Repositorios): AuthPort {
  return {
    async verificar() {
      return null;
    },
  };
}
