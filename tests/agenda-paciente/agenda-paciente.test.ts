import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { crearNotificadorEnMemoria } from '../../src/modules/notificaciones';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { AuthPort, UsuarioSesion } from '../../src/shared/sesion';

const SESIONES: Record<string, UsuarioSesion> = {
  recep: { usuarioId: SEED.usuarios.recepcion.id, rol: 'recepcionista' },
  pac1: {
    usuarioId: SEED.usuarios.paciente1.id,
    rol: 'paciente',
    pacienteId: SEED.pacientes.uno.id,
  },
};

const auth: AuthPort = {
  async verificar(token: string) {
    return SESIONES[token] ?? null;
  },
};

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function armarApi(ahora = '2026-11-30T08:00:00-03:00') {
  const repos = crearRepositoriosEnMemoria();
  const app = await buildApp({
    auth,
    repos,
    clock: new FixedClock(ahora),
    notificador: crearNotificadorEnMemoria(),
  });
  apps.push(app);
  return { app, repos };
}

function turnoDe(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-base-pac',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-11-30T10:00:00-03:00'),
    fin: new Date('2026-11-30T10:30:00-03:00'),
    estado: 'reservado',
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-29T08:00:00-03:00'),
    ...overrides,
  };
}

describe('agenda-paciente (C-17)', () => {
  it('Rechaza turno superpuesto del mismo paciente con distinto profesional y box', async () => {
    const { app, repos } = await armarApi();
    await repos.turnos.guardar(turnoDe());

    const resAlta = await app.inject({
      method: 'POST',
      url: '/api/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box2.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T10:15:00-03:00',
      },
    });
    expect(resAlta.statusCode).toBe(409);
    expect(resAlta.json()).toEqual({ code: 'SOLAPAMIENTO_PACIENTE' });

    const resRecep = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box2.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T10:15:00-03:00',
      },
    });
    expect(resRecep.statusCode).toBe(409);
    expect(resRecep.json()).toEqual({ code: 'SOLAPAMIENTO_PACIENTE' });
    expect(await repos.turnos.listar()).toHaveLength(1);
  });

  it('Respeta precedencia profesional y box antes que paciente ante conflicto múltiple', async () => {
    const { app, repos } = await armarApi();
    await repos.turnos.guardar(turnoDe());

    const resProf = await app.inject({
      method: 'POST',
      url: '/api/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box2.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resProf.statusCode).toBe(409);
    expect(resProf.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });

    const resBox = await app.inject({
      method: 'POST',
      url: '/api/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box1.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resBox.statusCode).toBe(409);
    expect(resBox.json()).toEqual({ code: 'SOLAPAMIENTO_BOX' });
  });

  it('Permite turnos contiguos o sobre hueco cancelado del mismo paciente', async () => {
    const { app, repos } = await armarApi();
    await repos.turnos.guardar(
      turnoDe({
        id: 't-cancelado',
        inicio: new Date('2026-11-30T09:00:00-03:00'),
        fin: new Date('2026-11-30T09:30:00-03:00'),
        estado: 'cancelado',
      }),
    );
    await repos.turnos.guardar(
      turnoDe({
        id: 't-confirmado',
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
        estado: 'confirmado',
      }),
    );

    const resSobreCancelado = await app.inject({
      method: 'POST',
      url: '/api/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T09:00:00-03:00',
      },
    });
    expect(resSobreCancelado.statusCode).toBe(201);

    const resContiguo = await app.inject({
      method: 'POST',
      url: '/api/turnos',
      headers: { authorization: 'Bearer recep' },
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        prestacionId: SEED.prestaciones.consulta.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: '2026-11-30T10:30:00-03:00',
      },
    });
    expect(resContiguo.statusCode).toBe(201);
  });

  it('Paciente con turno futuro reservado o confirmado no puede crear otra reserva online', async () => {
    const { app, repos } = await armarApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(
      turnoDe({
        id: 't-futuro-reservado',
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: { authorization: 'Bearer pac1' },
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-12-02T10:00:00-03:00',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TURNO_PENDIENTE_EXISTENTE' });
  });

  it('Paciente cuyo turno pendiente ya alcanzó su horario de inicio o fue cancelado puede reservar online', async () => {
    const { app, repos } = await armarApi('2026-11-30T10:00:00-03:00');
    await repos.turnos.guardar(
      turnoDe({
        id: 't-ya-empezo',
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: { authorization: 'Bearer pac1' },
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-12-01T10:00:00-03:00',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});
