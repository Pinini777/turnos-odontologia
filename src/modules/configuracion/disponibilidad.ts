import type { DisponibilidadPort } from '../../shared/puertos';
import type { Repositorios } from '../../shared/repositorios';

/**
 * STUB de C-01, dueño C-03 (configuracion): acepta cualquier horario.
 * C-03 reemplaza este archivo con la validación de horarios y bloqueos, sin tocar src/app.ts.
 */
export function crearDisponibilidad(_repos: Repositorios): DisponibilidadPort {
  return {
    async verificar() {
      return null;
    },
  };
}
