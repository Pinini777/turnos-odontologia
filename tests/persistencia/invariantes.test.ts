import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosPostgres } from '../../src/shared/persistencia/repositorios-postgres';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { AuthPort } from '../../src/shared/sesion';
import { conBase, TIMEOUT_POSTGRES, type BasePrueba } from './esquema';
import { boxId, cargarBase, creadoEn, pacienteId, prestacionId, profesionalId, turnoFicticio, usuarioId } from './fixtures';

const auth: AuthPort = {
  verificar: async token => {
    if (token === 'equipo') return { rol: 'recepcionista', usuarioId: SEED.usuarios.recepcion.id };
    if (token === 'odontologia') return { rol: 'profesional', usuarioId, profesionalId };
    if (token === 'paciente') return { rol: 'paciente', usuarioId: SEED.usuarios.paciente1.id, pacienteId };
    return null;
  },
};
const clock = new FixedClock(creadoEn);
const notificador = { enviar: () => Promise.resolve() };
const equipo = { authorization: 'Bearer equipo' };

/** Cada escenario usa su propio día (lunes a viernes, 09:00 en Argentina) para compartir el esquema sin pisarse. */
const a = (dia: string, hora = '09:00') => new Date(`2027-01-${dia}T${hora}:00-03:00`);
const minutos = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);
const delDia = (turnos: Turno[], dia: Date) => turnos.filter(t => t.inicio.toISOString().slice(0, 10) === dia.toISOString().slice(0, 10));

describe.skipIf(!process.env.TEST_DATABASE_URL)('Exclusión e inmutabilidad en PostgreSQL', () => {
  let base: BasePrueba;
  let repos: Repositorios;

  beforeAll(async () => {
    base = await conBase();
    repos = crearRepositoriosPostgres(base.sql, base.esquema);
    await cargarBase(repos);
  }, TIMEOUT_POSTGRES);

  afterAll(async () => { await base?.cerrar(); }, TIMEOUT_POSTGRES);

  /** Simula que la validación previa no vio el conflicto: solo la exclusión de la base puede frenarlo. */
  async function appSinLecturaPrevia() {
    return buildApp({ repos: { ...repos, turnos: { ...repos.turnos, listar: async () => [] } }, clock, auth, notificador });
  }

  it('Dos recursos disponibles', async () => {
    const turno = turnoFicticio({ inicio: a('04'), fin: minutos(a('04'), 30) });
    await repos.turnos.guardar(turno);
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
  }, TIMEOUT_POSTGRES);

  it('La barrera de base detecta el mismo profesional', async () => {
    const ocupado = turnoFicticio({ inicio: a('05'), fin: minutos(a('05'), 30) });
    await repos.turnos.guardar(ocupado);
    const app = await appSinLecturaPrevia();
    try {
      const respuesta = await app.inject({
        method: 'POST', url: '/api/turnos', headers: equipo,
        payload: { profesionalId, boxId: SEED.boxes.box2.id, prestacionId, pacienteId, inicio: a('05').toISOString() },
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toEqual({ code: 'SOLAPAMIENTO_PROFESIONAL' });
    } finally { await app.close(); }
    expect(delDia(await repos.turnos.listar(), a('05'))).toEqual([ocupado]);
  }, TIMEOUT_POSTGRES);

  it('La barrera de base detecta el mismo box', async () => {
    const ocupado = turnoFicticio({ inicio: a('06'), fin: minutos(a('06'), 30) });
    await repos.turnos.guardar(ocupado);
    const app = await appSinLecturaPrevia();
    try {
      const respuesta = await app.inject({
        method: 'POST', url: '/api/turnos', headers: equipo,
        payload: { profesionalId: SEED.profesionales.brunoGomez.id, boxId, prestacionId, pacienteId, inicio: a('06').toISOString() },
      });
      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json()).toEqual({ code: 'SOLAPAMIENTO_BOX' });
    } finally { await app.close(); }
    expect(delDia(await repos.turnos.listar(), a('06'))).toEqual([ocupado]);
  }, TIMEOUT_POSTGRES);

  it('Turnos contiguos', async () => {
    const primero = turnoFicticio({ inicio: a('07', '10:00'), fin: a('07', '10:30') });
    const siguiente = turnoFicticio({ inicio: a('07', '10:30'), fin: a('07', '11:00') });
    await repos.turnos.guardar(primero);
    await repos.turnos.guardar(siguiente);
    expect(delDia(await repos.turnos.listar(), a('07'))).toEqual([primero, siguiente]);
  }, TIMEOUT_POSTGRES);

  it('Un turno cancelado no ocupa el intervalo', async () => {
    const cancelado = turnoFicticio({ inicio: a('08'), fin: minutos(a('08'), 30), estado: 'cancelado' });
    const nuevo = turnoFicticio({ inicio: a('08'), fin: minutos(a('08'), 30) });
    await repos.turnos.guardar(cancelado);
    await repos.turnos.guardar(nuevo);
    expect(delDia(await repos.turnos.listar(), a('08'))).toEqual([cancelado, nuevo]);
  }, TIMEOUT_POSTGRES);

  it('Cancelación con auditoría', async () => {
    const turno = turnoFicticio({ inicio: a('11'), fin: minutos(a('11'), 30) });
    await repos.turnos.guardar(turno);
    const app = await buildApp({ repos, clock, auth, notificador });
    try {
      const respuesta = await app.inject({ method: 'POST', url: `/api/turnos/${turno.id}/cancelar`, headers: equipo });
      expect(respuesta.statusCode).toBe(200);
    } finally { await app.close(); }
    expect(await repos.turnos.buscarPorId(turno.id)).toEqual({ ...turno, estado: 'cancelado' });
    expect(await repos.auditoria.listar(r => r.turnoId === turno.id)).toEqual([
      expect.objectContaining({ accion: 'cancelado', actor: SEED.usuarios.recepcion.id }),
    ]);
  }, TIMEOUT_POSTGRES);

  it('SQL directo intenta alterar el historial', async () => {
    const { sql, esquema } = base;
    const pacienteDos = SEED.pacientes.dos.id;
    const turno = turnoFicticio({ inicio: a('12'), fin: minutos(a('12'), 30), pacienteId: pacienteDos });
    await repos.turnos.guardar(turno);
    const auditoria = { id: randomUUID(), turnoId: turno.id, accion: 'creado' as const, actor: usuarioId, fecha: creadoEn, detalle: { despues: turno } };
    const historia = { id: randomUUID(), pacienteId: pacienteDos, profesionalId, fecha: a('12'), texto: 'Entrada ficticia' };
    const odontogramaId = randomUUID();
    const pieza = { id: randomUUID(), odontogramaId, pieza: 16, cara: 'oclusal' as const, estado: 'caries' as const, registradoPor: profesionalId, fecha: a('12') };
    await repos.auditoria.agregar(auditoria);
    await repos.historiaClinica.agregar(historia);
    await repos.estadosPieza.agregar(pieza);
    await repos.odontogramas.guardar({ id: odontogramaId, pacienteId: pacienteDos, actualizadoEn: a('12') });

    const prohibido = { code: '23514' };
    await expect(sql`delete from ${sql(esquema)}.turnos where id = ${turno.id}`).rejects.toMatchObject(prohibido);
    for (const [tabla, id] of [['auditoria', auditoria.id], ['historia_clinica', historia.id], ['estados_pieza', pieza.id]] as const) {
      await expect(sql`update ${sql(esquema)}.${sql(tabla)} set fecha = ${a('13')} where id = ${id}`).rejects.toMatchObject(prohibido);
      await expect(sql`delete from ${sql(esquema)}.${sql(tabla)} where id = ${id}`).rejects.toMatchObject(prohibido);
    }

    expect(await repos.turnos.buscarPorId(turno.id)).toEqual(turno);
    expect(await repos.auditoria.listar(r => r.id === auditoria.id)).toEqual([auditoria]);
    expect(await repos.historiaClinica.listar(r => r.id === historia.id)).toEqual([historia]);
    expect(await repos.estadosPieza.listar(r => r.id === pieza.id)).toEqual([pieza]);
  }, TIMEOUT_POSTGRES);

  it('Primera escritura con relaciones aún no materializadas', async () => {
    expect(await repos.odontogramas.listar(o => o.pacienteId === pacienteId)).toEqual([]);
    const app = await buildApp({ repos, clock, auth, notificador });
    try {
      const reserva = await app.inject({
        method: 'POST', url: '/api/paciente/turnos', headers: { authorization: 'Bearer paciente' },
        payload: { profesionalId, boxId, prestacionId, inicio: a('14').toISOString() },
      });
      expect(reserva.statusCode).toBe(201);
      const odontograma = await app.inject({
        method: 'PUT', url: `/api/pacientes/${pacienteId}/odontograma`, headers: { authorization: 'Bearer odontologia' },
        payload: { piezas: [{ pieza: 11, estado: 'caries', cara: 'oclusal' }] },
      });
      expect(odontograma.statusCode).toBe(200);
    } finally { await app.close(); }

    const [turno] = delDia(await repos.turnos.listar(), a('14'));
    expect(turno).toMatchObject({ pacienteId, origen: 'online' });
    expect(await repos.auditoria.listar(r => r.turnoId === turno?.id)).toEqual([expect.objectContaining({ accion: 'creado' })]);
    const [cabecera] = await repos.odontogramas.listar(o => o.pacienteId === pacienteId);
    expect(cabecera).toBeDefined();
    expect(await repos.estadosPieza.listar(e => e.odontogramaId === cabecera?.id)).toEqual([
      expect.objectContaining({ pieza: 11, cara: 'oclusal', estado: 'caries' }),
    ]);
  }, TIMEOUT_POSTGRES);
});
