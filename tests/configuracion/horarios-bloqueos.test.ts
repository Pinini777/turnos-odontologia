import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { registrarRutasAgenda } from '../../src/modules/configuracion/rutas-agenda';
import { FixedClock } from '../../src/shared/clock';
import { SEED } from '../../src/shared/seed';
import type { AuthPort, UsuarioSesion } from '../../src/shared/sesion';

const SESIONES: Record<'ana' | 'bruno' | 'recep' | 'pac', UsuarioSesion> = {
  ana: {
    usuarioId: SEED.usuarios.anaPerez.id,
    rol: 'profesional',
    profesionalId: SEED.profesionales.anaPerez.id,
  },
  bruno: {
    usuarioId: SEED.usuarios.brunoGomez.id,
    rol: 'profesional',
    profesionalId: SEED.profesionales.brunoGomez.id,
  },
  recep: {
    usuarioId: SEED.usuarios.recepcion.id,
    rol: 'recepcionista',
  },
  pac: {
    usuarioId: SEED.usuarios.paciente1.id,
    rol: 'paciente',
    pacienteId: SEED.pacientes.uno.id,
  },
};

const esToken = (t: string): t is keyof typeof SESIONES => t in SESIONES;

const authConDosProfesionales: AuthPort = {
  async verificar(token) {
    return esToken(token) ? SESIONES[token] : null;
  },
};

const DIR_SIN_MODULOS = fileURLToPath(new URL('.', import.meta.url));
const con = (token: keyof typeof SESIONES) => ({ authorization: `Bearer ${token}` });
const ID_INEXISTENTE = '00000000-0000-4000-8000-999999999999';

async function armarApp() {
  const app = await buildApp({
    auth: authConDosProfesionales,
    clock: new FixedClock('2026-11-23T12:00:00Z'),
    modulesDir: DIR_SIN_MODULOS,
  });
  await app.register(registrarRutasAgenda, { prefix: '/api' });
  return app;
}

describe('Horarios de atención por profesional', () => {
  it('GET /api/profesionales/:id/horarios devuelve las franjas semilla para profesional y recepcionista', async () => {
    const app = await armarApp();
    const resProf = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
    });

    expect(resProf.statusCode).toBe(200);
    const body = resProf.json() as Array<{ profesionalId: string; diaSemana: number; desde: string; hasta: string }>;
    expect(body).toHaveLength(10);
    expect(body.every((h) => h.profesionalId === SEED.profesionales.anaPerez.id)).toBe(true);

    const resRecep = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('recep'),
    });
    expect(resRecep.statusCode).toBe(200);
    expect(resRecep.json()).toHaveLength(10);
  });

  it('GET /api/profesionales/:id/horarios con profesional inexistente responde 404 NO_ENCONTRADO', async () => {
    const app = await armarApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${ID_INEXISTENTE}/horarios`,
      headers: con('ana'),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('GET /api/profesionales/:id/horarios rechaza sin token (401) y a paciente (403)', async () => {
    const app = await armarApp();
    const sinToken = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
    });
    expect(sinToken.statusCode).toBe(401);
    expect(sinToken.json()).toEqual({ code: 'NO_AUTENTICADO' });

    const pac = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('pac'),
    });
    expect(pac.statusCode).toBe(403);
    expect(pac.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('POST /api/profesionales/:id/horarios reemplaza solo las franjas del propio profesional sin afectar a otros', async () => {
    const app = await armarApp();
    const nuevas = [
      { diaSemana: 1, desde: '09:00', hasta: '12:30' },
      { diaSemana: 3, desde: '14:15', hasta: '18:45' },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: nuevas },
    });

    expect(res.statusCode).toBe(200);
    const guardadas = res.json() as Array<{
      id: string;
      profesionalId: string;
      diaSemana: number;
      desde: string;
      hasta: string;
    }>;
    expect(guardadas).toHaveLength(2);
    expect(guardadas[0]).toMatchObject({
      profesionalId: SEED.profesionales.anaPerez.id,
      diaSemana: 1,
      desde: '09:00',
      hasta: '12:30',
    });

    const consultaAna = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('recep'),
    });
    expect(consultaAna.statusCode).toBe(200);
    expect(consultaAna.json()).toHaveLength(2);

    const consultaBruno = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.brunoGomez.id}/horarios`,
      headers: con('recep'),
    });
    expect(consultaBruno.statusCode).toBe(200);
    expect(consultaBruno.json()).toHaveLength(10);
  });

  it('POST /api/profesionales/:id/horarios con lista vacía limpia las franjas propias', async () => {
    const app = await armarApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
    });
    expect(consulta.json()).toEqual([]);
  });

  it('POST /api/profesionales/:otroId/horarios por otro profesional responde 403 SIN_PERMISO', async () => {
    const app = await armarApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.brunoGomez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 1, desde: '09:00', hasta: '12:00' }] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('POST /api/profesionales/:id/horarios por recepcionista responde 403 SIN_PERMISO', async () => {
    const app = await armarApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('recep'),
      payload: { horarios: [{ diaSemana: 1, desde: '09:00', hasta: '12:00' }] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('POST /api/profesionales/:id/horarios con profesional inexistente responde 404 NO_ENCONTRADO', async () => {
    const app = await armarApp();
    const res = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${ID_INEXISTENTE}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 1, desde: '09:00', hasta: '12:00' }] },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('POST /api/profesionales/:id/horarios fuera de la grilla de 15 minutos responde 409 FUERA_DE_GRILLA sin mutar los existentes', async () => {
    const app = await armarApp();

    const desdeInvalido = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 1, desde: '09:10', hasta: '12:00' }] },
    });
    expect(desdeInvalido.statusCode).toBe(409);
    expect(desdeInvalido.json()).toEqual({ code: 'FUERA_DE_GRILLA' });

    const hastaInvalidoEnSegunda = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: {
        horarios: [
          { diaSemana: 1, desde: '09:00', hasta: '12:00' },
          { diaSemana: 2, desde: '15:00', hasta: '18:20' },
        ],
      },
    });
    expect(hastaInvalidoEnSegunda.statusCode).toBe(409);
    expect(hastaInvalidoEnSegunda.json()).toEqual({ code: 'FUERA_DE_GRILLA' });

    const consulta = await app.inject({
      method: 'GET',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
    });
    expect(consulta.json()).toHaveLength(10);
  });

  it('POST /api/profesionales/:id/horarios con desde >= hasta o formato inválido responde 400 FORMATO_INVALIDO', async () => {
    const app = await armarApp();

    const mayor = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 1, desde: '13:00', hasta: '12:00' }] },
    });
    expect(mayor.statusCode).toBe(400);
    expect(mayor.json().code).toBe('FORMATO_INVALIDO');

    const igual = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 1, desde: '10:00', hasta: '10:00' }] },
    });
    expect(igual.statusCode).toBe(400);
    expect(igual.json().code).toBe('FORMATO_INVALIDO');

    const diaInvalido = await app.inject({
      method: 'POST',
      url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
      headers: con('ana'),
      payload: { horarios: [{ diaSemana: 8, desde: '09:00', hasta: '12:00' }] },
    });
    expect(diaInvalido.statusCode).toBe(400);
    expect(diaInvalido.json().code).toBe('FORMATO_INVALIDO');
  });
});

describe('Bloqueos de agenda de profesional y de box', () => {
  it('crea bloqueo propio de profesional y bloqueo de box (201), lista con filtros y elimina (204)', async () => {
    const app = await armarApp();

    const crearProf = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:30:00-03:00',
        motivo: 'Congreso odontológico',
      },
    });
    expect(crearProf.statusCode).toBe(201);
    const bloqueoProf = crearProf.json() as {
      id: string;
      profesionalId: string;
      inicio: string;
      fin: string;
      motivo: string;
    };
    expect(bloqueoProf).toMatchObject({
      profesionalId: SEED.profesionales.anaPerez.id,
      inicio: '2026-11-24T13:00:00.000Z',
      fin: '2026-11-24T14:30:00.000Z',
      motivo: 'Congreso odontológico',
    });

    const crearBox = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('bruno'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T15:00:00-03:00',
        fin: '2026-11-24T17:00:00-03:00',
        motivo: 'Mantenimiento de equipamiento',
      },
    });
    expect(crearBox.statusCode).toBe(201);
    const bloqueoBox = crearBox.json() as {
      id: string;
      boxId: string;
      motivo: string;
    };
    expect(bloqueoBox).toMatchObject({
      boxId: SEED.boxes.box1.id,
      motivo: 'Mantenimiento de equipamiento',
    });

    const todos = await app.inject({
      method: 'GET',
      url: '/api/bloqueos',
      headers: con('recep'),
    });
    expect(todos.statusCode).toBe(200);
    expect(todos.json()).toHaveLength(2);

    const soloAna = await app.inject({
      method: 'GET',
      url: `/api/bloqueos?profesionalId=${SEED.profesionales.anaPerez.id}`,
      headers: con('ana'),
    });
    expect(soloAna.statusCode).toBe(200);
    expect(soloAna.json()).toEqual([expect.objectContaining({ id: bloqueoProf.id })]);

    const soloBox = await app.inject({
      method: 'GET',
      url: `/api/bloqueos?boxId=${SEED.boxes.box1.id}`,
      headers: con('recep'),
    });
    expect(soloBox.statusCode).toBe(200);
    expect(soloBox.json()).toEqual([expect.objectContaining({ id: bloqueoBox.id })]);

    // Ana puede borrar un bloqueo de box creado por Bruno (DD-11)
    const borrarBoxPorOtro = await app.inject({
      method: 'DELETE',
      url: `/api/bloqueos/${bloqueoBox.id}`,
      headers: con('ana'),
    });
    expect(borrarBoxPorOtro.statusCode).toBe(204);
    expect(borrarBoxPorOtro.body).toBe('');

    const borrarPropio = await app.inject({
      method: 'DELETE',
      url: `/api/bloqueos/${bloqueoProf.id}`,
      headers: con('ana'),
    });
    expect(borrarPropio.statusCode).toBe(204);

    const vacio = await app.inject({
      method: 'GET',
      url: '/api/bloqueos',
      headers: con('ana'),
    });
    expect(vacio.json()).toEqual([]);
  });

  it('profesional intenta bloquear o borrar bloqueo personal de otro profesional -> 403 SIN_PERMISO', async () => {
    const app = await armarApp();

    const crearAjeno = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Intento ajeno',
      },
    });
    expect(crearAjeno.statusCode).toBe(403);
    expect(crearAjeno.json()).toEqual({ code: 'SIN_PERMISO' });

    const crearBruno = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('bruno'),
      payload: {
        profesionalId: SEED.profesionales.brunoGomez.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Trámite personal',
      },
    });
    expect(crearBruno.statusCode).toBe(201);
    const { id } = crearBruno.json() as { id: string };

    const borrarAjeno = await app.inject({
      method: 'DELETE',
      url: `/api/bloqueos/${id}`,
      headers: con('ana'),
    });
    expect(borrarAjeno.statusCode).toBe(403);
    expect(borrarAjeno.json()).toEqual({ code: 'SIN_PERMISO' });
  });

  it('bloqueo inválido sin XOR, con inicio >= fin, sin offset o motivo vacío -> 400 FORMATO_INVALIDO', async () => {
    const app = await armarApp();

    const ambos = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Ambos',
      },
    });
    expect(ambos.statusCode).toBe(400);
    expect(ambos.json().code).toBe('FORMATO_INVALIDO');

    const ninguno = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Ninguno',
      },
    });
    expect(ninguno.statusCode).toBe(400);
    expect(ninguno.json().code).toBe('FORMATO_INVALIDO');

    const inicioMayor = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T12:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Invertido',
      },
    });
    expect(inicioMayor.statusCode).toBe(400);
    expect(inicioMayor.json().code).toBe('FORMATO_INVALIDO');

    const inicioIgual = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T11:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Igual',
      },
    });
    expect(inicioIgual.statusCode).toBe(400);
    expect(inicioIgual.json().code).toBe('FORMATO_INVALIDO');

    const sinOffset = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T10:00:00',
        fin: '2026-11-24T11:00:00',
        motivo: 'Sin zona',
      },
    });
    expect(sinOffset.statusCode).toBe(400);
    expect(sinOffset.json().code).toBe('FORMATO_INVALIDO');

    const motivoVacio = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: '   ',
      },
    });
    expect(motivoVacio.statusCode).toBe(400);
    expect(motivoVacio.json().code).toBe('FORMATO_INVALIDO');
  });

  it('recursos inexistentes en POST y DELETE /api/bloqueos responden 404 NO_ENCONTRADO', async () => {
    const app = await armarApp();

    const profInexistente = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        profesionalId: ID_INEXISTENTE,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Profesional inexistente',
      },
    });
    expect(profInexistente.statusCode).toBe(404);
    expect(profInexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });

    const boxInexistente = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('ana'),
      payload: {
        boxId: ID_INEXISTENTE,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Box inexistente',
      },
    });
    expect(boxInexistente.statusCode).toBe(404);
    expect(boxInexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });

    const borrarInexistente = await app.inject({
      method: 'DELETE',
      url: `/api/bloqueos/${ID_INEXISTENTE}`,
      headers: con('ana'),
    });
    expect(borrarInexistente.statusCode).toBe(404);
    expect(borrarInexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });
  });

  it('RBAC: recepcionista no crea ni borra bloqueos (403) y paciente no los lista (403)', async () => {
    const app = await armarApp();

    const postRecep = await app.inject({
      method: 'POST',
      url: '/api/bloqueos',
      headers: con('recep'),
      payload: {
        boxId: SEED.boxes.box1.id,
        inicio: '2026-11-24T10:00:00-03:00',
        fin: '2026-11-24T11:00:00-03:00',
        motivo: 'Intento recepcion',
      },
    });
    expect(postRecep.statusCode).toBe(403);
    expect(postRecep.json()).toEqual({ code: 'SIN_PERMISO' });

    const delRecep = await app.inject({
      method: 'DELETE',
      url: `/api/bloqueos/${ID_INEXISTENTE}`,
      headers: con('recep'),
    });
    expect(delRecep.statusCode).toBe(403);
    expect(delRecep.json()).toEqual({ code: 'SIN_PERMISO' });

    const getPac = await app.inject({
      method: 'GET',
      url: '/api/bloqueos',
      headers: con('pac'),
    });
    expect(getPac.statusCode).toBe(403);
    expect(getPac.json()).toEqual({ code: 'SIN_PERMISO' });

    const sinToken = await app.inject({
      method: 'GET',
      url: '/api/bloqueos',
    });
    expect(sinToken.statusCode).toBe(401);
    expect(sinToken.json()).toEqual({ code: 'NO_AUTENTICADO' });
  });
});
