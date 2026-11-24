import type postgres from 'postgres';

type Ruta = readonly (string | number)[];
type Detalle = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Detalle =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

export function codificarDetalle(detalle: Detalle): postgres.JSONValue {
  const fechas: Ruta[] = [];
  const convertir = (valor: unknown, ruta: Ruta): postgres.JSONValue => {
    if (valor instanceof Date) {
      fechas.push(ruta);
      return valor.toISOString();
    }
    if (Array.isArray(valor)) return valor.map((item: unknown, i) => convertir(item, [...ruta, i]));
    if (esObjeto(valor)) return Object.fromEntries(Object.entries(valor)
      .filter(([, item]) => item !== undefined)
      .map(([clave, item]) => [clave, convertir(item, [...ruta, clave])]));
    if (typeof valor === 'string' || typeof valor === 'boolean' || typeof valor === 'number') return valor;
    return null;
  };
  return { valor: convertir(detalle, []), fechas };
}

export function decodificarDetalle(detalle: unknown): Detalle {
  if (!esObjeto(detalle) || !esObjeto(detalle.valor) || !Array.isArray(detalle.fechas)) {
    throw new Error('Detalle de auditoría inválido.');
  }
  const fechas = new Set(detalle.fechas.map((ruta: unknown) => JSON.stringify(ruta)));
  const convertir = (valor: unknown, ruta: Ruta): unknown => {
    if (typeof valor === 'string' && fechas.has(JSON.stringify(ruta))) return new Date(valor);
    if (Array.isArray(valor)) return valor.map((item: unknown, i) => convertir(item, [...ruta, i]));
    if (esObjeto(valor)) return Object.fromEntries(Object.entries(valor)
      .map(([clave, item]) => [clave, convertir(item, [...ruta, clave])]));
    return valor;
  };
  return Object.fromEntries(Object.entries(detalle.valor).map(([clave, valor]) => [clave, convertir(valor, [clave])]));
}
