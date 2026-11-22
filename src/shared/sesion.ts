import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Rol } from './entidades';
import { NoAutenticadoError, SinPermisoError } from './errores';

export interface UsuarioSesion {
  usuarioId: string;
  rol: Rol;
  /** Presente si rol = profesional. */
  profesionalId?: string;
  /** Presente si rol = paciente. */
  pacienteId?: string;
}

/** Valida un token y devuelve la sesión, o null si es inválido. Lo implementa C-04. */
export interface AuthPort {
  verificar(token: string): Promise<UsuarioSesion | null>;
}

declare module 'fastify' {
  interface FastifyRequest {
    sesion?: UsuarioSesion;
  }
}

/** Sesión de una ruta protegida. Lanza 401 si no hay (no debería pasar detrás del hook de auth). */
export function sesionDe(request: FastifyRequest): UsuarioSesion {
  if (!request.sesion) throw new NoAutenticadoError();
  return request.sesion;
}

/** preHandler: deja pasar solo a los roles indicados; el resto recibe 403. */
export function requireRol(...roles: Rol[]): preHandlerAsyncHookHandler {
  return async (request) => {
    if (!roles.includes(sesionDe(request).rol)) throw new SinPermisoError();
  };
}

/** Rutas que no exigen sesión (03 · Rutas públicas). */
export const esRutaPublica = (url: string) =>
  url === '/api/health' || url.startsWith('/api/public/');
