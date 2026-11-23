import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { crearNotificador } from '../../src/modules/notificaciones/adapter';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { authDeTest } from '../plataforma/helpers';
import { AHORA, guardarTurno, iso } from './fixtures';

const con = (token: 'prof' | 'recep' | 'pac') => ({ authorization: `Bearer ${token}` });

/** API real (src/modules) con auth de test, reloj fijo, disponibilidad real y un turno guardado. */
async function armar(cambiosTurno: Partial<Turno> = {}) {
  const repos = crearRepositoriosEnMemoria();
  const turno = await guardarTurno(repos, cambiosTurno);
  const notificador = crearNotificador();
  const app = await buildApp({ auth: authDeTest, clock: new FixedClock(AHORA), repos, notificador });
  const reprogramar = (payload: unknown, token: 'prof' | 'recep' | 'pac' | null = 'recep', id = turno.id) =>
    app.inject({
      method: 'PATCH', url: `/api/turnos/${id}/reprogramar`, payload: payload as object,
      ...(token ? { headers: con(token) } : {}),
    });
  return { app, repos, turno, notificador, reprogramar };
}

describe('PATCH /api/turnos/:id/reprogramar', () => {
  it('mueve el turno a un hueco libre → 200 con el turno de 11:00 a 11:30', async () => {
    const { repos, turno, reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: turno.id, estado: 'reservado', inicio: new Date(iso('11:00')).toISOString(),
      fin: new Date(iso('11:30')).toISOString(), profesionalId: turno.profesionalId, boxId: turno.boxId,
    });
    expect((await repos.turnos.buscarPorId(turno.id))?.inicio).toEqual(new Date(iso('11:00')));
  });

  it('a otro profesional y otro box → 200', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({
      inicio: iso('10:00'), profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id });
  });

  it('borde: mover 15 min sobre su propio horario → 200 de 10:15 a 10:45', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('10:15') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ fin: new Date(iso('10:45')).toISOString() });
  });

  it('chocar con otro turno del profesional → 409 SOLAPAMIENTO_PROFESIONAL', async () => {
    const { repos, turno, reprogramar } = await armar();
    await guardarTurno(repos, { id: 'otro', boxId: SEED.boxes.box2.id, inicio: new Date(iso('11:00')), fin: new Date(iso('11:30')) });
    const res = await reprogramar({ inicio: iso('11:15') });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
  });

  it('reprogramar un turno cancelado → 409 TRANSICION_INVALIDA y sigue cancelado', async () => {
    const { repos, turno, reprogramar } = await armar({ estado: 'cancelado' });
    const res = await reprogramar({ inicio: iso('11:00') });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TRANSICION_INVALIDA' });
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
  });

  it('turno inexistente → 404 NO_ENCONTRADO', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') }, 'recep', 'no-existe');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('reenvía el email al paciente', async () => {
    const { notificador, reprogramar } = await armar();
    await reprogramar({ inicio: iso('11:00') });
    expect(notificador.bandeja).toEqual([expect.objectContaining({ para: 'paciente1@example.com' })]);
  });
});

describe('Bordes HTTP: formato, roles, precios y auditoría', () => {
  it('cuerpo sin inicio → 400 FORMATO_INVALIDO con detalle sobre inicio', async () => {
    const { repos, turno, reprogramar } = await armar();
    const res = await reprogramar({});
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
    expect(res.json().detalles).toEqual([expect.objectContaining({ campo: 'inicio' })]);
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
  });

  it.each([
    ['inicio sin zona horaria', { inicio: '2026-11-24T11:00:00' }],
    ['profesionalId vacío', { inicio: iso('11:00'), profesionalId: '' }],
  ])('%s → 400 FORMATO_INVALIDO', async (_nombre, payload) => {
    const { reprogramar } = await armar();
    const res = await reprogramar(payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
  });

  it('el paciente usa la ruta del personal → 403 SIN_PERMISO y el turno no cambia', async () => {
    const { repos, turno, reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') }, 'pac');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
    expect(await repos.auditoria.listar()).toEqual([]);
  });

  it('sin token → 401 NO_AUTENTICADO', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') }, null);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('la recepcionista no ve precioAlReservar en la respuesta', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') }, 'recep');
    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('precioAlReservar');
  });

  it('el profesional sí ve precioAlReservar, congelado', async () => {
    const { reprogramar } = await armar();
    const res = await reprogramar({ inicio: iso('11:00') }, 'prof');
    expect(res.json()).toMatchObject({ precioAlReservar: SEED.prestaciones.consulta.precio });
  });

  it('la reprogramación por HTTP queda auditada con el usuarioId de la sesión', async () => {
    const { repos, turno, reprogramar } = await armar();
    await reprogramar({ inicio: iso('11:00') }, 'prof');
    const [registro] = await repos.auditoria.listar((r) => r.turnoId === turno.id);
    expect(registro).toMatchObject({ accion: 'reprogramado', actor: SEED.usuarios.anaPerez.id });
  });
});
