import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { Box } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';

export interface DatosCrearBox {
  nombre: string;
}

export interface DatosActualizarBox {
  nombre?: string;
  activo?: boolean;
}

const normalizarClave = (valor: string): string => valor.trim().toLowerCase();

async function asegurarNombreBoxUnico(
  repos: Repositorios,
  nombre: string,
  excluirId?: string,
): Promise<void> {
  const clave = normalizarClave(nombre);
  const existentes = await repos.boxes.listar(
    (b) => b.id !== excluirId && normalizarClave(b.nombre) === clave,
  );
  if (existentes.length > 0) {
    throw new ZodError([
      {
        code: 'custom',
        path: ['nombre'],
        message: 'Ya existe un box con ese nombre',
      },
    ]);
  }
}

export async function listarBoxes(repos: Repositorios): Promise<Box[]> {
  return repos.boxes.listar();
}

export async function crearBox(repos: Repositorios, datos: DatosCrearBox): Promise<Box> {
  const nombre = datos.nombre.trim();
  await asegurarNombreBoxUnico(repos, nombre);

  const box: Box = {
    id: randomUUID(),
    nombre,
    activo: true,
  };
  await repos.boxes.guardar(box);
  return box;
}

export async function actualizarBox(
  repos: Repositorios,
  id: string,
  datos: DatosActualizarBox,
): Promise<Box> {
  const existente = await repos.boxes.buscarPorId(id);
  if (!existente) throw new ReglaDeNegocioError('NO_ENCONTRADO');

  const nombre = datos.nombre !== undefined ? datos.nombre.trim() : existente.nombre;
  if (datos.nombre !== undefined) {
    await asegurarNombreBoxUnico(repos, nombre, id);
  }

  const actualizado: Box = {
    ...existente,
    nombre,
    activo: datos.activo !== undefined ? datos.activo : existente.activo,
  };
  await repos.boxes.guardar(actualizado);
  return actualizado;
}
