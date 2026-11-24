import { describe, expect, it } from 'vitest';
import { SEED_DEMO } from '../../src/shared/seed-demo';
import { conBase } from './esquema';

const ahora = new Date('2027-01-04T12:00:00Z');

it('mantiene la demo en memoria sin DATABASE_URL', async () => {
  const { abrirRepositorios } = await import('../../src/shared/persistencia/arranque');
  const { repos, cerrar } = await abrirRepositorios(undefined, ahora);
  expect(await repos.pacientes.buscarPorId(SEED_DEMO.pacientes.santos.id)).toEqual(SEED_DEMO.pacientes.santos);
  await expect(cerrar()).resolves.toBeUndefined();
});

it('no cae a memoria ante una configuración inviable ni muestra el valor', async () => {
  const { abrirRepositorios } = await import('../../src/shared/persistencia/arranque');
  await expect(abrirRepositorios('cadena-inválida-ficticia', ahora)).rejects.toThrow('No se pudo iniciar PostgreSQL.');
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('arranque PostgreSQL', () => {
  it('mantiene el estado entre dos arranques y libera el pool al cerrar', async () => {
    const { abrirRepositorios } = await import('../../src/shared/persistencia/arranque');
    await conBase(async (_sql, esquema) => {
      const primero = await abrirRepositorios(process.env.TEST_DATABASE_URL, ahora, esquema);
      const original = await primero.repos.pacientes.buscarPorId(SEED_DEMO.pacientes.santos.id);
      if (!original) throw new Error('Falta la semilla demo de prueba.');
      try {
        await primero.repos.pacientes.guardar({ ...original, telefono: '0000-000201' });
      } finally {
        await primero.cerrar();
      }
      await expect(primero.repos.pacientes.buscarPorId(original.id)).rejects.toThrow();
      const segundo = await abrirRepositorios(process.env.TEST_DATABASE_URL, ahora, esquema);
      try {
        expect(await segundo.repos.pacientes.buscarPorId(original.id)).toEqual({ ...original, telefono: '0000-000201' });
      } finally {
        await segundo.cerrar();
      }
    });
  }, 90_000);
});
