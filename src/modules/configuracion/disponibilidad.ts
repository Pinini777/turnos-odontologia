import type { ConsultaDisponibilidad, DisponibilidadPort } from '../../shared/puertos';
import type { Repositorios } from '../../shared/repositorios';
import { enZonaConsultorio } from '../../shared/zona';
import { estaDentroDeHorario, haySolapamientoIntervalos } from './dominio/reglas';

/**
 * Validación real de disponibilidad (C-03): horario de atención en APP_TZ (RN-AG-09)
 * y bloqueos del profesional o del box bajo intervalos semiabiertos [inicio, fin) (RN-AG-04, RN-AG-08).
 */
export function crearDisponibilidad(repos: Repositorios): DisponibilidadPort {
  return {
    async verificar({ profesionalId, boxId, inicio, fin }: ConsultaDisponibilidad) {
      const inicioZona = enZonaConsultorio(inicio);
      const finZona = enZonaConsultorio(fin);

      const horariosDelDia = await repos.horarios.listar(
        (h) => h.profesionalId === profesionalId && h.diaSemana === inicioZona.diaSemana,
      );

      if (!estaDentroDeHorario(inicio, fin, inicioZona, finZona, horariosDelDia)) {
        return 'FUERA_DE_HORARIO';
      }

      const bloqueosRelevantes = await repos.bloqueos.listar(
        (b) => b.profesionalId === profesionalId || b.boxId === boxId,
      );

      if (bloqueosRelevantes.some((b) => haySolapamientoIntervalos(inicio, fin, b.inicio, b.fin))) {
        return 'EN_BLOQUEO';
      }

      return null;
    },
  };
}
