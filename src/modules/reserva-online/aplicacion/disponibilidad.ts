import { APP_TZ } from '../../../shared/config';
import type { Profesional } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import { calcularHuecosDisponibles, type HuecoDisponible } from '../dominio/disponibilidad';

export type { HuecoDisponible };

export interface ConsultaHuecosDisponibles {
  prestacionId: string;
  desde: Date;
  hasta: Date;
  profesionalId?: string;
  soloReservablesOnline: boolean;
}

export type DepsDisponibilidad = Pick<Deps, 'repos' | 'clock'> & {
  tz?: string;
};

async function resolverProfesionales(
  profesionalId: string | undefined,
  repos: Deps['repos'],
): Promise<Profesional[]> {
  if (profesionalId === undefined) {
    return repos.profesionales.listar((p) => p.activo);
  }
  const profesional = await repos.profesionales.buscarPorId(profesionalId);
  if (!profesional) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  if (!profesional.activo) {
    throw new ReglaDeNegocioError('RECURSO_INACTIVO');
  }
  return [profesional];
}

/**
 * Consulta los huecos disponibles en grilla de 15 minutos para una prestación activa.
 * En modo público (`soloReservablesOnline: true`) exige además `prestacion.reservableOnline === true`.
 * Nunca devuelve precios ni datos de pacientes.
 */
export async function consultarDisponibilidad(
  consulta: ConsultaHuecosDisponibles,
  deps: DepsDisponibilidad,
): Promise<HuecoDisponible[]> {
  const prestacion = await deps.repos.prestaciones.buscarPorId(consulta.prestacionId);
  if (!prestacion) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  if (!prestacion.activa || (consulta.soloReservablesOnline && !prestacion.reservableOnline)) {
    throw new ReglaDeNegocioError('RECURSO_INACTIVO');
  }

  const profesionales = await resolverProfesionales(consulta.profesionalId, deps.repos);
  const profesionalIds = new Set(profesionales.map((p) => p.id));

  const [boxes, horarios, bloqueos, turnos] = await Promise.all([
    deps.repos.boxes.listar((b) => b.activo),
    deps.repos.horarios.listar((h) => profesionalIds.has(h.profesionalId)),
    deps.repos.bloqueos.listar(),
    deps.repos.turnos.listar((t) => t.estado !== 'cancelado'),
  ]);

  return calcularHuecosDisponibles({
    desde: consulta.desde,
    hasta: consulta.hasta,
    duracionMin: prestacion.duracionMin,
    ahora: deps.clock.ahora(),
    tz: deps.tz ?? APP_TZ,
    profesionales,
    boxes,
    horarios,
    bloqueos,
    turnos,
  });
}
