import type { AuditoriaTurno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import { ordenarPorFecha } from '../dominio/agenda';

/**
 * Registros append-only de un turno tal como se guardaron, ordenados por `fecha` (US-061, RN-TU-05).
 * Sin restricción de dueño (PA-09, D5) y sin reinterpretar `actor` ni `detalle` (D6).
 */
export async function consultarAuditoria(
  { turnoId }: { turnoId: string },
  { repos }: { repos: Repositorios },
): Promise<AuditoriaTurno[]> {
  if (!(await repos.turnos.existe(turnoId))) throw new ReglaDeNegocioError('NO_ENCONTRADO');
  return ordenarPorFecha(await repos.auditoria.listar((r) => r.turnoId === turnoId));
}
