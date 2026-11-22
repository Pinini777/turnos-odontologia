import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { registrarRutasCatalogos } from '../../src/modules/configuracion/rutas-catalogos';
import { FixedClock } from '../../src/shared/clock';
import { SEED } from '../../src/shared/seed';
import { authDeTest, MODULOS_DE_PRUEBA } from '../plataforma/helpers';

const con = (token: string) => ({ authorization: `Bearer ${token}` });

let app: FastifyInstance | undefined;

async function crearAppDePrueba(): Promise<FastifyInstance> {
  app = await buildApp({
    auth: authDeTest,
    clock: new FixedClock('2026-11-23T12:00:00Z'),
    modulesDir: MODULOS_DE_PRUEBA,
  });
  await app.register(registrarRutasCatalogos, { prefix: '/api' });
  return app;
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('Gestión de prestaciones y visibilidad de precios', () => {
  it('Alta de prestación válida y listado según rol: profesional ve precio, recepcionista lo omite', async () => {
    const servidor = await crearAppDePrueba();

    const alta = await servidor.inject({
      method: 'POST',
      url: '/api/prestaciones',
      headers: con('prof'),
      payload: {
        nombre: 'Blanqueamiento',
        duracionMin: 30,
        precio: 18000,
      },
    });

    expect(alta.statusCode).toBe(201);
    const creada = alta.json();
    expect(creada).toMatchObject({
      nombre: 'Blanqueamiento',
      duracionMin: 30,
      precio: 18000,
      reservableOnline: true,
      activa: true,
    });
    expect(typeof creada.id).toBe('string');

    const comoProf = await servidor.inject({
      method: 'GET',
      url: '/api/prestaciones',
      headers: con('prof'),
    });
    expect(comoProf.statusCode).toBe(200);
    expect(comoProf.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: creada.id,
          nombre: 'Blanqueamiento',
          duracionMin: 30,
          precio: 18000,
          reservableOnline: true,
          activa: true,
        }),
      ]),
    );

    const comoRecep = await servidor.inject({
      method: 'GET',
      url: '/api/prestaciones',
      headers: con('recep'),
    });
    expect(comoRecep.statusCode).toBe(200);
    expect(comoRecep.body).not.toContain('precio');
    const listaRecep: Array<Record<string, unknown>> = comoRecep.json();
    expect(listaRecep.length).toBeGreaterThanOrEqual(5);
    for (const item of listaRecep) {
      expect('precio' in item).toBe(false);
    }
    expect(listaRecep).toEqual(
      expect.arrayContaining([
        {
          id: creada.id,
          nombre: 'Blanqueamiento',
          duracionMin: 30,
          reservableOnline: true,
          activa: true,
        },
      ]),
    );
  });

  it('Duración inválida no múltiplo de 15 o no positiva al crear: responde 409 DURACION_INVALIDA', async () => {
    const servidor = await crearAppDePrueba();

    for (const duracionMin of [20, 0, -15, 15.5]) {
      const res = await servidor.inject({
        method: 'POST',
        url: '/api/prestaciones',
        headers: con('prof'),
        payload: {
          nombre: `Prestación inválida ${duracionMin}`,
          duracionMin,
          precio: 12000,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ code: 'DURACION_INVALIDA' });
    }
  });

  it('Duración inválida no múltiplo de 15 o no positiva al editar: responde 409 DURACION_INVALIDA', async () => {
    const servidor = await crearAppDePrueba();

    for (const duracionMin of [20, 0, -30]) {
      const res = await servidor.inject({
        method: 'PATCH',
        url: `/api/prestaciones/${SEED.prestaciones.consulta.id}`,
        headers: con('prof'),
        payload: { duracionMin },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ code: 'DURACION_INVALIDA' });
    }
  });

  it('Formato inválido (precio negativo o nombre vacío): responde 400 FORMATO_INVALIDO', async () => {
    const servidor = await crearAppDePrueba();

    const precioNegativo = await servidor.inject({
      method: 'POST',
      url: '/api/prestaciones',
      headers: con('prof'),
      payload: {
        nombre: 'Consulta gratuita mal cargada',
        duracionMin: 15,
        precio: -100,
      },
    });
    expect(precioNegativo.statusCode).toBe(400);
    expect(precioNegativo.json().code).toBe('FORMATO_INVALIDO');

    const nombreVacio = await servidor.inject({
      method: 'POST',
      url: '/api/prestaciones',
      headers: con('prof'),
      payload: {
        nombre: '   ',
        duracionMin: 15,
        precio: 0,
      },
    });
    expect(nombreVacio.statusCode).toBe(400);
    expect(nombreVacio.json().code).toBe('FORMATO_INVALIDO');
  });

  it('Modificar precio de prestación no altera turnos existentes (RN-GA-02)', async () => {
    const servidor = await crearAppDePrueba();
    const turnoId = '00000000-0000-4000-8000-000000000901';

    await servidor.deps.repos.turnos.guardar({
      id: turnoId,
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
      prestacionId: SEED.prestaciones.consulta.id,
      pacienteId: SEED.pacientes.uno.id,
      inicio: new Date('2026-11-23T12:00:00Z'),
      fin: new Date('2026-11-23T12:30:00Z'),
      estado: 'reservado',
      origen: 'recepcion',
      precioAlReservar: 15000,
      creadoPor: SEED.usuarios.recepcion.id,
      creadoEn: new Date('2026-11-23T11:00:00Z'),
    });

    const patchRes = await servidor.inject({
      method: 'PATCH',
      url: `/api/prestaciones/${SEED.prestaciones.consulta.id}`,
      headers: con('prof'),
      payload: { precio: 22000 },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json()).toMatchObject({
      id: SEED.prestaciones.consulta.id,
      precio: 22000,
    });

    const turnoGuardado = await servidor.deps.repos.turnos.buscarPorId(turnoId);
    expect(turnoGuardado?.precioAlReservar).toBe(15000);
  });

  it('Permisos y 404 en prestaciones: recepcionista no escribe, paciente no lista, ID inexistente da 404', async () => {
    const servidor = await crearAppDePrueba();

    const postRecep = await servidor.inject({
      method: 'POST',
      url: '/api/prestaciones',
      headers: con('recep'),
      payload: { nombre: 'Ortodoncia', duracionMin: 30, precio: 30000 },
    });
    expect(postRecep.statusCode).toBe(403);
    expect(postRecep.json()).toEqual({ code: 'SIN_PERMISO' });

    const patchRecep = await servidor.inject({
      method: 'PATCH',
      url: `/api/prestaciones/${SEED.prestaciones.consulta.id}`,
      headers: con('recep'),
      payload: { precio: 99999 },
    });
    expect(patchRecep.statusCode).toBe(403);
    expect(patchRecep.json()).toEqual({ code: 'SIN_PERMISO' });

    const getPac = await servidor.inject({
      method: 'GET',
      url: '/api/prestaciones',
      headers: con('pac'),
    });
    expect(getPac.statusCode).toBe(403);
    expect(getPac.json()).toEqual({ code: 'SIN_PERMISO' });

    const patchInexistente = await servidor.inject({
      method: 'PATCH',
      url: '/api/prestaciones/00000000-0000-4000-8000-999999999997',
      headers: con('prof'),
      payload: { precio: 20000 },
    });
    expect(patchInexistente.statusCode).toBe(404);
    expect(patchInexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('Catálogo público de prestaciones', () => {
  it('GET /api/public/prestaciones sin token filtra inactivas y no reservables y nunca incluye precio', async () => {
    const servidor = await crearAppDePrueba();

    // Desactivamos Control (que era activa y reservableOnline: true)
    const desactivar = await servidor.inject({
      method: 'PATCH',
      url: `/api/prestaciones/${SEED.prestaciones.control.id}`,
      headers: con('prof'),
      payload: { activa: false },
    });
    expect(desactivar.statusCode).toBe(200);

    // Consulta pública sin header Authorization
    const res = await servidor.inject({
      method: 'GET',
      url: '/api/public/prestaciones',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('precio');

    const publicas: Array<Record<string, unknown>> = res.json();
    const ids = publicas.map((p) => p.id);

    // Incluye Consulta y Limpieza (activas y reservables online)
    expect(ids).toContain(SEED.prestaciones.consulta.id);
    expect(ids).toContain(SEED.prestaciones.limpieza.id);
    // Excluye Extracción simple (reservableOnline: false) y Control (activa: false)
    expect(ids).not.toContain(SEED.prestaciones.extraccion.id);
    expect(ids).not.toContain(SEED.prestaciones.control.id);
    expect(publicas).toHaveLength(2);

    for (const item of publicas) {
      expect('precio' in item).toBe(false);
      expect(item.activa).toBe(true);
      expect(item.reservableOnline).toBe(true);
    }
  });
});
