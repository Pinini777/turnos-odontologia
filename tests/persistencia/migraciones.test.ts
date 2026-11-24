import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrarEsquema } from '../../src/shared/persistencia/migraciones';
import { conBase, conEsquema, migracionesDeAplicacion, TIMEOUT_POSTGRES, type BasePrueba } from './esquema';

const tablasEsperadas = [
  'auditoria', 'bloqueos', 'boxes', 'estados_pieza', 'historia_clinica', 'horarios',
  'odontogramas', 'pacientes', 'prestaciones', 'profesionales', 'schema_migrations', 'turnos', 'usuarios',
];

describe.skipIf(!process.env.TEST_DATABASE_URL)('migraciones PostgreSQL', () => {
  it('Primera migración autorizada', async () => {
    await conEsquema(async (sql, esquema) => {
      const cambios = await migracionesDeAplicacion();
      expect(cambios.length).toBeGreaterThan(0);
      expect(await migrarEsquema(sql, esquema, cambios)).toBe(cambios.length);

      const tablas = await sql<{ nombre: string; rls: boolean; expuesta: boolean }[]>`
        select c.relname as nombre, c.relrowsecurity as rls,
          has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
          or has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
          or exists (select 1 from pg_policy p where p.polrelid = c.oid) as expuesta
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${esquema} and c.relkind = 'r'
        order by c.relname`;
      expect(tablas).toEqual(tablasEsperadas.map(nombre => ({ nombre, rls: true, expuesta: false })));

      const barreras = await sql<{ nombre: string }[]>`
        select conname as nombre from pg_constraint
        where connamespace = ${esquema}::regnamespace and contype = 'x' order by nombre`;
      expect(barreras.map(fila => fila.nombre)).toEqual([
        'turnos_box_sin_solapamiento', 'turnos_profesional_sin_solapamiento',
      ]);
      const historial = await sql<{ nombre: string }[]>`
        select t.tgname as nombre from pg_trigger t join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${esquema} and not t.tgisinternal order by nombre`;
      expect(historial.map(fila => fila.nombre)).toEqual([
        'auditoria_inmutable', 'estados_pieza_inmutables', 'historia_clinica_inmutable', 'turnos_sin_borrado',
      ]);

      const registro = await sql<{ nombre: string }[]>`
        select nombre from ${sql(esquema)}.schema_migrations order by nombre`;
      expect(registro.map(fila => fila.nombre)).toEqual(cambios.map(cambio => cambio.nombre).sort());
    });
  }, TIMEOUT_POSTGRES);

  describe('esquema actualizado', () => {
    let base: BasePrueba | undefined;
    beforeAll(async () => { base = await conBase(); }, TIMEOUT_POSTGRES);
    afterAll(async () => { await base?.cerrar(); }, TIMEOUT_POSTGRES);

    it('Segunda ejecución sin pendientes', async () => {
      if (!base) throw new Error('No se preparó el esquema de migración.');
      const { sql, esquema } = base;
      const id = '00000000-0000-4000-8000-000000009901';
      await sql`insert into ${sql(esquema)}.boxes (id, nombre, activo) values (${id}, 'Box ficticio', true)`;
      const registro = () => sql`select * from ${sql(esquema)}.schema_migrations order by nombre`;
      const cajas = () => sql`select id, nombre, activo from ${sql(esquema)}.boxes order by id`;
      const marcaAntes = await registro();
      const datosAntes = await cajas();

      expect(await migrarEsquema(sql, esquema, await migracionesDeAplicacion())).toBe(0);

      expect(marcaAntes.length).toBeGreaterThan(0);
      expect(datosAntes).toEqual([{ id, nombre: 'Box ficticio', activo: true }]);
      expect(await registro()).toEqual(marcaAntes);
      expect(await cajas()).toEqual(datosAntes);
    }, TIMEOUT_POSTGRES);
  });

  it('Falla una migración pendiente', async () => {
    await conBase(async (sql, esquema) => {
      const cambios = await migracionesDeAplicacion();
      const fallida = '99999999999999_falla.sql';
      const registro = () => sql`select nombre, aplicada_en from ${sql(esquema)}.schema_migrations order by nombre`;
      const aplicadoAntes = await registro();

      const salida = [
        vi.spyOn(console, 'log').mockImplementation(() => {}),
        vi.spyOn(console, 'warn').mockImplementation(() => {}),
        vi.spyOn(console, 'error').mockImplementation(() => {}),
      ];
      try {
        await expect(migrarEsquema(sql, esquema, [...cambios, {
          nombre: fallida,
          contenido: "create table prueba_reversion (id integer); select 'parametro_sintetico'::integer;",
        }])).rejects.toMatchObject({ code: '22P02' });
        for (const canal of salida) expect(canal).not.toHaveBeenCalled();
      } finally {
        for (const canal of salida) canal.mockRestore();
      }

      const [ddl] = await sql<{ estaAusente: boolean }[]>`
        select to_regclass(${`${esquema}.prueba_reversion`}) is null as "estaAusente"`;
      expect(ddl).toEqual({ estaAusente: true });
      expect(await registro()).toEqual(aplicadoAntes);
    });
  }, TIMEOUT_POSTGRES);
});
