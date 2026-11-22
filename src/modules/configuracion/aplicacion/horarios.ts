import { randomUUID } from 'node:crypto';
import type { DiaSemana, HorarioAtencion, HoraDelDia } from '../../../shared/entidades';
import { ReglaDeNegocioError, SinPermisoError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import type { UsuarioSesion } from '../../../shared/sesion';
import { validarFranjaHorarioEnGrilla } from '../dominio/reglas';

export interface FranjaHorarioInput {
  diaSemana: DiaSemana;
  desde: HoraDelDia;
  hasta: HoraDelDia;
}

export async function listarHorariosProfesional(
  repos: Repositorios,
  profesionalId: string,
): Promise<HorarioAtencion[]> {
  if (!(await repos.profesionales.existe(profesionalId))) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  return repos.horarios.listar((h) => h.profesionalId === profesionalId);
}

export async function reemplazarHorariosProfesional(
  repos: Repositorios,
  sesion: UsuarioSesion,
  profesionalId: string,
  franjas: readonly FranjaHorarioInput[],
): Promise<HorarioAtencion[]> {
  if (!(await repos.profesionales.existe(profesionalId))) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  if (sesion.profesionalId !== profesionalId) {
    throw new SinPermisoError();
  }

  for (const franja of franjas) {
    validarFranjaHorarioEnGrilla(franja.desde, franja.hasta);
  }

  const existentes = await repos.horarios.listar((h) => h.profesionalId === profesionalId);
  for (const horario of existentes) {
    await repos.horarios.borrar(horario.id);
  }

  const nuevos: HorarioAtencion[] = [];
  for (const franja of franjas) {
    const horario: HorarioAtencion = {
      id: randomUUID(),
      profesionalId,
      diaSemana: franja.diaSemana,
      desde: franja.desde,
      hasta: franja.hasta,
    };
    await repos.horarios.guardar(horario);
    nuevos.push(horario);
  }

  return nuevos;
}
