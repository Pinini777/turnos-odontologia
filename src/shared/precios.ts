import type { Rol } from './entidades';

const CAMPOS_PRECIO = new Set(['precio', 'precioAlReservar']);

type ClavePrecio = 'precio' | 'precioAlReservar';

/** T sin `precio` ni `precioAlReservar` en ningún nivel. */
export type SinPrecio<T> = T extends Date
  ? T
  : T extends readonly (infer U)[]
    ? SinPrecio<U>[]
    : T extends object
      ? { [K in keyof T as K extends ClavePrecio ? never : K]: SinPrecio<T[K]> }
      : T;

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function quitarPrecios(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(quitarPrecios);
  if (!esObjetoPlano(v)) return v;
  return Object.fromEntries(
    Object.entries(v).filter(([k]) => !CAMPOS_PRECIO.has(k)).map(([k, x]) => [k, quitarPrecios(x)]),
  );
}

/**
 * RN-RO-01: la recepcionista y el paciente nunca reciben precios. Sin rol (rutas públicas) se trata igual.
 * El profesional recibe el valor tal cual. Nunca muta el original.
 */
export function sinPrecioPara<T>(rol: Rol | undefined, valor: T): SinPrecio<T> {
  // Un T con precios es un superconjunto estructural de SinPrecio<T>.
  if (rol === 'profesional') return valor as SinPrecio<T>;
  return quitarPrecios(valor) as SinPrecio<T>;
}
