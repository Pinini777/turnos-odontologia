import { readFile, readdir } from 'node:fs/promises';
import type postgres from 'postgres';
import { sqlDeTransaccion } from './conexion';

export interface Migracion {
  nombre: string;
  contenido: string;
}

const directorio = new URL('../../../supabase/migrations/', import.meta.url);
const nombreValido = /^\d{14}_[a-z0-9_-]+\.sql$/;
export const esEsquemaDePrueba = (esquema: string) => /^test_[0-9a-f]{32}$/.test(esquema);

export async function leerMigraciones(): Promise<Migracion[]> {
  const archivos = (await readdir(directorio, { withFileTypes: true }))
    .filter(archivo => archivo.isFile() && archivo.name.endsWith('.sql'));
  if (archivos.some(archivo => !nombreValido.test(archivo.name))) {
    throw new Error('Hay un archivo de migración con nombre inválido.');
  }
  return Promise.all(archivos.map(async ({ name }) => ({
    nombre: name,
    contenido: await readFile(new URL(name, directorio), 'utf8'),
  })));
}

export async function migrarEsquema(sql: postgres.Sql, esquema: string, cambios: readonly Migracion[]): Promise<number> {
  if (esquema !== 'public' && !esEsquemaDePrueba(esquema)) throw new Error('Esquema de migración inválido.');
  if (cambios.some(cambio => !nombreValido.test(cambio.nombre))
      || new Set(cambios.map(cambio => cambio.nombre)).size !== cambios.length) {
    throw new Error('La lista de migraciones es inválida.');
  }
  return sql.begin(async transaccion => {
    const tx = sqlDeTransaccion(transaccion);
    await tx`select pg_catalog.set_config('search_path', ${`${esquema}, extensions`}, true)`;
    const [destino] = await tx<{ valido: boolean }[]>`select current_schema() = ${esquema} as valido`;
    if (!destino?.valido) throw new Error('El esquema de destino no está disponible.');
    await tx`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${`turnos-odontologia:migraciones:${esquema}`}))`;
    await tx`create table if not exists schema_migrations (nombre text primary key, aplicada_en timestamptz not null default now())`;
    await tx`alter table schema_migrations enable row level security`;
    await tx`revoke all on table schema_migrations from public, anon, authenticated`;
    const aplicadas = new Set((await tx<{ nombre: string }[]>`select nombre from schema_migrations`).map(fila => fila.nombre));
    let cantidad = 0;
    for (const cambio of [...cambios].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
      if (aplicadas.has(cambio.nombre)) continue;
      // El contenido viene exclusivamente de migraciones versionadas en el repositorio.
      await tx.unsafe(cambio.contenido).simple();
      await tx`insert into schema_migrations (nombre) values (${cambio.nombre})`;
      cantidad++;
    }
    return cantidad;
  });
}
