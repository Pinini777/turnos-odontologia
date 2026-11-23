import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { crearNotificador } from '../../src/modules/notificaciones/adapter';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import type { ConsultaDisponibilidad } from '../../src/shared/puertos';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { authDeTest } from '../plataforma/helpers';

describe('POST /api/turnos', () => {
  let app: FastifyInstance;
  let repos: Repositorios;
  let codigoDisponibilidad: null | 'FUERA_DE_HORARIO' | 'EN_BLOQUEO';
  let consultas: ConsultaDisponibilidad[];
  let notificador: ReturnType<typeof crearNotificador>;
  let fallaEmail: boolean;
  let envios: number;
  const solicitud = {
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: '2026-11-24T10:00:00-03:00',
  };
  const existente: Turno = {
    id: 'turno-existente', ...solicitud,
    inicio: new Date('2026-11-24T10:00:00-03:00'),
    fin: new Date('2026-11-24T10:30:00-03:00'),
    estado: 'reservado', origen: 'recepcion', precioAlReservar: 15000,
    creadoPor: SEED.usuarios.recepcion.id, creadoEn: new Date('2026-11-23T08:00:00-03:00'),
  };

  beforeEach(async () => {
    repos = crearRepositoriosEnMemoria();
    codigoDisponibilidad = null;
    consultas = [];
    notificador = crearNotificador();
    fallaEmail = false;
    envios = 0;
    app = await buildApp({
      repos,
      clock: new FixedClock('2026-11-23T08:00:00-03:00'),
      auth: authDeTest,
      disponibilidad: { async verificar(consulta) { consultas.push(consulta); return codigoDisponibilidad; } },
      notificador: { async enviar(mensaje) { envios++; if (fallaEmail) throw new Error('Falla de prueba'); await notificador.enviar(mensaje); } },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('rechaza un inicio inválido', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' },
      payload: { ...solicitud, inicio: 'mañana' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('FORMATO_INVALIDO');
    expect(res.json().detalles).toEqual(expect.arrayContaining([expect.objectContaining({ campo: 'inicio' })]));
  });

  it('rechaza una solicitud sin sesión', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/turnos', payload: solicitud });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('rechaza el alta del personal si la solicita un paciente', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer pac' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('la recepcionista crea un turno sin ver el precio congelado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      estado: 'reservado', origen: 'recepcion', creadoPor: SEED.usuarios.recepcion.id,
      inicio: '2026-11-24T13:00:00.000Z', fin: '2026-11-24T13:30:00.000Z',
    });
    expect(res.json()).not.toHaveProperty('precioAlReservar');
    expect(await repos.turnos.listar()).toEqual([expect.objectContaining({ precioAlReservar: 15000 })]);
  });

  it('el profesional ve el precio congelado al crear un turno', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer prof' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      estado: 'reservado', origen: 'profesional', creadoPor: SEED.usuarios.anaPerez.id, precioAlReservar: 15000,
    });
    expect(await repos.turnos.listar()).toHaveLength(1);
  });

  it.each([
    ['inicio fuera de la grilla', '2026-11-24T10:10:00-03:00', 'FUERA_DE_GRILLA'],
    ['inicio con segundos', '2026-11-24T10:15:30-03:00', 'FUERA_DE_GRILLA'],
    ['inicio anterior a ahora', '2026-11-20T10:00:00-03:00', 'EN_EL_PASADO'],
  ])('rechaza %s', async (_escenario, inicio, codigo) => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' },
      payload: { ...solicitud, inicio },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: codigo });
    expect(await repos.turnos.listar()).toHaveLength(0);
  });

  it('rechaza un paciente inexistente', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' },
      payload: { ...solicitud, pacienteId: 'paciente-inexistente' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
    expect(await repos.turnos.listar()).toHaveLength(0);
  });

  it('rechaza un box inactivo', async () => {
    await repos.boxes.guardar({ ...SEED.boxes.box2, activo: false });
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' },
      payload: { ...solicitud, boxId: SEED.boxes.box2.id },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'RECURSO_INACTIVO' });
    expect(await repos.turnos.listar()).toHaveLength(0);
  });

  it.each(['FUERA_DE_HORARIO', 'EN_BLOQUEO'] as const)('rechaza disponibilidad %s', async (codigo) => {
    codigoDisponibilidad = codigo;
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: codigo });
    expect(await repos.turnos.listar()).toHaveLength(0);
    expect(consultas).toEqual([{
      profesionalId: solicitud.profesionalId, boxId: solicitud.boxId,
      inicio: new Date('2026-11-24T10:00:00-03:00'), fin: new Date('2026-11-24T10:30:00-03:00'),
    }]);
  });

  it.each([
    ['profesional ocupado en otro box', { boxId: SEED.boxes.box2.id, inicio: '2026-11-24T10:15:00-03:00' }, 'SOLAPAMIENTO_PROFESIONAL'],
    ['box ocupado por otro profesional', { profesionalId: SEED.profesionales.brunoGomez.id, inicio: '2026-11-24T10:15:00-03:00' }, 'SOLAPAMIENTO_BOX'],
    ['ambos recursos ocupados', {}, 'SOLAPAMIENTO_PROFESIONAL'],
    ['turno que empieza antes de que termine otro', { inicio: '2026-11-24T10:15:00-03:00' }, 'SOLAPAMIENTO_PROFESIONAL'],
    ['intento de forzar un sobreturno', { boxId: SEED.boxes.box2.id, sobreturno: true }, 'SOLAPAMIENTO_PROFESIONAL'],
  ])('rechaza %s', async (escenario, cambios, codigo) => {
    await repos.turnos.guardar(existente);
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: escenario === 'intento de forzar un sobreturno' ? 'Bearer prof' : 'Bearer recep' },
      payload: { ...solicitud, ...cambios },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: codigo });
    expect(await repos.turnos.listar()).toEqual([existente]);
    expect(await repos.auditoria.listar()).toHaveLength(0);
    expect(notificador.bandeja).toHaveLength(0);
  });

  it.each([
    ['2026-11-24T09:30:00-03:00', '2026-11-24T13:00:00.000Z'],
    ['2026-11-24T10:30:00-03:00', '2026-11-24T14:00:00.000Z'],
  ])(
    'acepta un turno contiguo que empieza a %s', async (inicio, fin) => {
      await repos.turnos.guardar(existente);
      const res = await app.inject({
        method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: { ...solicitud, inicio },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ inicio: new Date(inicio).toISOString(), fin });
      expect(await repos.turnos.listar()).toHaveLength(2);
    },
  );

  it('acepta un turno en el hueco de uno cancelado', async () => {
    await repos.turnos.guardar({ ...existente, estado: 'cancelado' });
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    expect(await repos.turnos.listar()).toHaveLength(2);
  });

  it('crea solo un turno cuando llegan dos altas simultáneas al mismo hueco', async () => {
    const peticion = () => app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    const respuestas = await Promise.all([peticion(), peticion()]);
    expect(respuestas.map((res) => res.statusCode).sort()).toEqual([201, 409]);
    expect(respuestas.find((res) => res.statusCode === 409)?.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    expect(await repos.turnos.listar()).toHaveLength(1);
  });

  it('registra la auditoría del alta con actor, fecha y turno creado', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    const [turno] = await repos.turnos.listar();
    expect(turno).toBeDefined();
    if (!turno) throw new Error('No se guardó el turno');
    expect(await repos.auditoria.listar()).toEqual([{
      id: expect.any(String), turnoId: turno.id, accion: 'creado', actor: SEED.usuarios.recepcion.id,
      fecha: new Date('2026-11-23T08:00:00-03:00'), detalle: { despues: turno },
    }]);
  });

  it('envía una confirmación al paciente sin precio', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    expect(envios).toBe(1);
    expect(notificador.bandeja).toHaveLength(1);
    const [mensaje] = notificador.bandeja;
    if (!mensaje) throw new Error('No se envió el email');
    expect(mensaje.para).toBe('paciente1@example.com');
    expect(mensaje.asunto).toContain('24/11/2026 10:00');
    for (const dato of ['24/11/2026', '10:00', 'Dra. Ana Pérez', 'Box 1', 'Consulta']) {
      expect(mensaje.texto).toContain(dato);
    }
    expect(JSON.stringify(mensaje)).not.toContain('15000');
    expect(JSON.stringify(mensaje).toLowerCase()).not.toContain('precio');
  });

  it('mantiene el turno creado si falla el envío del email', async () => {
    fallaEmail = true;
    const res = await app.inject({
      method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer recep' }, payload: solicitud,
    });
    expect(res.statusCode).toBe(201);
    expect(envios).toBe(1);
    expect(await repos.turnos.listar()).toHaveLength(1);
    expect(await repos.auditoria.listar()).toHaveLength(1);
    expect(notificador.bandeja).toHaveLength(0);
  });
});
