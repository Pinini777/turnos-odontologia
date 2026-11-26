import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../src/app';
import { crearNotificadorEnMemoria } from '../../src/modules/notificaciones';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { AuthPort, UsuarioSesion } from '../../src/shared/sesion';

const SESIONES_TEST: Record<string, UsuarioSesion> = {
  prof: {
    usuarioId: SEED.usuarios.anaPerez.id,
    rol: 'profesional',
    profesionalId: SEED.profesionales.anaPerez.id,
  },
  recep: {
    usuarioId: SEED.usuarios.recepcion.id,
    rol: 'recepcionista',
  },
  pac1: {
    usuarioId: SEED.usuarios.paciente1.id,
    rol: 'paciente',
    pacienteId: SEED.pacientes.uno.id,
  },
  pac2: {
    usuarioId: '00000000-0000-4000-8000-000000000605',
    rol: 'paciente',
    pacienteId: SEED.pacientes.dos.id,
  },
  pacSinPacienteId: {
    usuarioId: '00000000-0000-4000-8000-000000000699',
    rol: 'paciente',
  },
};

const authDeTest: AuthPort = {
  async verificar(token: string): Promise<UsuarioSesion | null> {
    return SESIONES_TEST[token] ?? null;
  },
};

const bearer = (token: keyof typeof SESIONES_TEST) => ({ authorization: `Bearer ${token}` });

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function crearApi(ahoraIso = '2026-11-30T08:00:00-03:00', overrides: BuildAppOptions = {}) {
  const repos = overrides.repos ?? crearRepositoriosEnMemoria();
  const clock = overrides.clock ?? new FixedClock(ahoraIso);
  const notificador = crearNotificadorEnMemoria();
  const app = await buildApp({
    auth: authDeTest,
    repos,
    clock,
    ...overrides,
    notificador: overrides.notificador ?? notificador,
  });
  apps.push(app);
  return { app, repos, notificador };
}

function turnoBase(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-http-base',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-11-30T09:00:00-03:00'),
    fin: new Date('2026-11-30T09:30:00-03:00'),
    estado: 'reservado',
    origen: 'online',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: 'paciente',
    creadoEn: new Date('2026-11-29T09:00:00-03:00'),
    ...overrides,
  };
}

describe('GET /api/public/disponibilidad', () => {
  it('responde 200 con huecos ordenados de 15 min sin precios ni datos de pacientes', async () => {
    const { app } = await crearApi('2026-11-30T08:00:00-03:00');
    const query = new URLSearchParams({
      prestacionId: SEED.prestaciones.consulta.id,
      desde: '2026-11-30T09:00:00-03:00',
      hasta: '2026-11-30T10:00:00-03:00',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${query.toString()}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ inicio: string; fin: string; profesionalId: string; boxIds: string[] }>>();
    expect(body).toHaveLength(6);
    expect(body[0]).toEqual({
      inicio: '2026-11-30T12:00:00.000Z',
      fin: '2026-11-30T12:30:00.000Z',
      profesionalId: SEED.profesionales.anaPerez.id,
      boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
    });
    expect(res.body).not.toMatch(/precio/i);
    expect(res.body).not.toContain(SEED.pacientes.uno.id);
    expect(res.body).not.toContain(SEED.pacientes.uno.email);
    expect(res.body).not.toContain(SEED.pacientes.uno.apellido);
    expect(Object.keys(body[0] ?? {}).sort()).toEqual(['boxIds', 'fin', 'inicio', 'profesionalId']);
  });

  it('excluye turnos activos y bloqueos conservando el hueco si otro box sigue libre', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(turnoBase({ id: 'ocupado-ana-0900' }));
    await repos.bloqueos.guardar({
      id: 'bloqueo-box2-1000',
      boxId: SEED.boxes.box2.id,
      inicio: new Date('2026-11-30T10:00:00-03:00'),
      fin: new Date('2026-11-30T10:30:00-03:00'),
      motivo: 'Mantenimiento ficticio',
    });

    const query = new URLSearchParams({
      prestacionId: SEED.prestaciones.consulta.id,
      desde: '2026-11-30T09:00:00-03:00',
      hasta: '2026-11-30T11:00:00-03:00',
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${query.toString()}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ inicio: string; fin: string; profesionalId: string; boxIds: string[] }>>();
    const ana0900 = body.find(
      (h) => h.profesionalId === SEED.profesionales.anaPerez.id && h.inicio === '2026-11-30T12:00:00.000Z',
    );
    const ana0915 = body.find(
      (h) => h.profesionalId === SEED.profesionales.anaPerez.id && h.inicio === '2026-11-30T12:15:00.000Z',
    );
    const bruno0900 = body.find(
      (h) => h.profesionalId === SEED.profesionales.brunoGomez.id && h.inicio === '2026-11-30T12:00:00.000Z',
    );
    const ana1000 = body.find(
      (h) => h.profesionalId === SEED.profesionales.anaPerez.id && h.inicio === '2026-11-30T13:00:00.000Z',
    );

    expect(ana0900).toBeUndefined();
    expect(ana0915).toBeUndefined();
    expect(bruno0900?.boxIds).toEqual([SEED.boxes.box2.id]);
    expect(ana1000?.boxIds).toEqual([SEED.boxes.box1.id]);
  });

  it('no descuenta turnos cancelados, respeta borde contiguo [inicio, fin) y excluye el pasado', async () => {
    const { app, repos } = await crearApi('2026-11-30T09:30:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 'cancelado-0930',
        inicio: new Date('2026-11-30T09:30:00-03:00'),
        fin: new Date('2026-11-30T10:00:00-03:00'),
        estado: 'cancelado',
      }),
    );
    await repos.turnos.guardar(
      turnoBase({
        id: 'reservado-1000',
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const query = new URLSearchParams({
      prestacionId: SEED.prestaciones.consulta.id,
      profesionalId: SEED.profesionales.anaPerez.id,
      desde: '2026-11-30T09:00:00-03:00',
      hasta: '2026-11-30T11:00:00-03:00',
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${query.toString()}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ inicio: string; boxIds: string[] }>>();
    expect(body.map((h) => h.inicio)).toEqual([
      '2026-11-30T12:30:00.000Z', // 09:30 (cancelado libre)
      '2026-11-30T13:30:00.000Z', // 10:30 (contiguo a [10:00, 10:30))
    ]);
    expect(body[0]?.boxIds).toEqual([SEED.boxes.box1.id, SEED.boxes.box2.id]);
  });

  it('rechaza prestacion inexistente (404), no reservable online o inactiva (409) y query invalida (400)', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.prestaciones.guardar({
      ...SEED.prestaciones.limpieza,
      id: 'prestacion-inactiva',
      activa: false,
    });

    const rango = { desde: '2026-11-30T09:00:00-03:00', hasta: '2026-11-30T10:00:00-03:00' };

    const res404 = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({ prestacionId: 'inexistente', ...rango })}`,
    });
    expect(res404.statusCode).toBe(404);
    expect(res404.json()).toEqual({ code: 'NO_ENCONTRADO' });

    const resNoOnline = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({ prestacionId: SEED.prestaciones.extraccion.id, ...rango })}`,
    });
    expect(resNoOnline.statusCode).toBe(409);
    expect(resNoOnline.json()).toEqual({ code: 'RECURSO_INACTIVO' });

    const resInactiva = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({ prestacionId: 'prestacion-inactiva', ...rango })}`,
    });
    expect(resInactiva.statusCode).toBe(409);
    expect(resInactiva.json()).toEqual({ code: 'RECURSO_INACTIVO' });

    const resInvertida = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({
        prestacionId: SEED.prestaciones.consulta.id,
        desde: '2026-11-30T10:00:00-03:00',
        hasta: '2026-11-30T09:00:00-03:00',
      })}`,
    });
    expect(resInvertida.statusCode).toBe(400);
    expect(resInvertida.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

    const resSinOffset = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({
        prestacionId: SEED.prestaciones.consulta.id,
        desde: '2026-11-30T09:00:00',
        hasta: '2026-11-30T10:00:00-03:00',
      })}`,
    });
    expect(resSinOffset.statusCode).toBe(400);
    expect(resSinOffset.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
  });

  it('Rango máximo de 31 días en consulta de disponibilidad', async () => {
    const { app } = await crearApi('2026-11-30T08:00:00-03:00');

    // Exactamente 31 días (30 nov -> 31 dic) -> 200
    const resExacto31 = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({
        prestacionId: SEED.prestaciones.consulta.id,
        desde: '2026-11-30T09:00:00-03:00',
        hasta: '2026-12-31T09:00:00-03:00',
      })}`,
    });
    expect(resExacto31.statusCode).toBe(200);
    expect(resExacto31.json<unknown[]>().length).toBeGreaterThan(0);

    // 31 días y 15 minutos en ruta pública -> 400 FORMATO_INVALIDO en campo hasta
    const resExcedidoPublico = await app.inject({
      method: 'GET',
      url: `/api/public/disponibilidad?${new URLSearchParams({
        prestacionId: SEED.prestaciones.consulta.id,
        desde: '2026-11-30T09:00:00-03:00',
        hasta: '2026-12-31T09:15:00-03:00',
      })}`,
    });
    expect(resExcedidoPublico.statusCode).toBe(400);
    expect(resExcedidoPublico.json()).toMatchObject({
      code: 'FORMATO_INVALIDO',
      detalles: expect.arrayContaining([expect.objectContaining({ campo: 'hasta' })]),
    });

    // 31 días y 15 minutos también rechazado en ruta de recepción -> 400 en campo hasta
    const resExcedidoRecepcion = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${new URLSearchParams({
        prestacionId: SEED.prestaciones.extraccion.id,
        desde: '2026-11-30T09:00:00-03:00',
        hasta: '2026-12-31T09:15:00-03:00',
      })}`,
      headers: bearer('recep'),
    });
    expect(resExcedidoRecepcion.statusCode).toBe(400);
    expect(resExcedidoRecepcion.json()).toMatchObject({
      code: 'FORMATO_INVALIDO',
      detalles: expect.arrayContaining([expect.objectContaining({ campo: 'hasta' })]),
    });
  });
});

describe('POST /api/paciente/turnos', () => {
  it('crea turno online 201 con boxId explicito, auditoria actor paciente y correo con GCal + .ics sin precio', async () => {
    const { app, repos, notificador } = await crearApi('2026-11-30T08:00:00-03:00');
    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        pacienteId: SEED.pacientes.dos.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      estado: 'reservado',
      origen: 'online',
      pacienteId: SEED.pacientes.uno.id,
      boxId: SEED.boxes.box1.id,
    });
    expect(res.body).not.toMatch(/precio/i);

    const auditoria = await repos.auditoria.listar((a) => a.turnoId === body.id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({ accion: 'creado', actor: 'paciente' });

    expect(notificador.bandeja).toHaveLength(1);
    expect(notificador.bandeja[0]?.texto).toContain('https://calendar.google.com/calendar/render');
    expect(notificador.bandeja[0]?.texto).not.toMatch(/precio/i);
    expect(notificador.bandeja[0]?.adjuntos?.[0]?.nombre).toBe('turno.ics');
  });

  it('autoasigna el primer box activo libre cuando se omite boxId', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 'otro-prof-box1',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        pacienteId: SEED.pacientes.dos.id,
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      boxId: SEED.boxes.box2.id,
      profesionalId: SEED.profesionales.brunoGomez.id,
      origen: 'online',
    });
  });

  it('serializa reservas concurrentes HTTP via Promise.all: exactamente una 201 y una 409 SOLAPAMIENTO_PROFESIONAL', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    const payload = {
      profesionalId: SEED.profesionales.anaPerez.id,
      prestacionId: SEED.prestaciones.consulta.id,
      inicio: '2026-11-30T10:00:00-03:00',
    };

    const [res1, res2] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/paciente/turnos', headers: bearer('pac1'), payload }),
      app.inject({ method: 'POST', url: '/api/paciente/turnos', headers: bearer('pac2'), payload }),
    ]);

    const codigos = [res1.statusCode, res2.statusCode].sort((a, b) => a - b);
    expect(codigos).toEqual([201, 409]);
    const fallo = res1.statusCode === 409 ? res1 : res2;
    expect(fallo.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    expect(await repos.turnos.listar()).toHaveLength(1);
  });

  it('rechaza prestacion no reservable online con 409 RECURSO_INACTIVO y reglas de agenda con sus codigos', async () => {
    const { app, repos } = await crearApi('2026-11-30T09:00:00-03:00');

    const resNoOnline = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.extraccion.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resNoOnline.statusCode).toBe(409);
    expect(resNoOnline.json()).toEqual({ code: 'RECURSO_INACTIVO' });
    expect(await repos.turnos.listar()).toHaveLength(0);

    const resGrilla = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T09:07:00-03:00',
      },
    });
    expect(resGrilla.statusCode).toBe(409);
    expect(resGrilla.json()).toEqual({ code: 'FUERA_DE_GRILLA' });

    const resPasado = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T08:45:00-03:00',
      },
    });
    expect(resPasado.statusCode).toBe(409);
    expect(resPasado.json()).toEqual({ code: 'EN_EL_PASADO' });

    const resHorario = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T14:00:00-03:00',
      },
    });
    expect(resHorario.statusCode).toBe(409);
    expect(resHorario.json()).toEqual({ code: 'FUERA_DE_HORARIO' });

    await repos.bloqueos.guardar({
      id: 'bloqueo-prof-1100',
      profesionalId: SEED.profesionales.anaPerez.id,
      inicio: new Date('2026-11-30T11:00:00-03:00'),
      fin: new Date('2026-11-30T11:30:00-03:00'),
      motivo: 'Congreso ficticio',
    });
    const resBloqueo = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resBloqueo.statusCode).toBe(409);
    expect(resBloqueo.json()).toEqual({ code: 'EN_BLOQUEO' });

    // Ocupar box1 y box2 con otros turnos para provocar SOLAPAMIENTO_BOX al intentar reservar para Bruno
    await repos.turnos.guardar(
      turnoBase({
        id: 't-box1',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        pacienteId: SEED.pacientes.dos.id,
        inicio: new Date('2026-11-30T12:00:00-03:00'),
        fin: new Date('2026-11-30T12:30:00-03:00'),
      }),
    );
    await repos.profesionales.guardar({
      id: 'prof-extra',
      nombre: 'Dr. Extra Ficticio',
      matricula: 'MP 0009',
      activo: true,
      usuarioId: 'user-extra',
    });
    await repos.turnos.guardar(
      turnoBase({
        id: 't-box2',
        profesionalId: 'prof-extra',
        boxId: SEED.boxes.box2.id,
        pacienteId: SEED.pacientes.dos.id,
        inicio: new Date('2026-11-30T12:00:00-03:00'),
        fin: new Date('2026-11-30T12:30:00-03:00'),
      }),
    );
    const resBox = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T12:00:00-03:00',
      },
    });
    expect(resBox.statusCode).toBe(409);
    expect(resBox.json()).toEqual({ code: 'SOLAPAMIENTO_BOX' });
  });

  it('Fallo de envío SMTP no revierte la reserva online', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00', {
      notificador: {
        async enviar(): Promise<void> {
          throw new Error('SMTP caido');
        },
      },
    });

    const resOk = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resOk.statusCode).toBe(201);
    expect(await repos.turnos.listar()).toHaveLength(1);

    const res400 = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00',
      },
    });
    expect(res400.statusCode).toBe(400);
    expect(res400.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
  });

  it('Control de acceso en reserva online', async () => {
    const { app } = await crearApi('2026-11-30T08:00:00-03:00');
    const payload = {
      profesionalId: SEED.profesionales.anaPerez.id,
      prestacionId: SEED.prestaciones.consulta.id,
      inicio: '2026-11-30T11:00:00-03:00',
    };

    const res401 = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      payload,
    });
    expect(res401.statusCode).toBe(401);
    expect(res401.json()).toEqual({ code: 'NO_AUTENTICADO' });

    for (const rol of ['recep', 'prof', 'pacSinPacienteId'] as const) {
      const res403 = await app.inject({
        method: 'POST',
        url: '/api/paciente/turnos',
        headers: bearer(rol),
        payload,
      });
      expect(res403.statusCode).toBe(403);
      expect(res403.json()).toEqual({ code: 'SIN_PERMISO' });
    }
  });

  it('Rechaza nueva reserva online si el paciente ya tiene un turno futuro pendiente', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 't-pendiente-futuro',
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-12-02T10:00:00-03:00',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'TURNO_PENDIENTE_EXISTENTE' });
    expect(await repos.turnos.listar()).toHaveLength(1);
  });

  it('Permite nueva reserva online tras cancelar el turno pendiente o cuando su inicio ya pasó', async () => {
    const { app, repos } = await crearApi('2026-11-30T10:00:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 't-pasado-o-actual',
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
        estado: 'confirmado',
      }),
    );
    await repos.turnos.guardar(
      turnoBase({
        id: 't-futuro-cancelado',
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
        estado: 'cancelado',
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-12-02T10:00:00-03:00',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      estado: 'reservado',
      origen: 'online',
      pacienteId: SEED.pacientes.uno.id,
    });
  });
});

describe('GET /api/paciente/turnos y /api/paciente/turnos/:id/calendario.ics', () => {
  it('lista solo turnos propios ordenados por inicio sin precios y maneja lista vacia y RBAC', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 't-tarde',
        inicio: new Date('2026-12-01T11:00:00-03:00'),
        fin: new Date('2026-12-01T11:30:00-03:00'),
      }),
    );
    await repos.turnos.guardar(
      turnoBase({
        id: 't-temprano-cancelado',
        estado: 'cancelado',
        inicio: new Date('2026-12-01T09:30:00-03:00'),
        fin: new Date('2026-12-01T10:00:00-03:00'),
      }),
    );
    await repos.turnos.guardar(
      turnoBase({
        id: 't-ajeno',
        pacienteId: SEED.pacientes.dos.id,
        inicio: new Date('2026-12-01T09:00:00-03:00'),
        fin: new Date('2026-12-01T09:30:00-03:00'),
      }),
    );

    const resPac1 = await app.inject({
      method: 'GET',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
    });
    expect(resPac1.statusCode).toBe(200);
    expect(resPac1.json<Array<{ id: string }>>().map((t) => t.id)).toEqual([
      't-temprano-cancelado',
      't-tarde',
    ]);
    expect(resPac1.body).not.toMatch(/precio/i);

    const resRecep = await app.inject({
      method: 'GET',
      url: '/api/paciente/turnos',
      headers: bearer('recep'),
    });
    expect(resRecep.statusCode).toBe(403);
    expect(resRecep.json()).toEqual({ code: 'SIN_PERMISO' });

    const { app: appVacia } = await crearApi('2026-11-30T08:00:00-03:00');
    const resVacia = await appVacia.inject({
      method: 'GET',
      url: '/api/paciente/turnos',
      headers: bearer('pac1'),
    });
    expect(resVacia.statusCode).toBe(200);
    expect(resVacia.json()).toEqual([]);
  });

  it('descarga calendario.ics de turno propio sin precio y responde 404 para turno ajeno o inexistente', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(turnoBase({ id: 'turno-ics-propio' }));
    await repos.turnos.guardar(
      turnoBase({ id: 'turno-ics-ajeno', pacienteId: SEED.pacientes.dos.id }),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/paciente/turnos/turno-ics-propio/calendario.ics',
      headers: bearer('pac1'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers['content-disposition']).toBe('attachment; filename="turno-turno-ics-propio.ics"');
    expect(res.body).toContain('BEGIN:VCALENDAR');
    expect(res.body).toContain('BEGIN:VEVENT');
    expect(res.body).toContain(SEED.profesionales.anaPerez.nombre);
    expect(res.body).toContain(SEED.boxes.box1.nombre);
    expect(res.body).toContain(SEED.prestaciones.consulta.nombre);
    expect(res.body).not.toContain(String(SEED.prestaciones.consulta.precio));
    expect(res.body).not.toMatch(/precio/i);

    for (const id of ['turno-ics-ajeno', 'inexistente']) {
      const res404 = await app.inject({
        method: 'GET',
        url: `/api/paciente/turnos/${id}/calendario.ics`,
        headers: bearer('pac1'),
      });
      expect(res404.statusCode).toBe(404);
      expect(res404.json()).toEqual({ code: 'NO_ENCONTRADO' });
    }
  });
});

describe('POST /api/paciente/turnos/:id/cancelar y PATCH /api/paciente/turnos/:id/reprogramar', () => {
  it('cancela con 25h y borde exacto 24h, rechaza con 23h (PLAZO_VENCIDO), final (TRANSICION_INVALIDA) y ajeno (404)', async () => {
    const inicioTurno = new Date('2026-12-01T10:00:00-03:00');
    const finTurno = new Date('2026-12-01T10:30:00-03:00');

    // 25h antes
    const api25 = await crearApi('2026-11-30T09:00:00-03:00');
    await api25.repos.turnos.guardar(
      turnoBase({ id: 't-25h', inicio: inicioTurno, fin: finTurno }),
    );
    const res25 = await api25.app.inject({
      method: 'POST',
      url: '/api/paciente/turnos/t-25h/cancelar',
      headers: bearer('pac1'),
    });
    expect(res25.statusCode).toBe(200);
    expect(res25.json()).toMatchObject({ id: 't-25h', estado: 'cancelado' });
    expect(res25.body).not.toMatch(/precio/i);
    expect(await api25.repos.turnos.buscarPorId('t-25h')).toMatchObject({ estado: 'cancelado' });
    expect(await api25.repos.auditoria.listar((a) => a.turnoId === 't-25h')).toMatchObject([
      { accion: 'cancelado', actor: 'paciente' },
    ]);

    // Exacto 24h antes
    const api24 = await crearApi('2026-11-30T10:00:00-03:00');
    await api24.repos.turnos.guardar(
      turnoBase({ id: 't-24h', inicio: inicioTurno, fin: finTurno }),
    );
    const res24 = await api24.app.inject({
      method: 'POST',
      url: '/api/paciente/turnos/t-24h/cancelar',
      headers: bearer('pac1'),
    });
    expect(res24.statusCode).toBe(200);
    expect(res24.json()).toMatchObject({ estado: 'cancelado' });

    // 23h antes + final + ajeno
    const api23 = await crearApi('2026-11-30T11:00:00-03:00');
    await api23.repos.turnos.guardar(
      turnoBase({ id: 't-23h', inicio: inicioTurno, fin: finTurno }),
    );
    await api23.repos.turnos.guardar(
      turnoBase({ id: 't-cancelado', inicio: inicioTurno, fin: finTurno, estado: 'cancelado' }),
    );
    await api23.repos.turnos.guardar(
      turnoBase({
        id: 't-ajeno',
        pacienteId: SEED.pacientes.dos.id,
        inicio: inicioTurno,
        fin: finTurno,
      }),
    );

    const res23 = await api23.app.inject({
      method: 'POST',
      url: '/api/paciente/turnos/t-23h/cancelar',
      headers: bearer('pac1'),
    });
    expect(res23.statusCode).toBe(409);
    expect(res23.json()).toEqual({ code: 'PLAZO_VENCIDO' });
    expect(await api23.repos.turnos.buscarPorId('t-23h')).toMatchObject({ estado: 'reservado' });

    const resFinal = await api23.app.inject({
      method: 'POST',
      url: '/api/paciente/turnos/t-cancelado/cancelar',
      headers: bearer('pac1'),
    });
    expect(resFinal.statusCode).toBe(409);
    expect(resFinal.json()).toEqual({ code: 'TRANSICION_INVALIDA' });

    const resAjeno = await api23.app.inject({
      method: 'POST',
      url: '/api/paciente/turnos/t-ajeno/cancelar',
      headers: bearer('pac1'),
    });
    expect(resAjeno.statusCode).toBe(404);
    expect(resAjeno.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('reprograma con 25h y borde 24h enviando un unico email con GCal e .ics, y rechaza 23h, choque, final y ajeno', async () => {
    const inicioTurno = new Date('2026-12-01T10:00:00-03:00');
    const finTurno = new Date('2026-12-01T10:30:00-03:00');

    // 25h antes
    const api25 = await crearApi('2026-11-30T09:00:00-03:00');
    await api25.repos.turnos.guardar(
      turnoBase({ id: 'r-25h', inicio: inicioTurno, fin: finTurno }),
    );
    const res25 = await api25.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-25h/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-01T10:15:00-03:00' },
    });
    expect(res25.statusCode).toBe(200);
    expect(res25.json()).toMatchObject({
      inicio: '2026-12-01T13:15:00.000Z',
      fin: '2026-12-01T13:45:00.000Z',
      estado: 'reservado',
    });
    expect(res25.body).not.toMatch(/precio/i);
    expect(await api25.repos.auditoria.listar((a) => a.turnoId === 'r-25h')).toMatchObject([
      { accion: 'reprogramado', actor: 'paciente' },
    ]);
    expect(api25.notificador.bandeja).toHaveLength(1);
    expect(api25.notificador.bandeja[0]?.asunto).toContain('Turno reprogramado');
    expect(api25.notificador.bandeja[0]?.texto).toContain('https://calendar.google.com/calendar/render');
    expect(api25.notificador.bandeja[0]?.texto).not.toMatch(/precio/i);
    expect(api25.notificador.bandeja[0]?.adjuntos?.[0]?.contenido).toContain('DTSTART:20261201T131500Z');

    // Exacto 24h antes
    const api24 = await crearApi('2026-11-30T10:00:00-03:00');
    await api24.repos.turnos.guardar(
      turnoBase({ id: 'r-24h', inicio: inicioTurno, fin: finTurno }),
    );
    const res24 = await api24.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-24h/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-01T11:00:00-03:00' },
    });
    expect(res24.statusCode).toBe(200);

    // 23h antes
    const api23 = await crearApi('2026-11-30T11:00:00-03:00');
    await api23.repos.turnos.guardar(
      turnoBase({ id: 'r-23h', inicio: inicioTurno, fin: finTurno }),
    );
    const res23 = await api23.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-23h/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-02T10:00:00-03:00' },
    });
    expect(res23.statusCode).toBe(409);
    expect(res23.json()).toEqual({ code: 'PLAZO_VENCIDO' });

    // Choque, final y ajeno con +24h
    const apiErrores = await crearApi('2026-11-30T08:00:00-03:00');
    await apiErrores.repos.turnos.guardar(
      turnoBase({ id: 'r-propio', inicio: inicioTurno, fin: finTurno }),
    );
    await apiErrores.repos.turnos.guardar(
      turnoBase({
        id: 'r-ocupado',
        pacienteId: SEED.pacientes.dos.id,
        boxId: SEED.boxes.box2.id,
        inicio: new Date('2026-12-01T11:00:00-03:00'),
        fin: new Date('2026-12-01T11:30:00-03:00'),
      }),
    );
    await apiErrores.repos.turnos.guardar(
      turnoBase({ id: 'r-cancelado', estado: 'cancelado', inicio: inicioTurno, fin: finTurno }),
    );
    await apiErrores.repos.turnos.guardar(
      turnoBase({
        id: 'r-ajeno',
        pacienteId: SEED.pacientes.dos.id,
        inicio: inicioTurno,
        fin: finTurno,
      }),
    );

    const resChoque = await apiErrores.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-propio/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-01T11:00:00-03:00' },
    });
    expect(resChoque.statusCode).toBe(409);
    expect(resChoque.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    expect((await apiErrores.repos.turnos.buscarPorId('r-propio'))?.inicio).toEqual(inicioTurno);

    const resFinal = await apiErrores.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-cancelado/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-02T10:00:00-03:00' },
    });
    expect(resFinal.statusCode).toBe(409);
    expect(resFinal.json()).toEqual({ code: 'TRANSICION_INVALIDA' });

    const resAjeno = await apiErrores.app.inject({
      method: 'PATCH',
      url: '/api/paciente/turnos/r-ajeno/reprogramar',
      headers: bearer('pac1'),
      payload: { inicio: '2026-12-02T10:00:00-03:00' },
    });
    expect(resAjeno.statusCode).toBe(404);
    expect(resAjeno.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('GET /api/recepcion/disponibilidad y POST /api/recepcion/turnos', () => {
  it('recepcionista y profesional consultan disponibilidad incluso para prestaciones no online; paciente recibe 403', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.prestaciones.guardar({
      ...SEED.prestaciones.limpieza,
      id: 'prestacion-inactiva-rx',
      activa: false,
    });

    const queryOk = new URLSearchParams({
      prestacionId: SEED.prestaciones.extraccion.id,
      desde: '2026-11-30T09:00:00-03:00',
      hasta: '2026-11-30T10:30:00-03:00',
    });

    const resRecep = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${queryOk.toString()}`,
      headers: bearer('recep'),
    });
    expect(resRecep.statusCode).toBe(200);
    expect(resRecep.json<unknown[]>()).toHaveLength(6); // 3 huecos * 2 profesionales
    expect(resRecep.body).not.toMatch(/precio/i);

    const resProf = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${queryOk.toString()}`,
      headers: bearer('prof'),
    });
    expect(resProf.statusCode).toBe(200);

    const resInactiva = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${new URLSearchParams({
        prestacionId: 'prestacion-inactiva-rx',
        desde: '2026-11-30T09:00:00-03:00',
        hasta: '2026-11-30T10:30:00-03:00',
      })}`,
      headers: bearer('recep'),
    });
    expect(resInactiva.statusCode).toBe(409);
    expect(resInactiva.json()).toEqual({ code: 'RECURSO_INACTIVO' });

    const res404 = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${new URLSearchParams({
        prestacionId: 'no-existe',
        desde: '2026-11-30T09:00:00-03:00',
        hasta: '2026-11-30T10:30:00-03:00',
      })}`,
      headers: bearer('recep'),
    });
    expect(res404.statusCode).toBe(404);
    expect(res404.json()).toEqual({ code: 'NO_ENCONTRADO' });

    const resPac = await app.inject({
      method: 'GET',
      url: `/api/recepcion/disponibilidad?${queryOk.toString()}`,
      headers: bearer('pac1'),
    });
    expect(resPac.statusCode).toBe(403);
    expect(resPac.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('recepcionista agenda turno presencial para paciente existente con prestacion no online y box automatico sin precio', async () => {
    const { app, repos, notificador } = await crearApi('2026-11-30T08:00:00-03:00');
    const res = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        pacienteId: SEED.pacientes.dos.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.extraccion.id,
        inicio: '2026-11-30T09:00:00-03:00',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      origen: 'recepcion',
      estado: 'reservado',
      boxId: SEED.boxes.box1.id,
      pacienteId: SEED.pacientes.dos.id,
    });
    expect(res.body).not.toMatch(/precio/i);

    const auditoria = await repos.auditoria.listar((a) => a.turnoId === body.id);
    expect(auditoria).toMatchObject([{ accion: 'creado', actor: SEED.usuarios.recepcion.id }]);

    expect(notificador.bandeja).toHaveLength(1);
    expect(notificador.bandeja[0]?.para).toBe(SEED.pacientes.dos.email);
    expect(notificador.bandeja[0]?.texto).toContain('https://calendar.google.com/calendar/render');
    expect(notificador.bandeja[0]?.texto).not.toMatch(/precio/i);
    expect(notificador.bandeja[0]?.adjuntos?.[0]?.nombre).toBe('turno.ics');
  });

  it('recepcionista crea paciente inline atomicamente, no deja huerfano ante choque y rechaza DUPLICADO', async () => {
    const { app, repos, notificador } = await crearApi('2026-11-30T08:00:00-03:00');

    // Alta inline feliz
    const resInline = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        paciente: {
          nombre: 'Paciente',
          apellido: 'Ficticio Tres',
          documento: '00000003',
          email: 'paciente3@example.com',
          telefono: '0000-000003',
        },
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resInline.statusCode).toBe(201);
    const turnoCreado = resInline.json<{ pacienteId: string; origen: string }>();
    expect(turnoCreado.origen).toBe('recepcion');
    expect(resInline.body).not.toMatch(/precio/i);

    const pacienteNuevo = await repos.pacientes.buscarPorId(turnoCreado.pacienteId);
    expect(pacienteNuevo).toMatchObject({
      documento: '00000003',
      email: 'paciente3@example.com',
    });
    expect(pacienteNuevo?.usuarioId).toBeUndefined();
    expect(notificador.bandeja[0]?.para).toBe('paciente3@example.com');

    // Fallo de agenda durante alta inline no deja paciente huerfano
    const resChoqueInline = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        paciente: {
          nombre: 'Paciente',
          apellido: 'Ficticio Cuatro',
          documento: '00000004',
          email: 'paciente4@example.com',
        },
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:00:00-03:00',
      },
    });
    expect(resChoqueInline.statusCode).toBe(409);
    expect(resChoqueInline.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    const conDni4 = await repos.pacientes.listar((p) => p.documento === '00000004');
    expect(conDni4).toHaveLength(0);

    // Duplicado por documento o email -> 409 DUPLICADO y 0 turnos creados
    const turnosAntesDuplicado = await repos.turnos.listar();
    const resDuplicadoDoc = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        paciente: {
          nombre: 'Otro',
          apellido: 'Ficticio',
          documento: '00000001',
          email: 'otro-ficticio@example.com',
        },
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resDuplicadoDoc.statusCode).toBe(409);
    expect(resDuplicadoDoc.json()).toEqual({ code: 'DUPLICADO' });

    const resDuplicadoEmail = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        paciente: {
          nombre: 'Otro',
          apellido: 'Ficticio',
          documento: '00000099',
          email: 'paciente1@example.com',
        },
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resDuplicadoEmail.statusCode).toBe(409);
    expect(resDuplicadoEmail.json()).toEqual({ code: 'DUPLICADO' });
    expect(await repos.turnos.listar()).toHaveLength(turnosAntesDuplicado.length);

    // Profesional tambien puede registrar turno asistido (origen: 'profesional')
    const resProf = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('prof'),
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:30:00-03:00',
      },
    });
    expect(resProf.statusCode).toBe(201);
    expect(resProf.json()).toMatchObject({
      origen: 'profesional',
      precioAlReservar: SEED.prestaciones.consulta.precio,
    });
  });

  it('Validación de entrada y control de acceso en registro asistido', async () => {
    const { app } = await crearApi('2026-11-30T08:00:00-03:00');

    // Validacion XOR pacienteId vs paciente -> 400 FORMATO_INVALIDO
    const resAmbos = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        paciente: {
          nombre: 'Paciente',
          apellido: 'Ficticio Cinco',
          documento: '00000005',
          email: 'paciente5@example.com',
        },
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resAmbos.statusCode).toBe(400);
    expect(resAmbos.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

    const resNinguno = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resNinguno.statusCode).toBe(400);
    expect(resNinguno.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

    // RBAC: paciente -> 403, sin token -> 401
    const resPac = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('pac1'),
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resPac.statusCode).toBe(403);
    expect(resPac.json()).toEqual({ code: 'SIN_PERMISO' });

    const resSinToken = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resSinToken.statusCode).toBe(401);
    expect(resSinToken.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('Recepción puede agendar otra sesión futura del mismo paciente pero no en horario superpuesto', async () => {
    const { app, repos } = await crearApi('2026-11-30T08:00:00-03:00');
    await repos.turnos.guardar(
      turnoBase({
        id: 't-sesion-1',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        pacienteId: SEED.pacientes.uno.id,
        inicio: new Date('2026-11-30T10:00:00-03:00'),
        fin: new Date('2026-11-30T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const resSolapado = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box2.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T10:15:00-03:00',
      },
    });
    expect(resSolapado.statusCode).toBe(409);
    expect(resSolapado.json()).toEqual({ code: 'SOLAPAMIENTO_PACIENTE' });

    const resSegundaSesion = await app.inject({
      method: 'POST',
      url: '/api/recepcion/turnos',
      headers: bearer('recep'),
      payload: {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box2.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: '2026-11-30T11:00:00-03:00',
      },
    });
    expect(resSegundaSesion.statusCode).toBe(201);
    expect(await repos.turnos.listar()).toHaveLength(2);
  });
});
