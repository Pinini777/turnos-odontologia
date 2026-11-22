/** Ejecuta `fn` cuando terminó la operación anterior, aunque esa haya fallado (RN-RE-04). */
export type ConLockDeAgenda = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Un lock por instancia de la API. Validar y guardar un turno va siempre dentro de él.
 * shortcut: exclusión en memoria de un solo proceso; con SQLite pasa a `BEGIN IMMEDIATE`.
 */
export function crearLockDeAgenda(): ConLockDeAgenda {
  let cola: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const resultado = cola.then(fn);
    cola = resultado.catch(() => undefined);
    return resultado;
  };
}
