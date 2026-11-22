import { randomUUID } from 'node:crypto';
import type { Prestacion, Rol } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import { sinPrecioPara, type SinPrecio } from '../../../shared/precios';
import type { Repositorios } from '../../../shared/repositorios';
import { validarDuracionPrestacion } from '../dominio/reglas';

export interface DatosCrearPrestacion {
  nombre: string;
  duracionMin: number;
  precio: number;
  reservableOnline?: boolean;
  activa?: boolean;
}

export interface DatosActualizarPrestacion {
  nombre?: string;
  duracionMin?: number;
  precio?: number;
  reservableOnline?: boolean;
  activa?: boolean;
}

export async function listarPrestaciones(
  repos: Repositorios,
  rol: Rol,
): Promise<SinPrecio<Prestacion[]>> {
  const lista = await repos.prestaciones.listar();
  return sinPrecioPara(rol, lista);
}

export async function listarPrestacionesPublicas(
  repos: Repositorios,
): Promise<SinPrecio<Prestacion[]>> {
  const lista = await repos.prestaciones.listar((p) => p.activa && p.reservableOnline);
  return sinPrecioPara(undefined, lista);
}

export async function crearPrestacion(
  repos: Repositorios,
  datos: DatosCrearPrestacion,
): Promise<Prestacion> {
  validarDuracionPrestacion(datos.duracionMin);

  const prestacion: Prestacion = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    duracionMin: datos.duracionMin,
    precio: datos.precio,
    reservableOnline: datos.reservableOnline ?? true,
    activa: datos.activa ?? true,
  };
  await repos.prestaciones.guardar(prestacion);
  return prestacion;
}

export async function actualizarPrestacion(
  repos: Repositorios,
  id: string,
  datos: DatosActualizarPrestacion,
): Promise<Prestacion> {
  const existente = await repos.prestaciones.buscarPorId(id);
  if (!existente) throw new ReglaDeNegocioError('NO_ENCONTRADO');

  if (datos.duracionMin !== undefined) {
    validarDuracionPrestacion(datos.duracionMin);
  }

  // RN-GA-02: solo actualiza la prestación; los turnos existentes conservan su precioAlReservar.
  const actualizada: Prestacion = {
    ...existente,
    nombre: datos.nombre !== undefined ? datos.nombre.trim() : existente.nombre,
    duracionMin: datos.duracionMin !== undefined ? datos.duracionMin : existente.duracionMin,
    precio: datos.precio !== undefined ? datos.precio : existente.precio,
    reservableOnline:
      datos.reservableOnline !== undefined ? datos.reservableOnline : existente.reservableOnline,
    activa: datos.activa !== undefined ? datos.activa : existente.activa,
  };
  await repos.prestaciones.guardar(actualizada);
  return actualizada;
}
