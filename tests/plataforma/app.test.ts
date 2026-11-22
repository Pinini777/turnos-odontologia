import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import { authDeTest, MODULOS_DE_PRUEBA } from './helpers';

const armar = () => buildApp({ modulesDir: MODULOS_DE_PRUEBA, auth: authDeTest });
const con = (token: string) => ({ authorization: `Bearer ${token}` });

describe('Chequeo de salud', () => {
  it('La API está viva: GET /api/health sin token → 200', async () => {
    const res = await (await buildApp()).inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('Registro automático de módulos', () => {
  it('Un módulo nuevo queda publicado bajo /api', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco', headers: con('prof') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ eco: true, rol: 'profesional' });
  });

  it('Una ruta inexistente → 404 NO_ENCONTRADO, no 401', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('Errores', () => {
  it('Formato inválido → 400 FORMATO_INVALIDO con el campo', async () => {
    const res = await (await armar()).inject({
      method: 'POST', url: '/api/eco/formato', headers: con('prof'), payload: { inicio: 'mañana' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
    expect(res.json().detalles).toEqual([expect.objectContaining({ campo: 'inicio' })]);
  });

  it('JSON mal formado → 400 FORMATO_INVALIDO', async () => {
    const res = await (await armar()).inject({
      method: 'POST', url: '/api/eco/formato',
      headers: { ...con('prof'), 'content-type': 'application/json' }, payload: '{roto',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
  });

  it('Regla violada → 409 con el código', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/negocio/SOLAPAMIENTO_BOX', headers: con('prof') });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'SOLAPAMIENTO_BOX' });
  });

  it('NO_ENCONTRADO de negocio → 404', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/negocio/NO_ENCONTRADO', headers: con('prof') });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('Falla interna → 500 ERROR_INTERNO sin detalles', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/falla', headers: con('prof') });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'ERROR_INTERNO' });
    expect(res.body).not.toContain('detalle-secreto');
  });
});

describe('Sesión obligatoria y permisos por rol', () => {
  it('Sin token → 401 NO_AUTENTICADO', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('Token inválido → 401 NO_AUTENTICADO', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco', headers: con('inventado') });
    expect(res.statusCode).toBe(401);
  });

  it('Rol no permitido → 403 SIN_PERMISO', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/solo-profesional', headers: con('recep') });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('Rol permitido → la ruta conoce la sesión', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/solo-profesional', headers: con('prof') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rol: 'profesional', usuarioId: expect.any(String), profesionalId: expect.any(String) });
  });

  it('Autenticación todavía no implementada → todo token da 401', async () => {
    const app = await buildApp({ modulesDir: MODULOS_DE_PRUEBA });
    const res = await app.inject({ method: 'GET', url: '/api/eco', headers: con('prof') });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });
});

describe('Precios ocultos por rol (HTTP)', () => {
  it('Recepcionista no recibe precio ni precioAlReservar', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/precios', headers: con('recep') });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('precio');
    expect(res.json().prestaciones[0]).toEqual({ nombre: 'Consulta' });
  });

  it('Paciente no recibe precios', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/precios', headers: con('pac') });
    expect(res.body).not.toContain('precio');
  });

  it('Profesional sí los recibe', async () => {
    const res = await (await armar()).inject({ method: 'GET', url: '/api/eco/precios', headers: con('prof') });
    expect(res.json().turno.precioAlReservar).toBe(15000);
  });
});

describe('Hora del sistema inyectable', () => {
  it('Reloj fijo: los módulos leen el instante configurado', async () => {
    const app = await buildApp({ modulesDir: MODULOS_DE_PRUEBA, auth: authDeTest, clock: new FixedClock('2026-11-23T12:00:00Z') });
    const res = await app.inject({ method: 'GET', url: '/api/eco/reloj', headers: con('prof') });
    expect(res.json()).toEqual({ ahora: '2026-11-23T12:00:00.000Z' });
  });
});
