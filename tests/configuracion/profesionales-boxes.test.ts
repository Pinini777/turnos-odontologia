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

describe('Gestión de profesionales', () => {
  it('Alta de profesional válido: responde 201 con activo true y aparece en GET /api/profesionales', async () => {
    const servidor = await crearAppDePrueba();

    const alta = await servidor.inject({
      method: 'POST',
      url: '/api/profesionales',
      headers: con('prof'),
      payload: {
        nombre: 'Dra. Carla Ficticia',
        matricula: 'MP 0099',
        usuarioId: '00000000-0000-4000-8000-000000000699',
      },
    });

    expect(alta.statusCode).toBe(201);
    const creado = alta.json();
    expect(creado).toMatchObject({
      nombre: 'Dra. Carla Ficticia',
      matricula: 'MP 0099',
      usuarioId: '00000000-0000-4000-8000-000000000699',
      activo: true,
    });
    expect(typeof creado.id).toBe('string');

    const listado = await servidor.inject({
      method: 'GET',
      url: '/api/profesionales',
      headers: con('recep'),
    });

    expect(listado.statusCode).toBe(200);
    expect(listado.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: SEED.profesionales.anaPerez.id }),
        expect.objectContaining({ id: creado.id, matricula: 'MP 0099' }),
      ]),
    );
  });

  it('Desactivación de profesional: PATCH con activo false responde 200 sin borrar físicamente', async () => {
    const servidor = await crearAppDePrueba();

    const res = await servidor.inject({
      method: 'PATCH',
      url: `/api/profesionales/${SEED.profesionales.brunoGomez.id}`,
      headers: con('prof'),
      payload: { activo: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: SEED.profesionales.brunoGomez.id,
      activo: false,
    });

    const listado = await servidor.inject({
      method: 'GET',
      url: '/api/profesionales',
      headers: con('prof'),
    });

    expect(listado.statusCode).toBe(200);
    expect(listado.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: SEED.profesionales.brunoGomez.id,
          activo: false,
        }),
      ]),
    );
  });

  it('Edición de profesional: permite actualizar nombre y conservar o cambiar su propia matrícula', async () => {
    const servidor = await crearAppDePrueba();

    const res = await servidor.inject({
      method: 'PATCH',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}`,
      headers: con('prof'),
      payload: {
        nombre: 'Dra. Ana Pérez Actualizada',
        matricula: 'mp 0001',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: SEED.profesionales.anaPerez.id,
      nombre: 'Dra. Ana Pérez Actualizada',
      matricula: 'mp 0001',
    });
  });

  it('Matrícula duplicada al crear o editar (case-insensitive y con espacios): responde 400 FORMATO_INVALIDO en matricula', async () => {
    const servidor = await crearAppDePrueba();

    const altaDuplicada = await servidor.inject({
      method: 'POST',
      url: '/api/profesionales',
      headers: con('prof'),
      payload: {
        nombre: 'Dr. Duplicado Ficticio',
        matricula: '  mp 0001  ',
        usuarioId: '00000000-0000-4000-8000-000000000700',
      },
    });

    expect(altaDuplicada.statusCode).toBe(400);
    expect(altaDuplicada.json().code).toBe('FORMATO_INVALIDO');
    expect(altaDuplicada.json().detalles).toEqual([
      expect.objectContaining({ campo: 'matricula' }),
    ]);

    const edicionDuplicada = await servidor.inject({
      method: 'PATCH',
      url: `/api/profesionales/${SEED.profesionales.brunoGomez.id}`,
      headers: con('prof'),
      payload: { matricula: 'MP 0001' },
    });

    expect(edicionDuplicada.statusCode).toBe(400);
    expect(edicionDuplicada.json().code).toBe('FORMATO_INVALIDO');
    expect(edicionDuplicada.json().detalles).toEqual([
      expect.objectContaining({ campo: 'matricula' }),
    ]);
  });

  it('Recepcionista intenta modificar profesionales: POST y PATCH responden 403 SIN_PERMISO', async () => {
    const servidor = await crearAppDePrueba();

    const postRes = await servidor.inject({
      method: 'POST',
      url: '/api/profesionales',
      headers: con('recep'),
      payload: {
        nombre: 'Dr. Sin Permiso',
        matricula: 'MP 0100',
        usuarioId: '00000000-0000-4000-8000-000000000701',
      },
    });
    expect(postRes.statusCode).toBe(403);
    expect(postRes.json()).toEqual({ code: 'SIN_PERMISO' });

    const patchRes = await servidor.inject({
      method: 'PATCH',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}`,
      headers: con('recep'),
      payload: { activo: false },
    });
    expect(patchRes.statusCode).toBe(403);
    expect(patchRes.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('Paciente no puede listar profesionales: responde 403 SIN_PERMISO', async () => {
    const servidor = await crearAppDePrueba();

    const res = await servidor.inject({
      method: 'GET',
      url: '/api/profesionales',
      headers: con('pac'),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('Profesional inexistente al editar: responde 404 NO_ENCONTRADO', async () => {
    const servidor = await crearAppDePrueba();

    const res = await servidor.inject({
      method: 'PATCH',
      url: '/api/profesionales/00000000-0000-4000-8000-999999999999',
      headers: con('prof'),
      payload: { nombre: 'No Existe' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('Gestión de boxes', () => {
  it('Alta y desactivación de box: POST responde 201 y PATCH activo false responde 200', async () => {
    const servidor = await crearAppDePrueba();

    const alta = await servidor.inject({
      method: 'POST',
      url: '/api/boxes',
      headers: con('prof'),
      payload: { nombre: 'Box 3' },
    });

    expect(alta.statusCode).toBe(201);
    const box = alta.json();
    expect(box).toMatchObject({ nombre: 'Box 3', activo: true });
    expect(typeof box.id).toBe('string');

    const desactivado = await servidor.inject({
      method: 'PATCH',
      url: `/api/boxes/${box.id}`,
      headers: con('prof'),
      payload: { activo: false },
    });

    expect(desactivado.statusCode).toBe(200);
    expect(desactivado.json()).toMatchObject({
      id: box.id,
      nombre: 'Box 3',
      activo: false,
    });
  });

  it('Nombre de box duplicado al crear o renombrar (case-insensitive y espacios): responde 400 FORMATO_INVALIDO en nombre', async () => {
    const servidor = await crearAppDePrueba();

    const altaDuplicada = await servidor.inject({
      method: 'POST',
      url: '/api/boxes',
      headers: con('prof'),
      payload: { nombre: '  box 1  ' },
    });

    expect(altaDuplicada.statusCode).toBe(400);
    expect(altaDuplicada.json().code).toBe('FORMATO_INVALIDO');
    expect(altaDuplicada.json().detalles).toEqual([
      expect.objectContaining({ campo: 'nombre' }),
    ]);

    const renombreDuplicado = await servidor.inject({
      method: 'PATCH',
      url: `/api/boxes/${SEED.boxes.box2.id}`,
      headers: con('prof'),
      payload: { nombre: 'BOX 1' },
    });

    expect(renombreDuplicado.statusCode).toBe(400);
    expect(renombreDuplicado.json().code).toBe('FORMATO_INVALIDO');
    expect(renombreDuplicado.json().detalles).toEqual([
      expect.objectContaining({ campo: 'nombre' }),
    ]);
  });

  it('Permite renombrar un box manteniendo su propio nombre o a uno disponible, y 404 si no existe', async () => {
    const servidor = await crearAppDePrueba();

    const mismoNombre = await servidor.inject({
      method: 'PATCH',
      url: `/api/boxes/${SEED.boxes.box1.id}`,
      headers: con('prof'),
      payload: { nombre: 'box 1' },
    });
    expect(mismoNombre.statusCode).toBe(200);
    expect(mismoNombre.json()).toMatchObject({ id: SEED.boxes.box1.id, nombre: 'box 1' });

    const inexistente = await servidor.inject({
      method: 'PATCH',
      url: '/api/boxes/00000000-0000-4000-8000-999999999998',
      headers: con('prof'),
      payload: { nombre: 'Box 9' },
    });
    expect(inexistente.statusCode).toBe(404);
    expect(inexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('Recepcionista lista boxes (200) pero no puede crear ni editar (403 SIN_PERMISO)', async () => {
    const servidor = await crearAppDePrueba();

    const getRes = await servidor.inject({
      method: 'GET',
      url: '/api/boxes',
      headers: con('recep'),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: SEED.boxes.box1.id, nombre: 'Box 1' }),
      ]),
    );

    const postRes = await servidor.inject({
      method: 'POST',
      url: '/api/boxes',
      headers: con('recep'),
      payload: { nombre: 'Box 4' },
    });
    expect(postRes.statusCode).toBe(403);
    expect(postRes.json()).toEqual({ code: 'SIN_PERMISO' });

    const patchRes = await servidor.inject({
      method: 'PATCH',
      url: `/api/boxes/${SEED.boxes.box1.id}`,
      headers: con('recep'),
      payload: { activo: false },
    });
    expect(patchRes.statusCode).toBe(403);
    expect(patchRes.json()).toEqual({ code: 'SIN_PERMISO' });
  });
});
