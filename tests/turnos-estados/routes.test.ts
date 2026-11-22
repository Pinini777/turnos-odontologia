import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import type { EstadoTurno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { authDeTest } from '../plataforma/helpers';
import { guardarTurno, HORA } from './fixtures';

const con = (token: 'prof' | 'recep' | 'pac') => ({ authorization: `Bearer ${token}` });

/** API real (src/modules) con auth de test, reloj fijo y un turno guardado en `estado`. */
async function armar(estado: EstadoTurno, hora: string = HORA.diezYDiez) {
  const repos = crearRepositoriosEnMemoria();
  const turno = await guardarTurno(repos, estado);
  const app = await buildApp({ auth: authDeTest, clock: new FixedClock(hora), repos });
  return { app, repos, turno };
}

describe('POST /api/turnos/:id/cancelar', () => {
  it('cancela un turno reservado → 200 con el turno cancelado', async () => {
    const { app, repos, turno } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: con('recep') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: turno.id, estado: 'cancelado' });
    expect((await repos.turnos.buscarPorId(turno.id))?.estado).toBe('cancelado');
  });

  it('cancelar un turno ya cancelado → 409 TRANSICION_INVALIDA', async () => {
    const { app, turno } = await armar('cancelado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: con('recep') });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TRANSICION_INVALIDA' });
  });

  it('turno inexistente → 404 NO_ENCONTRADO', async () => {
    const { app } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: '/api/turnos/no-existe/cancelar', headers: con('prof') });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('POST /api/turnos/:id/estado', () => {
  it('el profesional atiende un confirmado que ya empezó → 200 atendido', async () => {
    const { app, turno } = await armar('confirmado');
    const res = await app.inject({
      method: 'POST', url: `/api/turnos/${turno.id}/estado`, headers: con('prof'), payload: { estado: 'atendido' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: turno.id, estado: 'atendido' });
  });

  it('atender antes del inicio → 409 TRANSICION_INVALIDA', async () => {
    const { app, turno } = await armar('confirmado', HORA.nueveCincuentaYNueve);
    const res = await app.inject({
      method: 'POST', url: `/api/turnos/${turno.id}/estado`, headers: con('prof'), payload: { estado: 'atendido' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TRANSICION_INVALIDA' });
  });

  it('pedir el mismo estado que ya tiene → 409 TRANSICION_INVALIDA', async () => {
    const { app, turno } = await armar('confirmado');
    const res = await app.inject({
      method: 'POST', url: `/api/turnos/${turno.id}/estado`, headers: con('recep'), payload: { estado: 'confirmado' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TRANSICION_INVALIDA' });
  });

  it('turno inexistente → 404 NO_ENCONTRADO', async () => {
    const { app } = await armar('reservado');
    const res = await app.inject({
      method: 'POST', url: '/api/turnos/no-existe/estado', headers: con('recep'), payload: { estado: 'confirmado' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('Bordes HTTP: formato, roles y precios', () => {
  it.each([
    ['{"estado":"cancelado"}', { estado: 'cancelado' }],
    ['{"estado":"reservado"}', { estado: 'reservado' }],
    ['{}', {}],
  ])('POST /estado con %s → 400 FORMATO_INVALIDO sobre el campo estado', async (_nombre, payload) => {
    const { app, repos, turno } = await armar('confirmado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/estado`, headers: con('recep'), payload });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
    expect(res.json().detalles).toEqual([expect.objectContaining({ campo: 'estado' })]);
    expect((await repos.turnos.buscarPorId(turno.id))?.estado).toBe('confirmado');
  });

  it.each([
    ['cancelar', undefined],
    ['estado', { estado: 'confirmado' }],
  ])('el paciente usa POST /%s → 403 SIN_PERMISO y el turno no cambia', async (ruta, payload) => {
    const { app, repos, turno } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/${ruta}`, headers: con('pac'), payload });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
    expect((await repos.turnos.buscarPorId(turno.id))?.estado).toBe('reservado');
    expect(await repos.auditoria.listar()).toEqual([]);
  });

  it('sin token → 401 NO_AUTENTICADO', async () => {
    const { app, turno } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar` });
    expect(res.statusCode).toBe(401);
  });

  it('la recepcionista no ve precioAlReservar en la respuesta', async () => {
    const { app, turno } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: con('recep') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('precioAlReservar');
  });

  it('el profesional sí ve precioAlReservar', async () => {
    const { app, turno } = await armar('reservado');
    const res = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: con('prof') });
    expect(res.json()).toMatchObject({ precioAlReservar: turno.precioAlReservar });
  });

  it('la cancelación por HTTP queda auditada con el usuarioId de la sesión', async () => {
    const { app, repos, turno } = await armar('confirmado');
    await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: con('recep') });
    const [registro] = await repos.auditoria.listar((r) => r.turnoId === turno.id);
    expect(registro).toMatchObject({ accion: 'cancelado', actor: SEED.usuarios.recepcion.id });
  });
});
