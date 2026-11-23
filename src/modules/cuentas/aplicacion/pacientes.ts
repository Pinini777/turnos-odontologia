import { randomUUID } from 'node:crypto';
import type { Paciente } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import type { UsuarioSesion } from '../../../shared/sesion';
import {
  normalizarDocumento,
  normalizarEmail,
  validarUnicidadPaciente,
} from '../dominio/reglas';

export interface EntradaCrearPaciente {
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export interface EntradaActualizarPaciente {
  nombre?: string;
  apellido?: string;
  documento?: string;
  email?: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export async function listarPacientes(repos: Repositorios): Promise<Paciente[]> {
  return repos.pacientes.listar();
}

export async function crearPaciente(
  repos: Repositorios,
  entrada: EntradaCrearPaciente,
  generarId: () => string = randomUUID,
): Promise<Paciente> {
  const [usuarios, pacientes] = await Promise.all([
    repos.usuarios.listar(),
    repos.pacientes.listar(),
  ]);

  validarUnicidadPaciente({
    email: entrada.email,
    documento: entrada.documento,
    usuarios,
    pacientes,
  });

  const paciente: Paciente = {
    id: generarId(),
    nombre: entrada.nombre.trim(),
    apellido: entrada.apellido.trim(),
    documento: normalizarDocumento(entrada.documento),
    email: normalizarEmail(entrada.email),
  };
  if (entrada.telefono !== undefined) paciente.telefono = entrada.telefono;
  if (entrada.obraSocial !== undefined) paciente.obraSocial = entrada.obraSocial;
  if (entrada.plan !== undefined) paciente.plan = entrada.plan;
  if (entrada.nroAfiliado !== undefined) paciente.nroAfiliado = entrada.nroAfiliado;

  await repos.pacientes.guardar(paciente);
  return paciente;
}

export async function actualizarPaciente(
  repos: Repositorios,
  id: string,
  entrada: EntradaActualizarPaciente,
): Promise<Paciente> {
  const existente = await repos.pacientes.buscarPorId(id);
  if (!existente) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }

  const [usuarios, pacientes] = await Promise.all([
    repos.usuarios.listar(),
    repos.pacientes.listar(),
  ]);

  validarUnicidadPaciente({
    email: entrada.email,
    documento: entrada.documento,
    usuarios,
    pacientes,
    excluir: { pacienteId: existente.id, usuarioId: existente.usuarioId },
  });

  const actualizado: Paciente = {
    ...existente,
    ...(entrada.nombre !== undefined ? { nombre: entrada.nombre.trim() } : {}),
    ...(entrada.apellido !== undefined ? { apellido: entrada.apellido.trim() } : {}),
    ...(entrada.documento !== undefined ? { documento: normalizarDocumento(entrada.documento) } : {}),
    ...(entrada.email !== undefined ? { email: normalizarEmail(entrada.email) } : {}),
    ...(entrada.telefono !== undefined ? { telefono: entrada.telefono } : {}),
    ...(entrada.obraSocial !== undefined ? { obraSocial: entrada.obraSocial } : {}),
    ...(entrada.plan !== undefined ? { plan: entrada.plan } : {}),
    ...(entrada.nroAfiliado !== undefined ? { nroAfiliado: entrada.nroAfiliado } : {}),
  };

  if (existente.usuarioId !== undefined && actualizado.email !== existente.email) {
    const usuario = await repos.usuarios.buscarPorId(existente.usuarioId);
    if (usuario) {
      await repos.usuarios.guardar({ ...usuario, email: actualizado.email });
    }
  }

  await repos.pacientes.guardar(actualizado);
  return actualizado;
}

export interface EntradaActualizarDatosPropios {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export async function obtenerDatosPropios(
  repos: Repositorios,
  sesion: UsuarioSesion,
): Promise<Paciente> {
  if (!sesion.pacienteId) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  const paciente = await repos.pacientes.buscarPorId(sesion.pacienteId);
  if (!paciente) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  return paciente;
}

export async function actualizarDatosPropios(
  repos: Repositorios,
  sesion: UsuarioSesion,
  entrada: EntradaActualizarDatosPropios,
): Promise<Paciente> {
  const existente = await obtenerDatosPropios(repos, sesion);
  const actualizado: Paciente = {
    ...existente,
    ...(entrada.nombre !== undefined ? { nombre: entrada.nombre.trim() } : {}),
    ...(entrada.apellido !== undefined ? { apellido: entrada.apellido.trim() } : {}),
    ...(entrada.telefono !== undefined ? { telefono: entrada.telefono } : {}),
    ...(entrada.obraSocial !== undefined ? { obraSocial: entrada.obraSocial } : {}),
    ...(entrada.plan !== undefined ? { plan: entrada.plan } : {}),
    ...(entrada.nroAfiliado !== undefined ? { nroAfiliado: entrada.nroAfiliado } : {}),
  };

  await repos.pacientes.guardar(actualizado);
  return actualizado;
}
