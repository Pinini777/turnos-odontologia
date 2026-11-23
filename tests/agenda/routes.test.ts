import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import type { AuditoriaTurno, Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { authDeTest } from '../plataforma/helpers';
import { LUNES_ISO, lunes, registro, turno } from './fixtures';

/** 'prof' = Dra. Ana Pérez, 'recep' = recepción, 'pac' = Paciente Ficticio Uno (tests/plataforma/helpers.ts). */
const con = (token: 'prof' | 'recep' | 'pac') => ({ authorization: `Bearer ${token}` });

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

/** API real (autoload de src/modules) con repos en memoria y reloj fijo el lunes 23/11/2026 a las 09:00. */
async function armar(turnos: Turno[] = [], registros: AuditoriaTurno[] = []) {
  const repos = crearRepositoriosEnMemoria();
  for (const t of turnos) await repos.turnos.guardar(t);
  for (const r of registros) await repos.auditoria.agregar(r);
  const app = await buildApp({ auth: authDeTest, repos, clock: new FixedClock(LUNES_ISO.desde) });
  apps.push(app);
  return { app, repos };
}

function urlAgenda(query: Record<string, string> = {}) {
  return `/api/agenda?${new URLSearchParams({ ...LUNES_ISO, ...query }).toString()}`;
}

async function agenda(app: FastifyInstance, query: Record<string, string> = {}, token: 'prof' | 'recep' = 'recep') {
  const res = await app.inject({ method: 'GET', url: urlAgenda(query), headers: con(token) });
  expect(res.statusCode).toBe(200);
  return res.json<Record<string, unknown>[]>();
}

const ids = (xs: readonly Record<string, unknown>[]) => xs.map((x) => x.id);
const urlAuditoria = (id: string) => `/api/turnos/${id}/auditoria`;

/** Campos del detalle de un 400, para comprobar dónde quedó el error. */
const campos = (body: { detalles?: { campo: string }[] }) => (body.detalles ?? []).map((d) => d.campo);

describe('Consulta de la agenda por rango', () => {
  it('Turno que empieza exactamente en `desde` se incluye', async () => {
    const { app } = await armar([turno({ id: 'en-desde', inicio: lunes('09:00') })]);
    expect(ids(await agenda(app))).toEqual(['en-desde']);
  });

  it('Turno que empieza exactamente en `hasta` se excluye', async () => {
    const { app } = await armar([
      turno({ id: 'en-hasta', inicio: lunes('13:00') }),
      turno({ id: 'doce-y-media', inicio: lunes('12:30') }),
    ]);
    expect(ids(await agenda(app))).toEqual(['doce-y-media']);
  });

  it('Consulta de un día completo', async () => {
    const { app } = await armar([
      turno({ id: 'lunes', inicio: lunes('10:00') }),
      turno({ id: 'martes', inicio: new Date('2026-11-24T10:00:00-03:00') }),
    ]);
    const dia = { desde: '2026-11-23T03:00:00Z', hasta: '2026-11-24T03:00:00Z' };
    expect(ids(await agenda(app, dia))).toEqual(['lunes']);
  });
});

describe('Formato y validez del rango', () => {
  it('Falta `desde` o `hasta`', async () => {
    const { app } = await armar();
    const sinDesde = await app.inject({ method: 'GET', url: `/api/agenda?hasta=${LUNES_ISO.hasta}`, headers: con('recep') });
    const sinHasta = await app.inject({ method: 'GET', url: `/api/agenda?desde=${LUNES_ISO.desde}`, headers: con('recep') });

    expect(sinDesde.statusCode).toBe(400);
    expect(sinDesde.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
    expect(campos(sinDesde.json())).toContain('desde');
    expect(sinHasta.statusCode).toBe(400);
    expect(sinHasta.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
    expect(campos(sinHasta.json())).toContain('hasta');
  });

  it('Valor que no es ISO 8601 con offset', async () => {
    const { app } = await armar();
    const soloFecha = await app.inject({ method: 'GET', url: urlAgenda({ desde: '2026-11-23' }), headers: con('recep') });
    const texto = await app.inject({ method: 'GET', url: urlAgenda({ hasta: 'mañana' }), headers: con('recep') });

    expect(soloFecha.statusCode).toBe(400);
    expect(soloFecha.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
    expect(campos(soloFecha.json())).toContain('desde');
    expect(texto.statusCode).toBe(400);
    expect(texto.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
    expect(campos(texto.json())).toContain('hasta');
  });

  it('Rango invertido o vacío', async () => {
    const { app } = await armar();
    const invertido = await app.inject({
      method: 'GET',
      url: urlAgenda({ desde: LUNES_ISO.hasta, hasta: LUNES_ISO.desde }),
      headers: con('recep'),
    });
    const vacio = await app.inject({
      method: 'GET',
      url: urlAgenda({ desde: LUNES_ISO.desde, hasta: LUNES_ISO.desde }),
      headers: con('recep'),
    });

    for (const res of [invertido, vacio]) {
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
      expect(campos(res.json())).toEqual(['hasta']);
    }
  });
});

describe('Filtros por profesional y box', () => {
  it('Filtro por profesional', async () => {
    const { app } = await armar([
      turno({ id: 'ana' }),
      turno({ id: 'bruno', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id }),
    ]);
    expect(ids(await agenda(app, { profesionalId: SEED.profesionales.anaPerez.id }))).toEqual(['ana']);
  });

  it('Filtro por box', async () => {
    const { app } = await armar([
      turno({ id: 'box1' }),
      turno({ id: 'box2', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id }),
    ]);
    expect(ids(await agenda(app, { boxId: SEED.boxes.box2.id }))).toEqual(['box2']);
  });

  it('Filtro por profesional y box a la vez', async () => {
    const { app } = await armar([
      turno({ id: 'ana-box1' }),
      turno({ id: 'ana-box2', boxId: SEED.boxes.box2.id, inicio: lunes('10:00') }),
      turno({ id: 'bruno-box1', profesionalId: SEED.profesionales.brunoGomez.id, inicio: lunes('11:00') }),
    ]);
    const filtro = { profesionalId: SEED.profesionales.anaPerez.id, boxId: SEED.boxes.box1.id };
    expect(ids(await agenda(app, filtro))).toEqual(['ana-box1']);
  });

  it('Filtro que no coincide con ningún recurso', async () => {
    const { app } = await armar([turno()]);
    expect(await agenda(app, { profesionalId: 'no-existe' })).toEqual([]);
    expect(await agenda(app, { boxId: 'no-existe' })).toEqual([]);
  });
});

describe('Turno enriquecido en la agenda', () => {
  it('El turno trae los cuatro resúmenes', async () => {
    const { app } = await armar([turno()]);
    const [t] = await agenda(app);

    expect(t).toMatchObject({
      id: 'turno-agenda-base',
      estado: 'reservado',
      inicio: '2026-11-23T12:00:00.000Z',
      paciente: { id: SEED.pacientes.uno.id, nombre: 'Paciente', apellido: 'Ficticio Uno' },
      profesional: { id: SEED.profesionales.anaPerez.id, nombre: 'Dra. Ana Pérez' },
      box: { id: SEED.boxes.box1.id, nombre: 'Box 1' },
      prestacion: { id: SEED.prestaciones.consulta.id, nombre: 'Consulta', duracionMin: 30 },
    });
  });

  it('El resumen de la prestación no trae precio', async () => {
    const { app } = await armar([turno(), turno({ id: 'otro', inicio: lunes('10:00') })]);
    const turnos = await agenda(app, {}, 'prof');

    expect(turnos).toHaveLength(2);
    for (const t of turnos) {
      expect(t.prestacion).toEqual({ id: SEED.prestaciones.consulta.id, nombre: 'Consulta', duracionMin: 30 });
    }
  });
});

describe('Orden de la agenda', () => {
  it('Turnos ordenados por inicio', async () => {
    const { app } = await armar([
      turno({ id: '11:00', inicio: lunes('11:00') }),
      turno({ id: '09:00', inicio: lunes('09:00') }),
      turno({ id: '10:00', inicio: lunes('10:00') }),
    ]);
    expect(ids(await agenda(app))).toEqual(['09:00', '10:00', '11:00']);
  });

  it('Empate de inicio conserva el orden de inserción', async () => {
    const { app } = await armar([
      turno({ id: 'box2', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id }),
      turno({ id: 'box1' }),
    ]);
    expect(ids(await agenda(app))).toEqual(['box2', 'box1']);
  });
});

describe('Todos los estados y agenda vacía', () => {
  it('Los turnos cancelados aparecen con su estado', async () => {
    const { app } = await armar([
      turno({ id: 'reservado' }),
      turno({ id: 'cancelado', estado: 'cancelado', inicio: lunes('10:00') }),
    ]);
    const turnos = await agenda(app);

    expect(turnos.map((t) => [t.id, t.estado])).toEqual([
      ['reservado', 'reservado'],
      ['cancelado', 'cancelado'],
    ]);
  });

  it('Rango sin turnos devuelve una lista vacía', async () => {
    const { app } = await armar();
    expect(await agenda(app)).toEqual([]);
  });
});

describe('Acceso a la agenda', () => {
  it('La recepcionista no recibe precios', async () => {
    const { app } = await armar([turno({ precioAlReservar: 15000 })]);
    const res = await app.inject({ method: 'GET', url: urlAgenda(), headers: con('recep') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.body).not.toMatch(/precio/i);
  });

  it('El profesional recibe el precio congelado', async () => {
    const { app } = await armar([turno({ precioAlReservar: 15000 })]);
    const [t] = await agenda(app, {}, 'prof');

    expect(t?.precioAlReservar).toBe(15000);
  });

  it('El paciente no accede a la agenda', async () => {
    const { app } = await armar([turno()]);
    const res = await app.inject({ method: 'GET', url: urlAgenda(), headers: con('pac') });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('Sin sesión no hay agenda', async () => {
    const { app } = await armar([turno()]);
    const res = await app.inject({ method: 'GET', url: urlAgenda() });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });
});

describe('Consulta de la auditoría de un turno', () => {
  it('Auditoría ordenada por fecha con acción, actor y detalle', async () => {
    const { app } = await armar(
      [turno()],
      [
        registro({ id: 'cancelado', accion: 'cancelado', fecha: lunes('09:15'), actor: SEED.usuarios.anaPerez.id, detalle: { antes: { estado: 'reservado' }, despues: { estado: 'cancelado' } } }),
        registro({ id: 'creado', accion: 'creado', fecha: lunes('08:30') }),
      ],
    );
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base'), headers: con('prof') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        id: 'creado',
        turnoId: 'turno-agenda-base',
        accion: 'creado',
        actor: SEED.usuarios.recepcion.id,
        fecha: '2026-11-23T11:30:00.000Z',
        detalle: { despues: { estado: 'reservado' } },
      },
      {
        id: 'cancelado',
        turnoId: 'turno-agenda-base',
        accion: 'cancelado',
        actor: SEED.usuarios.anaPerez.id,
        fecha: '2026-11-23T12:15:00.000Z',
        detalle: { antes: { estado: 'reservado' }, despues: { estado: 'cancelado' } },
      },
    ]);
  });

  it('Los registros conservan el detalle antes y después', async () => {
    const detalle = { antes: { estado: 'reservado' }, despues: { estado: 'confirmado' } };
    const { app } = await armar([turno()], [registro({ accion: 'estado_cambiado', detalle })]);
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base'), headers: con('prof') });

    expect(res.statusCode).toBe(200);
    expect(res.json()[0].detalle).toEqual(detalle);
  });

  it('Turno sin registros devuelve una lista vacía', async () => {
    const { app } = await armar([turno()]);
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base'), headers: con('prof') });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('Turno inexistente', async () => {
    const { app } = await armar();
    const res = await app.inject({ method: 'GET', url: urlAuditoria('no-existe'), headers: con('prof') });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });
});

describe('Acceso a la auditoría', () => {
  it('La recepcionista no accede a la auditoría', async () => {
    const { app } = await armar([turno()], [registro()]);
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base'), headers: con('recep') });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('El paciente no accede a la auditoría', async () => {
    // El turno base es de "Paciente Ficticio Uno", la misma persona que la sesión 'pac'.
    const { app } = await armar([turno()], [registro()]);
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base'), headers: con('pac') });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('Sin sesión no hay auditoría', async () => {
    const { app } = await armar([turno()], [registro()]);
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-agenda-base') });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });

  it('El profesional consulta la auditoría de un turno de otro profesional', async () => {
    const { app } = await armar(
      [turno({ id: 'turno-bruno', profesionalId: SEED.profesionales.brunoGomez.id })],
      [registro({ id: 'r-bruno', turnoId: 'turno-bruno' })],
    );
    // Sesión 'prof' = Dra. Ana Pérez.
    const res = await app.inject({ method: 'GET', url: urlAuditoria('turno-bruno'), headers: con('prof') });

    expect(res.statusCode).toBe(200);
    expect(ids(res.json())).toEqual(['r-bruno']);
  });
});

describe('Auditoría de solo lectura', () => {
  for (const [metodo, escenario] of [
    ['PATCH', 'No se puede modificar la auditoría con PATCH'],
    ['DELETE', 'No se puede borrar la auditoría con DELETE'],
  ] as const) {
    it(escenario, async () => {
      const { app, repos } = await armar([turno()], [registro()]);
      const antes = await repos.auditoria.listar();
      const res = await app.inject({
        method: metodo,
        url: urlAuditoria('turno-agenda-base'),
        headers: con('prof'),
        ...(metodo === 'PATCH' ? { payload: { accion: 'cancelado' } } : {}),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.auditoria.listar()).toEqual(antes);
      expect(antes).toHaveLength(1);
    });
  }
});
