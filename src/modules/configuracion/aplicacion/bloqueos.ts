import { randomUUID } from 'node:crypto';
import type { BloqueoAgenda } from '../../../shared/entidades';
import { ReglaDeNegocioError, SinPermisoError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import type { UsuarioSesion } from '../../../shared/sesion';

export interface FiltroBloqueos {
  profesionalId?: string;
  boxId?: string;
}

export type CrearBloqueoInput = {
  inicio: Date;
  fin: Date;
  motivo: string;
} & ({ profesionalId: string; boxId?: undefined } | { boxId: string; profesionalId?: undefined });

export async function listarBloqueos(
  repos: Repositorios,
  filtros: FiltroBloqueos,
): Promise<BloqueoAgenda[]> {
  return repos.bloqueos.listar((b) => {
    if (filtros.profesionalId !== undefined && b.profesionalId !== filtros.profesionalId) {
      return false;
    }
    if (filtros.boxId !== undefined && b.boxId !== filtros.boxId) {
      return false;
    }
    return true;
  });
}

export async function crearBloqueo(
  repos: Repositorios,
  sesion: UsuarioSesion,
  input: CrearBloqueoInput,
): Promise<BloqueoAgenda> {
  let bloqueo: BloqueoAgenda;

  if (input.profesionalId !== undefined) {
    if (!(await repos.profesionales.existe(input.profesionalId))) {
      throw new ReglaDeNegocioError('NO_ENCONTRADO');
    }
    if (sesion.profesionalId !== input.profesionalId) {
      throw new SinPermisoError();
    }
    bloqueo = {
      id: randomUUID(),
      profesionalId: input.profesionalId,
      inicio: input.inicio,
      fin: input.fin,
      motivo: input.motivo,
    };
  } else {
    if (!(await repos.boxes.existe(input.boxId))) {
      throw new ReglaDeNegocioError('NO_ENCONTRADO');
    }
    bloqueo = {
      id: randomUUID(),
      boxId: input.boxId,
      inicio: input.inicio,
      fin: input.fin,
      motivo: input.motivo,
    };
  }

  await repos.bloqueos.guardar(bloqueo);
  return bloqueo;
}

export async function eliminarBloqueo(
  repos: Repositorios,
  sesion: UsuarioSesion,
  bloqueoId: string,
): Promise<void> {
  const bloqueo = await repos.bloqueos.buscarPorId(bloqueoId);
  if (!bloqueo) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  if (bloqueo.profesionalId !== undefined && bloqueo.profesionalId !== sesion.profesionalId) {
    throw new SinPermisoError();
  }
  await repos.bloqueos.borrar(bloqueoId);
}
