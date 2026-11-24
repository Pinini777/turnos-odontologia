import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { conBase, conEsquema, TIMEOUT_POSTGRES } from './esquema';
import type { BasePrueba } from './esquema';
import { cargarBase, inicio, turnoFicticio } from './fixtures';
import { verificarContratoComun } from './contrato';

const postgresHabilitado = Boolean(process.env.TEST_DATABASE_URL);

async function conPostgres<T>(probar: (base: BasePrueba) => Promise<T>): Promise<T> {
  const base = await conBase();
  try { return await probar(base); }
  finally { await base.cerrar(); }
}

describe('Contrato de persistencia', () => {
  it('Contrato común de lectura y escritura', async () => {
    await verificarContratoComun(crearRepositoriosEnMemoria({ seed: false }));
  });

  it.skipIf(!postgresHabilitado)('Upsert, ausencia y representación de datos', async () => conPostgres(async ({ sql, esquema }) => {
      const { crearRepositoriosPostgres } = await import('../../src/shared/persistencia/repositorios-postgres');
      const repos = crearRepositoriosPostgres(sql, esquema);
      await cargarBase(repos);

      const paciente = SEED.pacientes.dos;
      await repos.pacientes.guardar(paciente);
      await repos.pacientes.guardar({ ...paciente, telefono: '0000-000202' });
      expect(await repos.pacientes.listar(p => p.id === paciente.id)).toEqual([{ ...paciente, telefono: '0000-000202' }]);
      expect(await repos.pacientes.buscarPorId(paciente.id)).toStrictEqual({ ...paciente, telefono: '0000-000202' });
      expect(await repos.pacientes.buscarPorId(randomUUID())).toBeUndefined();

      const prestacion = { ...SEED.prestaciones.control, id: randomUUID(), nombre: 'Control de prueba', precio: 15000.25 };
      await repos.prestaciones.guardar(prestacion);
      expect(await repos.prestaciones.buscarPorId(prestacion.id)).toStrictEqual(prestacion);
      expect(await repos.prestaciones.listar()).toHaveLength(Object.keys(SEED.prestaciones).length + 1);

      const auditoria = {
        id: randomUUID(), turnoId: randomUUID(), accion: 'creado' as const, actor: 'paciente', fecha: inicio,
        detalle: { fecha: inicio, lista: [new Date('2027-01-04T12:30:00Z')], literal: inicio.toISOString() },
      };
      const turnoPersistido = turnoFicticio();
      await repos.turnos.guardar(turnoPersistido);
      await repos.auditoria.agregar({ ...auditoria, turnoId: turnoPersistido.id });
      const [recuperada] = await repos.auditoria.listar(a => a.id === auditoria.id);
      expect(recuperada?.detalle).toEqual({
        fecha: inicio, lista: [new Date('2027-01-04T12:30:00Z')], literal: inicio.toISOString(),
      });
      expect(recuperada?.detalle.literal).toBeTypeOf('string');
  }), TIMEOUT_POSTGRES);

  describe.skipIf(!postgresHabilitado)('Contrato PostgreSQL', () => {
    it('Suite PostgreSQL habilitada', async () => conPostgres(async ({ sql, esquema }) => {
      expect(esquema).toMatch(/^test_[0-9a-f]{32}$/);
      const { crearRepositoriosPostgres, TABLAS_APLICACION } = await import('../../src/shared/persistencia/repositorios-postgres');
      const repos = crearRepositoriosPostgres(sql, esquema);
      await verificarContratoComun(repos);
      const tablas = await sql<{ nombre: string }[]>`
        select c.relname as nombre from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${esquema} and c.relkind = 'r'`;
      expect(tablas.map(f => f.nombre).sort()).toEqual([...TABLAS_APLICACION, 'schema_migrations'].sort());
    }), TIMEOUT_POSTGRES);

    it('Documento o correo único duplicado', async () => conPostgres(async ({ sql, esquema }) => {
      const { crearRepositoriosPostgres } = await import('../../src/shared/persistencia/repositorios-postgres');
      const repos = crearRepositoriosPostgres(sql, esquema);
      await cargarBase(repos);
      await expect(repos.usuarios.guardar({
        ...SEED.usuarios.paciente1, id: randomUUID(), email: ' PACIENTE1@EXAMPLE.COM ',
      })).rejects.toMatchObject({ code: 'DUPLICADO' });
      await expect(repos.pacientes.guardar({
        ...SEED.pacientes.dos, id: randomUUID(), documento: SEED.pacientes.uno.documento, email: 'otro@example.com',
      })).rejects.toMatchObject({ code: 'DUPLICADO' });
      await expect(repos.pacientes.guardar({
        ...SEED.pacientes.dos, id: randomUUID(), documento: '00000991', email: SEED.pacientes.uno.email,
      })).rejects.toMatchObject({ code: 'DUPLICADO' });
      expect(await repos.usuarios.buscarPorId(SEED.usuarios.paciente1.id)).toEqual(SEED.usuarios.paciente1);
      expect(await repos.pacientes.buscarPorId(SEED.pacientes.uno.id)).toEqual(SEED.pacientes.uno);
    }), TIMEOUT_POSTGRES);

    it('Una cuenta conserva el correo de su propia ficha', async () => conPostgres(async ({ sql, esquema }) => {
      const { crearRepositoriosPostgres } = await import('../../src/shared/persistencia/repositorios-postgres');
      const repos = crearRepositoriosPostgres(sql, esquema);
      await cargarBase(repos);
      const ficha = {
        id: randomUUID(), nombre: 'Paciente Ficticio Vinculación', apellido: 'Prueba', documento: '00000992',
        email: 'vinculacion@example.com',
      };
      await repos.pacientes.guardar(ficha);
      const app = await buildApp({ repos, clock: new FixedClock(inicio) });
      try {
        const respuesta = await app.inject({
          method: 'POST', url: '/api/public/pacientes/registro',
          payload: { ...ficha, password: 'clave-ficticia-de-prueba' },
        });
        expect(respuesta.statusCode).toBe(201);
        const paciente = await repos.pacientes.buscarPorId(ficha.id);
        expect(paciente?.usuarioId).toBeTypeOf('string');
        expect(await repos.usuarios.buscarPorId(paciente?.usuarioId ?? '')).toMatchObject({ email: ficha.email });
      } finally { await app.close(); }
    }), TIMEOUT_POSTGRES);
  });

  it.skipIf(!postgresHabilitado)('Un test PostgreSQL falla', async () => {
    let esquemaFallido = '';
    await expect(conEsquema(async (_sql, esquema) => {
      esquemaFallido = esquema;
      throw new Error('Falla ficticia de prueba');
    })).rejects.toThrow('Falla ficticia de prueba');
    await conEsquema(async (sql, esquema) => {
      expect(esquema).not.toBe(esquemaFallido);
      const [fila] = await sql<{ eliminado: boolean }[]>`select to_regnamespace(${esquemaFallido}) is null as eliminado`;
      expect(fila?.eliminado).toBe(true);
    });
  }, TIMEOUT_POSTGRES);
});
