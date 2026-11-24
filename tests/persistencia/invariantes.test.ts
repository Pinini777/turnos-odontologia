import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import { SEED } from '../../src/shared/seed';
import { crearRepositoriosPostgres, TABLAS_APLICACION } from '../../src/shared/persistencia/repositorios-postgres';
import type { AuthPort } from '../../src/shared/sesion';
import { conBase, conEsquema } from './esquema';
import { boxId, cargarBase, creadoEn, fin, inicio, pacienteId, prestacionId, profesionalId, turnoFicticio, usuarioId } from './fixtures';

const auth: AuthPort = {
  verificar: async token => {
    if (token === 'equipo') return { rol: 'recepcionista', usuarioId: SEED.usuarios.recepcion.id };
    if (token === 'odontologia') return { rol: 'profesional', usuarioId, profesionalId };
    if (token === 'paciente') return { rol: 'paciente', usuarioId: SEED.usuarios.paciente1.id, pacienteId };
    return null;
  },
};
const clock = new FixedClock(creadoEn);
const turnoJson = { profesionalId, boxId, prestacionId, pacienteId, inicio: inicio.toISOString() };

describe.skipIf(!process.env.TEST_DATABASE_URL)('invariantes en PostgreSQL', () => {
  it('no deja el esquema de prueba si falla el trabajo', async () => {
    let nombre = '';
    await expect(conEsquema(async (_sql, esquema) => {
      nombre = esquema;
      throw new Error('Falla ficticia');
    })).rejects.toThrow('Falla ficticia');
    await conEsquema(async (sql, otro) => {
      expect(otro).not.toBe(nombre);
      const [fila] = await sql<{ eliminado: boolean }[]>`select to_regnamespace(${nombre}) is null as eliminado`;
      expect(fila?.eliminado).toBe(true);
    });
  }, 30_000);

  it('habilita RLS sin políticas ni acceso público para todas las tablas y el registro', () => conBase(async (sql, esquema) => {
    const filas = await sql<{ nombre: string; rls: boolean; expuesto: boolean; politicas: number }[]>`
      select c.relname as nombre, c.relrowsecurity as rls,
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
          or has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as expuesto,
        (select count(*)::int from pg_policy p where p.polrelid = c.oid) as politicas
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = ${esquema} and c.relkind = 'r'`;
    expect(filas.map(f => f.nombre).sort()).toEqual([...TABLAS_APLICACION, 'schema_migrations'].sort());
    for (const fila of filas) expect(fila).toMatchObject({ rls: true, expuesto: false, politicas: 0 });
  }), 25_000);

  it('traduce cada exclusión SQL a 409 aunque la lectura previa todavía no vea el conflicto', () => conBase(async (sql, esquema) => {
    const repos = crearRepositoriosPostgres(sql, esquema);
    await cargarBase(repos);
    const original = turnoFicticio();
    await repos.turnos.guardar(original);
    const app = await buildApp({ repos: { ...repos, turnos: { ...repos.turnos, listar: async () => [] } }, clock, auth });
    try {
      const casos = [
        { datos: { ...turnoJson, boxId: SEED.boxes.box2.id }, code: 'SOLAPAMIENTO_PROFESIONAL' },
        { datos: { ...turnoJson, profesionalId: SEED.profesionales.brunoGomez.id }, code: 'SOLAPAMIENTO_BOX' },
      ];
      for (const { datos, code } of casos) {
        const respuesta = await app.inject({ method: 'POST', url: '/api/turnos', headers: { authorization: 'Bearer equipo' }, payload: datos });
        expect(respuesta.statusCode).toBe(409);
        expect(respuesta.json()).toEqual({ code });
      }
      expect(await repos.turnos.listar()).toEqual([original]);
    } finally { await app.close(); }
  }), 40_000);

  it('acepta turnos contiguos y reutiliza el intervalo de un cancelado sin borrarlo', () => conBase(async (sql, esquema) => {
    const repos = crearRepositoriosPostgres(sql, esquema);
    await cargarBase(repos);
    const primero = turnoFicticio();
    const contiguo = turnoFicticio({ inicio: fin, fin: new Date('2027-01-04T13:00:00Z') });
    await repos.turnos.guardar(primero);
    await repos.turnos.guardar(contiguo);
    const cancelado = { ...primero, estado: 'cancelado' as const };
    await repos.turnos.guardar(cancelado);
    const reemplazo = turnoFicticio();
    await repos.turnos.guardar(reemplazo);
    expect(await repos.turnos.listar()).toEqual([cancelado, contiguo, reemplazo]);
  }), 35_000);

  it('rechaza duplicados de C-04 y permite que la ficha use el correo de su propia cuenta', () => conBase(async (sql, esquema) => {
    const repos = crearRepositoriosPostgres(sql, esquema);
    await cargarBase(repos);
    const ficha = SEED.pacientes.dos;
    await expect(repos.usuarios.guardar({ ...SEED.usuarios.paciente1, id: randomUUID(), email: ' PACIENTE1@EXAMPLE.COM ' })).rejects.toMatchObject({ code: 'DUPLICADO' });
    await expect(repos.pacientes.guardar({ ...ficha, id: randomUUID(), email: 'distinto@example.com' })).rejects.toMatchObject({ code: 'DUPLICADO' });
    await expect(repos.pacientes.guardar({ ...ficha, id: randomUUID(), documento: '00000199' })).rejects.toMatchObject({ code: 'DUPLICADO' });
    const app = await buildApp({ repos, clock });
    try {
      const { documento, email, nombre, apellido } = ficha;
      const respuesta = await app.inject({ method: 'POST', url: '/api/public/pacientes/registro', payload: { documento, email, nombre, apellido, password: 'paciente-ficticio-ejemplo' } });
      expect(respuesta.statusCode).toBe(201);
      const paciente = await repos.pacientes.buscarPorId(ficha.id);
      expect(paciente?.usuarioId).toBeTypeOf('string');
      expect(await repos.usuarios.buscarPorId(paciente?.usuarioId ?? '')).toMatchObject({ email });
    } finally { await app.close(); }
  }), 40_000);

  it('conserva la reserva online y el primer odontograma y protege la escritura append-only', () => conBase(async (sql, esquema) => {
    const repos = crearRepositoriosPostgres(sql, esquema);
    await cargarBase(repos);
    const app = await buildApp({ repos, clock, auth, notificador: { enviar: () => Promise.resolve() } });
    try {
      const online = await app.inject({ method: 'POST', url: '/api/paciente/turnos', headers: { authorization: 'Bearer paciente' }, payload: { profesionalId, boxId, prestacionId, inicio: inicio.toISOString() } });
      expect(online.statusCode).toBe(201);
      const odontograma = await app.inject({ method: 'PUT', url: `/api/pacientes/${pacienteId}/odontograma`, headers: { authorization: 'Bearer odontologia' }, payload: { piezas: [{ pieza: 11, estado: 'caries', cara: 'oclusal' }] } });
      expect(odontograma.statusCode).toBe(200);
      await repos.historiaClinica.agregar({ id: randomUUID(), pacienteId, profesionalId, fecha: inicio, texto: 'Prueba ficticia' });
      const fila = await repos.turnos.listar();
      expect(fila).toHaveLength(1);
      const id = fila[0]?.id;
      expect(id).toBeTypeOf('string');
      expect(await repos.auditoria.listar()).toHaveLength(1);
      expect(await repos.estadosPieza.listar()).toHaveLength(1);
      expect(await repos.odontogramas.listar()).toHaveLength(1);
      await expect(sql`delete from ${sql(esquema)}.turnos where id = ${id ?? ''}`).rejects.toMatchObject({ code: '23514' });
      for (const tabla of ['auditoria', 'historia_clinica', 'estados_pieza']) {
        await expect(sql`update ${sql(esquema)}.${sql(tabla)} set fecha = ${fin}`).rejects.toMatchObject({ code: '23514' });
        await expect(sql`delete from ${sql(esquema)}.${sql(tabla)}`).rejects.toMatchObject({ code: '23514' });
      }
      expect(await repos.turnos.listar()).toEqual(fila);
      expect(await repos.auditoria.listar()).toHaveLength(1);
      expect(await repos.historiaClinica.listar()).toHaveLength(1);
      expect(await repos.estadosPieza.listar()).toHaveLength(1);
    } finally { await app.close(); }
  }), 50_000);
});
