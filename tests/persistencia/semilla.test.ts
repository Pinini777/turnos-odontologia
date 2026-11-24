import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SEED_DEMO } from '../../src/shared/seed-demo';
import { crearRepositoriosPostgres } from '../../src/shared/persistencia/repositorios-postgres';
import { conBase } from './esquema';

const ahora = new Date('2027-01-04T12:00:00Z');

describe.skipIf(!process.env.TEST_DATABASE_URL)('siembra PostgreSQL', () => {
  it('materializa la semilla base y demo una sola vez', async () => {
    const { sembrarPostgres } = await import('../../src/shared/persistencia/sembrar');
    await conBase(async (sql, esquema) => {
      const repos = crearRepositoriosPostgres(sql, esquema);
      expect(await sembrarPostgres(sql, ahora, esquema)).toBe(true);
      const turnos = await repos.turnos.listar();
      const auditoria = await repos.auditoria.listar();
      expect(turnos.length).toBeGreaterThan(0);
      expect(auditoria.length).toBeGreaterThan(0);
      expect(await repos.pacientes.buscarPorId(SEED_DEMO.pacientes.santos.id)).toEqual(SEED_DEMO.pacientes.santos);
      expect(await sembrarPostgres(sql, new Date('2028-01-03T12:00:00Z'), esquema)).toBe(false);
      expect(await repos.turnos.listar()).toStrictEqual(turnos);
      expect(await repos.auditoria.listar()).toStrictEqual(auditoria);
    });
  }, 90_000);

  it('no siembra cuando ya hay datos en cualquier tabla de aplicación', async () => {
    const { sembrarPostgres } = await import('../../src/shared/persistencia/sembrar');
    await conBase(async (sql, esquema) => {
      const repos = crearRepositoriosPostgres(sql, esquema);
      const box = { id: randomUUID(), nombre: 'Box de prueba', activo: true };
      await repos.boxes.guardar(box);
      expect(await sembrarPostgres(sql, ahora, esquema)).toBe(false);
      expect(await repos.boxes.listar()).toEqual([box]);
      expect(await repos.usuarios.listar()).toEqual([]);
    });
  }, 30_000);

  it('revierte todas las filas si falla una escritura de la siembra', async () => {
    const { sembrarPostgres } = await import('../../src/shared/persistencia/sembrar');
    await conBase(async (sql, esquema) => {
      await sql`alter table ${sql(esquema)}.pacientes add constraint prueba_falla check (false)`;
      await expect(sembrarPostgres(sql, ahora, esquema)).rejects.toThrow();
      const repos = crearRepositoriosPostgres(sql, esquema);
      expect(await repos.usuarios.listar()).toEqual([]);
      expect(await repos.pacientes.listar()).toEqual([]);
    });
  }, 60_000);
});
