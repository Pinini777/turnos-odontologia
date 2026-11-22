import type { RouteObject } from 'react-router-dom';

/** Lo que exporta cada web/src/pages/<area>/routes.tsx. */
export interface ModuloDeRutas {
  routes: RouteObject[];
}

/**
 * Junta las rutas de todas las áreas sin un router central (DD-13).
 * Recibe el resultado de import.meta.glob('./pages/*\/routes.tsx', { eager: true }), ordenado por ruta de archivo.
 */
export function recolectarRutas(modulos: Record<string, ModuloDeRutas>): RouteObject[] {
  return Object.keys(modulos).sort().flatMap((archivo) => modulos[archivo]?.routes ?? []);
}
