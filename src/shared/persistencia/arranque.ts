import type { Repositorios } from '../repositorios';
import { crearRepositoriosEnMemoria } from '../repositorios';
import { cargarSeedDemo } from '../seed-demo';
import { crearConexionPostgres } from './conexion';
import { crearRepositoriosPostgres } from './repositorios-postgres';
import { sembrarPostgres } from './sembrar';

interface RepositoriosActivos {
  repos: Repositorios;
  cerrar(): Promise<void>;
}

export async function abrirRepositorios(url: string | undefined, ahora: Date, esquema = 'public'): Promise<RepositoriosActivos> {
  if (!url) {
    const repos = crearRepositoriosEnMemoria();
    cargarSeedDemo(repos, ahora);
    return { repos, cerrar: () => Promise.resolve() };
  }

  let sql: ReturnType<typeof crearConexionPostgres> | undefined;
  try {
    if (!['postgresql:', 'postgres:'].includes(new URL(url).protocol)) throw new Error();
    const conexion = crearConexionPostgres(url);
    sql = conexion;
    await sembrarPostgres(conexion, ahora, esquema);
    return { repos: crearRepositoriosPostgres(conexion, esquema), cerrar: () => conexion.end({ timeout: 3 }) };
  } catch {
    if (sql) await sql.end({ timeout: 3 }).catch(() => {});
    throw new Error('No se pudo iniciar PostgreSQL.');
  }
}
