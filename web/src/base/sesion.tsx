import { useSyncExternalStore } from 'react';
import { crearClienteHttp, type ClienteHttp, type RolUsuario, type UsuarioPublico } from './api';

const CLAVE_STORAGE = 'turnos-odonto:sesion:v1';

export interface SesionActiva {
  readonly token: string;
  readonly usuario: UsuarioPublico;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let cacheInicializada = false;
let sesionActual: SesionActiva | null = null;

function esRolValido(valor: unknown): valor is RolUsuario {
  return valor === 'profesional' || valor === 'recepcionista' || valor === 'paciente';
}

function esSesionValida(valor: unknown): valor is SesionActiva {
  if (typeof valor !== 'object' || valor === null) return false;
  if (!('token' in valor) || !('usuario' in valor)) return false;
  if (typeof valor.token !== 'string' || valor.token.length === 0) return false;
  const u = valor.usuario;
  if (typeof u !== 'object' || u === null) return false;
  return (
    'id' in u &&
    'email' in u &&
    'rol' in u &&
    'activo' in u &&
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    esRolValido(u.rol) &&
    typeof u.activo === 'boolean'
  );
}

function leerDesdeStorage(): SesionActiva | null {
  if (typeof window === 'undefined') return null;
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return null;
    const parsed: unknown = JSON.parse(crudo);
    return esSesionValida(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asegurarCache(): SesionActiva | null {
  if (!cacheInicializada) {
    sesionActual = leerDesdeStorage();
    cacheInicializada = true;
  }
  return sesionActual;
}

function notificar(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function obtenerSesionActual(): SesionActiva | null {
  return asegurarCache();
}

export function establecerSesion(sesion: SesionActiva): void {
  sesionActual = sesion;
  cacheInicializada = true;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify(sesion));
    } catch {
      // Modo privado o storage lleno: se mantiene en memoria.
    }
  }
  notificar();
}

export function limpiarSesion(): void {
  sesionActual = null;
  cacheInicializada = true;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CLAVE_STORAGE);
    } catch {
      // Ignorar si sessionStorage no está disponible.
    }
  }
  notificar();
}

function suscribir(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hook reactivo compartido por todas las áreas (C-12, C-13, C-14, C-15)
 * sin necesidad de modificar web/src/main.tsx (congelado tras C-01).
 */
export function useSesion(): {
  readonly sesion: SesionActiva | null;
  readonly iniciar: (sesion: SesionActiva) => void;
  readonly cerrar: () => void;
} {
  const sesion = useSyncExternalStore(suscribir, obtenerSesionActual, () => null);
  return {
    sesion,
    iniciar: establecerSesion,
    cerrar: limpiarSesion,
  };
}

/** Cliente HTTP listo para usar en pantallas autenticadas de toda la app. */
export const apiConsultorio: ClienteHttp = crearClienteHttp({
  obtenerToken: () => obtenerSesionActual()?.token ?? null,
  onUnauthorized: () => {
    if (obtenerSesionActual() !== null) {
      limpiarSesion();
    }
  },
});
