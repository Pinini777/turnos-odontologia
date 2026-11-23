import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import {
  authLocal,
  guardarTurnosDeGanancias,
  PERIODO_ISO,
  turnoDeGanancias,
} from './fixtures';

const con = (token: 'prof' | 'recep' | 'pac' | 'prof-bruno') => ({ authorization: `Bearer ${token}` });

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

/** API real (src/modules, autoload incluido) con la auth local y los turnos dados. */
async function armar(turnos: Turno[] = []) {
  const repos = crearRepositoriosEnMemoria();
  for (const turno of turnos) await repos.turnos.guardar(turno);
  const app = await buildApp({ auth: authLocal, repos });
  apps.push(app);
  return { app, repos };
}

const urlGanancias = (id: string, desde: string = PERIODO_ISO.desde, hasta: string = PERIODO_ISO.hasta) =>
  `/api/profesionales/${id}/ganancias?desde=${desde}&hasta=${hasta}`;

/** Tres atendidos de Ana en el período: 15000 + 25000 + 10000 = 50000 (escenario 1). */
const tresAtendidosDeAna = (): Turno[] => [
  turnoDeGanancias({
    id: 'ana-1', precioAlReservar: 15000,
    inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T12:30:00Z'),
  }),
  turnoDeGanancias({
    id: 'ana-2', precioAlReservar: 25000,
    inicio: new Date('2026-11-23T13:00:00Z'), fin: new Date('2026-11-23T13:45:00Z'),
  }),
  turnoDeGanancias({
    id: 'ana-3', precioAlReservar: 10000,
    inicio: new Date('2026-11-23T15:00:00Z'), fin: new Date('2026-11-23T15:15:00Z'),
  }),
];

describe('GET /api/profesionales/:id/ganancias', () => {
  it('devuelve 200 con el total del período: 15000 + 25000 + 10000 = 50000', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 50000 });
  });

  it('se publica sola bajo /api por el autoload: responde 200 y no 404', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnosDeGanancias(repos);
    const app = await buildApp({ auth: authLocal, repos });
    apps.push(app);

    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
      headers: con('prof'),
    });

    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 25000 });
  });

  it('un período sin turnos atendidos devuelve 200 con total 0, no un error', async () => {
    const { app } = await armar();
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id, '2026-11-30T12:00:00Z', '2026-11-30T16:00:00Z'),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 0 });
  });
});

describe('GET /api/profesionales/:id/ganancias · acceso', () => {
  it('sin Authorization → 401 NO_AUTENTICADO', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('la recepcionista no ve ganancias → 403 SIN_PERMISO', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
      headers: con('recep'),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('el paciente no ve ganancias → 403 SIN_PERMISO', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
      headers: con('pac'),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('otro profesional (Bruno pidiendo a Ana) → 403 SIN_PERMISO', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(SEED.profesionales.anaPerez.id),
      headers: con('prof-bruno'),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('un id inexistente con sesión de Ana → 403 SIN_PERMISO, igual que uno ajeno', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias('00000000-0000-4000-8000-000000009999'),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });
});

describe('GET /api/profesionales/:id/ganancias · validación de query', () => {
  const idDeAna = SEED.profesionales.anaPerez.id;

  it('desde mayor o igual que hasta → 400 FORMATO_INVALIDO con detalle sobre hasta', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(idDeAna, '2026-11-23T16:00:00Z', '2026-11-23T12:00:00Z'),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('hasta');
  });

  it('desde igual a hasta → 400 FORMATO_INVALIDO con detalle sobre hasta', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(idDeAna, PERIODO_ISO.desde, PERIODO_ISO.desde),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('hasta');
  });

  it('falta desde → 400 con un detalle sobre desde', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${idDeAna}/ganancias?hasta=${PERIODO_ISO.hasta}`,
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('desde');
  });

  it('falta hasta → 400 con un detalle sobre hasta', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${idDeAna}/ganancias?desde=${PERIODO_ISO.desde}`,
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('hasta');
  });

  it('desde sin hora ni offset (2026-11-23) → 400 con un detalle sobre desde', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: urlGanancias(idDeAna, '2026-11-23', PERIODO_ISO.hasta),
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('desde');
  });

  it('hasta que no es un instante (mañana) → 400 con un detalle sobre hasta', async () => {
    const { app } = await armar(tresAtendidosDeAna());
    const res = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${idDeAna}/ganancias?desde=${PERIODO_ISO.desde}&hasta=manana`,
      headers: con('prof'),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; detalles: { campo: string }[] }>();
    expect(body.code).toBe('FORMATO_INVALIDO');
    expect(body.detalles.map((detalle) => detalle.campo)).toContain('hasta');
  });
});
