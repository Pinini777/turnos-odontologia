import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { conEsquema } from './esquema';

const cli = fileURLToPath(new URL('../../src/shared/persistencia/migrar-cli.ts', import.meta.url));

it('el migrador falla sin DATABASE_URL y no muestra detalles internos', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.TEST_DATABASE_URL;
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', cli], { env, encoding: 'utf8' });

  expect(resultado.status).toBe(1);
  expect(resultado.stdout).toBe('');
  expect(resultado.stderr.trim()).toBe('DATABASE_URL no está configurada.');
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('migraciones PostgreSQL con un esquema propio', () => {
  it('aplica en orden, protege el registro y no reaplica las migraciones', async () => {
    const { migrarEsquema } = await import('../../src/shared/persistencia/migraciones');
    await conEsquema(async (sql, esquema) => {
      const cambios = [
        { nombre: '20260101000002_extender.sql', contenido: 'alter table prueba_migrar add column valor text' },
        { nombre: '20260101000001_crear.sql', contenido: 'create table prueba_migrar (id integer primary key)' },
      ];
      expect(await migrarEsquema(sql, esquema, cambios)).toBe(2);
      expect(await migrarEsquema(sql, esquema, cambios)).toBe(0);
      const filas = await sql<{ nombre: string }[]>`select nombre from ${sql(esquema)}.schema_migrations order by nombre`;
      expect(filas.map(fila => fila.nombre)).toEqual(cambios.map(cambio => cambio.nombre).sort());
      const [seguridad] = await sql<{ rls: boolean; anon: boolean }[]>`
        select c.relrowsecurity as rls, has_table_privilege('anon', c.oid, 'SELECT') as anon
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${esquema} and c.relname = 'schema_migrations'`;
      expect(seguridad).toEqual({ rls: true, anon: false });
    });
  }, 20_000);

  it('revierte el SQL de la migración fallida y no la registra', async () => {
    const { migrarEsquema } = await import('../../src/shared/persistencia/migraciones');
    await conEsquema(async (sql, esquema) => {
      await migrarEsquema(sql, esquema, []);
      await expect(migrarEsquema(sql, esquema, [{
        nombre: '20260101000001_falla.sql',
        contenido: 'create table prueba_reversion (id integer); select * from tabla_inexistente;',
      }])).rejects.toThrow();
      const [registro] = await sql<{ filas: number; revierte: boolean }[]>`
        select count(*)::int as filas, to_regclass(${`${esquema}.prueba_reversion`}) is null as revierte
        from ${sql(esquema)}.schema_migrations`;
      expect(registro).toEqual({ filas: 0, revierte: true });
    });
  }, 20_000);
});
