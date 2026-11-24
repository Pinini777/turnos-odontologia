import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { crearConexionPostgres } from '../../src/shared/persistencia/conexion';
import { leerMigraciones, migrarEsquema } from '../../src/shared/persistencia/migraciones';

// La preparación y las consultas atraviesan el pooler remoto.
export const TIMEOUT_POSTGRES = 60_000;

export interface BasePrueba {
  sql: postgres.Sql;
  esquema: string;
  cerrar(): Promise<void>;
}

async function crearEsquema(): Promise<BasePrueba> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL no está configurada.');
  const sql = crearConexionPostgres(url);
  const esquema = `test_${randomUUID().replaceAll('-', '')}`;
  try {
    await sql`create schema ${sql(esquema)}`;
  } catch (error) {
    await sql.end({ timeout: 2 });
    throw error;
  }
  let cierre: Promise<void> | undefined;
  return {
    sql, esquema,
    cerrar: () => cierre ??= (async () => {
      try {
        await sql`drop schema ${sql(esquema)} cascade`;
      } finally {
        await sql.end({ timeout: 2 });
      }
    })(),
  };
}

async function probarYCerrar<T>(base: BasePrueba, probar: (sql: postgres.Sql, esquema: string) => Promise<T>): Promise<T> {
  try {
    return await probar(base.sql, base.esquema);
  } finally {
    await base.cerrar();
  }
}

export async function conEsquema<T>(probar: (sql: postgres.Sql, esquema: string) => Promise<T>): Promise<T> {
  return probarYCerrar(await crearEsquema(), probar);
}

export async function migracionesDeAplicacion() {
  return (await leerMigraciones()).filter(m => !m.nombre.endsWith('_habilitar_btree_gist.sql'));
}

export function conBase(): Promise<BasePrueba>;
export function conBase<T>(probar: (sql: postgres.Sql, esquema: string) => Promise<T>): Promise<T>;
export async function conBase<T>(probar?: (sql: postgres.Sql, esquema: string) => Promise<T>) {
  const base = await crearEsquema();
  try {
    await migrarEsquema(base.sql, base.esquema, await migracionesDeAplicacion());
  } catch (error) {
    await base.cerrar();
    throw error;
  }
  return probar ? probarYCerrar(base, probar) : base;
}
