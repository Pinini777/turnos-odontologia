import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { crearConexionPostgres } from '../../src/shared/persistencia/conexion';
import { leerMigraciones, migrarEsquema } from '../../src/shared/persistencia/migraciones';

export async function conEsquema<T>(probar: (sql: postgres.Sql, esquema: string) => Promise<T>): Promise<T> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL no está configurada.');
  const sql = crearConexionPostgres(url);
  const esquema = `test_${randomUUID().replaceAll('-', '')}`;
  let creado = false;
  try {
    await sql`create schema ${sql(esquema)}`;
    creado = true;
    return await probar(sql, esquema);
  } finally {
    try {
      if (creado) await sql`drop schema ${sql(esquema)} cascade`;
    } finally {
      await sql.end({ timeout: 2 });
    }
  }
}

export function conBase<T>(probar: (sql: postgres.Sql, esquema: string) => Promise<T>): Promise<T> {
  return conEsquema(async (sql, esquema) => {
    const migraciones = (await leerMigraciones()).filter(m => !m.nombre.endsWith('_habilitar_btree_gist.sql'));
    await migrarEsquema(sql, esquema, migraciones);
    return probar(sql, esquema);
  });
}
