import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import type { Clock } from '../../shared/clock';
import type { Rol } from '../../shared/entidades';
import type { Repositorios } from '../../shared/repositorios';
import type { AuthPort, UsuarioSesion } from '../../shared/sesion';

export const JWT_ALGORITMO = 'HS256';
export const JWT_ISSUER = 'turnos-odontologia';
export const JWT_TTL_SEGUNDOS = 7200;
const BCRYPT_COST = 10;

export interface EmisorToken {
  emitir(payload: { usuarioId: string; rol: Rol }): Promise<string>;
}

export interface HasherPassword {
  hash(password: string): Promise<string>;
  comparar(password: string, hash: string): Promise<boolean>;
}

export interface OpcionesJwt {
  secret?: string | Uint8Array;
  ttlSegundos?: number;
}

// Clave efímera única por proceso fuera de producción cuando no se define JWT_SECRET.
let secretoEfimeroProceso: Uint8Array | undefined;

export function obtenerSecretoJwt(secretInyectado?: string | Uint8Array): Uint8Array {
  if (secretInyectado !== undefined) {
    if (typeof secretInyectado === 'string') {
      if (secretInyectado.trim().length === 0) {
        throw new Error('JWT_SECRET inyectado no puede estar vacío');
      }
      return new TextEncoder().encode(secretInyectado);
    }
    if (secretInyectado.byteLength === 0) {
      throw new Error('JWT_SECRET inyectado no puede estar vacío');
    }
    return secretInyectado;
  }

  const desdeEntorno = process.env.JWT_SECRET;
  if (desdeEntorno !== undefined && desdeEntorno.trim().length > 0) {
    return new TextEncoder().encode(desdeEntorno);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV === "production"');
  }

  secretoEfimeroProceso ??= new Uint8Array(randomBytes(32));
  return secretoEfimeroProceso;
}

export function crearEmisorJwt(clock: Clock, opciones?: OpcionesJwt): EmisorToken {
  const clave = obtenerSecretoJwt(opciones?.secret);
  const ttl = opciones?.ttlSegundos ?? JWT_TTL_SEGUNDOS;

  return {
    async emitir({ usuarioId, rol }) {
      const iat = Math.floor(clock.ahora().getTime() / 1000);
      const exp = iat + ttl;
      return new SignJWT({ rol })
        .setProtectedHeader({ alg: JWT_ALGORITMO })
        .setSubject(usuarioId)
        .setIssuer(JWT_ISSUER)
        .setIssuedAt(iat)
        .setExpirationTime(exp)
        .sign(clave);
    },
  };
}

export function crearHasherBcrypt(): HasherPassword {
  return {
    hash(password) {
      return bcrypt.hash(password, BCRYPT_COST);
    },
    comparar(password, hash) {
      return bcrypt.compare(password, hash);
    },
  };
}

const ROLES_VALIDOS: ReadonlySet<string> = new Set<Rol>(['profesional', 'recepcionista', 'paciente']);

function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && ROLES_VALIDOS.has(valor);
}

export function crearAuth(
  repos: Repositorios,
  clock: Clock,
  opciones?: Pick<OpcionesJwt, 'secret'>,
): AuthPort {
  const clave = obtenerSecretoJwt(opciones?.secret);

  return {
    async verificar(token): Promise<UsuarioSesion | null> {
      let sub: string;
      let rolToken: Rol;
      try {
        const { payload } = await jwtVerify(token, clave, {
          algorithms: [JWT_ALGORITMO],
          issuer: JWT_ISSUER,
          currentDate: clock.ahora(),
        });
        if (typeof payload.sub !== 'string' || payload.sub.length === 0 || !esRolValido(payload.rol)) {
          return null;
        }
        sub = payload.sub;
        rolToken = payload.rol;
      } catch {
        return null;
      }

      const usuario = await repos.usuarios.buscarPorId(sub);
      if (!usuario || !usuario.activo || usuario.rol !== rolToken) {
        return null;
      }

      if (usuario.rol === 'profesional') {
        const [profesional] = await repos.profesionales.listar((p) => p.usuarioId === usuario.id);
        if (!profesional) return null;
        return { usuarioId: usuario.id, rol: 'profesional', profesionalId: profesional.id };
      }

      if (usuario.rol === 'paciente') {
        const [paciente] = await repos.pacientes.listar((p) => p.usuarioId === usuario.id);
        if (!paciente) return null;
        return { usuarioId: usuario.id, rol: 'paciente', pacienteId: paciente.id };
      }

      return { usuarioId: usuario.id, rol: 'recepcionista' };
    },
  };
}
