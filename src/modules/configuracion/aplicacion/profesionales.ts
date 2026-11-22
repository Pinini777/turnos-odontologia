import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { Profesional } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';

export interface DatosCrearProfesional {
  nombre: string;
  matricula: string;
  usuarioId: string;
}

export interface DatosActualizarProfesional {
  nombre?: string;
  matricula?: string;
  activo?: boolean;
}

const normalizarClave = (valor: string): string => valor.trim().toLowerCase();

async function asegurarMatriculaUnica(
  repos: Repositorios,
  matricula: string,
  excluirId?: string,
): Promise<void> {
  const clave = normalizarClave(matricula);
  const existentes = await repos.profesionales.listar(
    (p) => p.id !== excluirId && normalizarClave(p.matricula) === clave,
  );
  if (existentes.length > 0) {
    throw new ZodError([
      {
        code: 'custom',
        path: ['matricula'],
        message: 'Ya existe un profesional con esa matrícula',
      },
    ]);
  }
}

export async function listarProfesionales(repos: Repositorios): Promise<Profesional[]> {
  return repos.profesionales.listar();
}

export async function crearProfesional(
  repos: Repositorios,
  datos: DatosCrearProfesional,
): Promise<Profesional> {
  const nombre = datos.nombre.trim();
  const matricula = datos.matricula.trim();
  await asegurarMatriculaUnica(repos, matricula);

  const profesional: Profesional = {
    id: randomUUID(),
    nombre,
    matricula,
    usuarioId: datos.usuarioId.trim(),
    activo: true,
  };
  await repos.profesionales.guardar(profesional);
  return profesional;
}

export async function actualizarProfesional(
  repos: Repositorios,
  id: string,
  datos: DatosActualizarProfesional,
): Promise<Profesional> {
  const existente = await repos.profesionales.buscarPorId(id);
  if (!existente) throw new ReglaDeNegocioError('NO_ENCONTRADO');

  const matricula = datos.matricula !== undefined ? datos.matricula.trim() : existente.matricula;
  if (datos.matricula !== undefined) {
    await asegurarMatriculaUnica(repos, matricula, id);
  }

  const actualizado: Profesional = {
    ...existente,
    nombre: datos.nombre !== undefined ? datos.nombre.trim() : existente.nombre,
    matricula,
    activo: datos.activo !== undefined ? datos.activo : existente.activo,
  };
  await repos.profesionales.guardar(actualizado);
  return actualizado;
}
