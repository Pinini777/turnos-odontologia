import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { SEED } from '../../src/shared/seed';
import { SEED_DEMO } from '../../src/shared/seed-demo';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { abrirRepositorios } from '../../src/shared/persistencia/arranque';
import { crearRepositoriosPostgres, TABLAS_APLICACION } from '../../src/shared/persistencia/repositorios-postgres';
import { conBase, type BasePrueba } from './esquema';

const ahora = new Date('2027-01-04T12:00:00Z');

async function conApiPostgres(
  esquema: string,
  probar: (app: FastifyInstance, repos: Awaited<ReturnType<typeof abrirRepositorios>>['repos']) => Promise<void>,
): Promise<void> {
  const activos = await abrirRepositorios(process.env.TEST_DATABASE_URL!, ahora, esquema);
  let app: FastifyInstance | undefined;
  try {
    app = await buildApp({ repos: activos.repos });
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    await probar(app, activos.repos);
  } finally {
    try {
      if (app) await app.close();
    } finally {
      await activos.cerrar();
    }
  }
}

async function esperarTablasVacias(base: BasePrueba): Promise<void> {
  for (const tabla of TABLAS_APLICACION) {
    const [fila] = await base.sql<{ existe: boolean }[]>`
      select exists(select 1 from ${base.sql(base.esquema)}.${base.sql(tabla)}) as existe
    `;
    expect(fila?.existe, `La tabla ${tabla} debe permanecer vacía`).toBe(false);
  }
}

describe('Semilla de datos ficticios', () => {
  it('Contenido de la semilla', async () => {
    const repos = crearRepositoriosEnMemoria();
    expect((await repos.profesionales.listar()).map(({ nombre }) => nombre).sort()).toEqual([
      'Dr. Bruno Gómez', 'Dra. Ana Pérez',
    ].sort());
    expect((await repos.boxes.listar()).map(({ nombre }) => nombre).sort()).toEqual(['Box 1', 'Box 2']);
    expect((await repos.prestaciones.listar()).map(({ nombre, duracionMin }) => [nombre, duracionMin]).sort()).toEqual([
      ['Consulta', 30], ['Limpieza', 45], ['Extracción simple', 60], ['Control', 15],
    ].sort());

    const horarios = await repos.horarios.listar();
    expect(horarios).toHaveLength(20);
    for (const profesional of await repos.profesionales.listar()) {
      const delProfesional = horarios.filter(horario => horario.profesionalId === profesional.id);
      expect(delProfesional).toHaveLength(10);
      expect(new Set(delProfesional.map(({ diaSemana }) => diaSemana))).toEqual(new Set([1, 2, 3, 4, 5]));
      expect(delProfesional.every(({ desde, hasta }) =>
        (desde === '09:00' && hasta === '13:00') || (desde === '15:00' && hasta === '19:00'))).toBe(true);
    }
    for (const prestacion of await repos.prestaciones.listar()) expect(prestacion.duracionMin % 15).toBe(0);
  });

  it('Pacientes y usuarios ficticios', async () => {
    const repos = crearRepositoriosEnMemoria();
    const pacientes = await repos.pacientes.listar();
    const usuarios = await repos.usuarios.listar();

    expect(pacientes.length).toBeGreaterThan(0);
    expect(usuarios.length).toBeGreaterThan(0);
    expect(pacientes.every(({ nombre, apellido, documento, email }) =>
      `${nombre} ${apellido}`.startsWith('Paciente Ficticio') &&
      /^0000000\d$/.test(documento) && email.endsWith('@example.com'))).toBe(true);
    expect(usuarios.every(({ email }) => email.endsWith('@example.com'))).toBe(true);
  });

  it('Sin contraseñas en claro', async () => {
    const usuarios = await crearRepositoriosEnMemoria().usuarios.listar();
    expect(usuarios.length).toBeGreaterThan(0);
    expect(usuarios.every(({ hashPassword }) => /^\$2[aby]\$\d{2}\$/.test(hashPassword))).toBe(true);
  });
});

// Sembrar la demo completa son unas 150 escrituras por el pooler remoto; con los archivos en paralelo supera el minuto.
const TIMEOUT_SIEMBRA = 120_000;

describe.skipIf(!process.env.TEST_DATABASE_URL)('Siembra inicial en PostgreSQL', () => {
  it('Primer arranque con tablas vacías', async () => {
    const base = await conBase();
    try {
      await conApiPostgres(base.esquema, async (_app, repos) => {
        expect(await repos.pacientes.buscarPorId(SEED_DEMO.pacientes.santos.id)).toEqual(SEED_DEMO.pacientes.santos);
        expect(await repos.usuarios.buscarPorId(SEED_DEMO.usuarios[0]!.id)).toEqual(SEED_DEMO.usuarios[0]);
        expect(await repos.profesionales.listar()).toHaveLength(2);
        expect(await repos.boxes.listar()).toHaveLength(2);
        expect(await repos.prestaciones.listar()).toHaveLength(4);
        expect((await repos.horarios.listar()).length).toBeGreaterThan(0);
        expect((await repos.turnos.listar()).length).toBeGreaterThan(0);
        expect((await repos.auditoria.listar()).length).toBeGreaterThan(0);
      });
    } finally {
      await base.cerrar();
    }
  }, TIMEOUT_SIEMBRA);

  it('No se puede completar la semilla', async () => {
    const base = await conBase();
    try {
      await base.sql`alter table ${base.sql(base.esquema)}.estados_pieza add constraint prueba_semilla_invalida check (false)`;
      const { sembrarPostgres } = await import('../../src/shared/persistencia/sembrar');
      await expect(sembrarPostgres(base.sql, ahora, base.esquema)).rejects.toThrow();
      await esperarTablasVacias(base);
    } finally {
      await base.cerrar();
    }
  }, TIMEOUT_SIEMBRA);

  it('Reinicio con datos existentes', async () => {
    const base = await conBase();
    try {
      let turnosAntes: Awaited<ReturnType<Awaited<ReturnType<typeof abrirRepositorios>>['repos']['turnos']['listar']>>;
      let auditoriaAntes: Awaited<ReturnType<Awaited<ReturnType<typeof abrirRepositorios>>['repos']['auditoria']['listar']>>;
      const pacienteModificado = { ...SEED_DEMO.pacientes.santos, telefono: '0000-000999' };
      await conApiPostgres(base.esquema, async (_app, repos) => {
        turnosAntes = await repos.turnos.listar();
        auditoriaAntes = await repos.auditoria.listar();
        await repos.pacientes.guardar(pacienteModificado);
      });
      await conApiPostgres(base.esquema, async (_app, repos) => {
        expect(await repos.pacientes.buscarPorId(pacienteModificado.id)).toEqual(pacienteModificado);
        expect(await repos.turnos.listar()).toStrictEqual(turnosAntes);
        expect(await repos.auditoria.listar()).toStrictEqual(auditoriaAntes);
        // La siembra carga SEED más los pacientes y usuarios de la demo, una sola vez.
        expect(await repos.pacientes.listar()).toHaveLength(Object.keys(SEED.pacientes).length + Object.keys(SEED_DEMO.pacientes).length);
        expect(await repos.usuarios.listar()).toHaveLength(Object.keys(SEED.usuarios).length + SEED_DEMO.usuarios.length);
      });
    } finally {
      await base.cerrar();
    }
  }, TIMEOUT_SIEMBRA);

  it('Base existente al iniciar en PostgreSQL', async () => {
    const base = await conBase();
    try {
      const box = { id: randomUUID(), nombre: 'Box ficticio existente', activo: true };
      await crearRepositoriosPostgres(base.sql, base.esquema).boxes.guardar(box);
      await conApiPostgres(base.esquema, async (_app, repos) => {
        expect(await repos.boxes.listar()).toEqual([box]);
        expect(await repos.usuarios.listar()).toEqual([]);
        expect(await repos.pacientes.listar()).toEqual([]);
      });
    } finally {
      await base.cerrar();
    }
  }, TIMEOUT_SIEMBRA);

  it('Falla la siembra inicial en PostgreSQL', async () => {
    const base = await conBase();
    let activos: Awaited<ReturnType<typeof abrirRepositorios>> | undefined;
    try {
      await base.sql`alter table ${base.sql(base.esquema)}.estados_pieza add constraint prueba_inicio_invalido check (false)`;
      let error: unknown;
      try {
        activos = await abrirRepositorios(process.env.TEST_DATABASE_URL!, ahora, base.esquema);
      } catch (fallo: unknown) {
        error = fallo;
      }
      expect(error).toMatchObject({ message: 'No se pudo iniciar PostgreSQL.' });
      await esperarTablasVacias(base);
    } finally {
      if (activos) await activos.cerrar();
      await base.cerrar();
    }
  }, TIMEOUT_SIEMBRA);
});
