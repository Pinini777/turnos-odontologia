import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AuditoriaTurno } from '../../src/shared/entidades';
import type { Repositorios } from '../../src/shared/repositorios';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { conBase } from './esquema';
import { boxId, cargarBase, fin, inicio, pacienteId, profesionalId, turnoFicticio, usuarioId } from './fixtures';

async function prepararPostgres(probar: (repos: Repositorios) => Promise<void>) {
  const { crearRepositoriosPostgres } = await import('../../src/shared/persistencia/repositorios-postgres');
  await conBase((sql, esquema) => probar(crearRepositoriosPostgres(sql, esquema)));
}

type Ejecutar = (probar: (repos: Repositorios) => Promise<void>) => Promise<void>;

function contrato(ejecutar: Ejecutar) {
  it('guarda, encuentra, filtra y actualiza sin cambiar el orden de inserción', () => ejecutar(async repos => {
    await cargarBase(repos);
    const primera = SEED.prestaciones.consulta;
    const actualizada = { ...primera, precio: 15000.25 };
    await repos.prestaciones.guardar(actualizada);
    expect(await repos.prestaciones.buscarPorId(primera.id)).toEqual(actualizada);
    expect(await repos.prestaciones.existe(primera.id)).toBe(true);
    const inexistente = randomUUID();
    expect(await repos.prestaciones.buscarPorId(inexistente)).toBeUndefined();
    expect(await repos.prestaciones.existe(inexistente)).toBe(false);
    expect((await repos.prestaciones.listar()).map(p => p.id)).toEqual(Object.values(SEED.prestaciones).map(p => p.id));
    expect(await repos.prestaciones.listar(p => p.precio === 15000.25)).toEqual([actualizada]);
    expect(await repos.usuarios.buscarPorId(usuarioId)).toEqual(SEED.usuarios.anaPerez);
    expect(await repos.profesionales.buscarPorId(profesionalId)).toEqual(SEED.profesionales.anaPerez);
    expect(await repos.boxes.buscarPorId(boxId)).toEqual(SEED.boxes.box1);
    expect(await repos.pacientes.buscarPorId(SEED.pacientes.dos.id)).toStrictEqual(SEED.pacientes.dos);
  }), 25_000);

  it('borra horarios y bloqueos sin alterar los demás repositorios', () => ejecutar(async repos => {
    await cargarBase(repos);
    const horario = SEED.horarios[0];
    if (!horario) throw new Error('Falta el horario de prueba.');
    const bloqueo = { id: randomUUID(), boxId, inicio, fin, motivo: 'Prueba ficticia' };
    await repos.bloqueos.guardar(bloqueo);
    expect(await repos.bloqueos.buscarPorId(bloqueo.id)).toStrictEqual(bloqueo);
    await repos.bloqueos.borrar(bloqueo.id);
    await repos.horarios.borrar(horario.id);
    expect(await repos.bloqueos.existe(bloqueo.id)).toBe(false);
    expect(await repos.horarios.existe(horario.id)).toBe(false);
    expect(await repos.profesionales.existe(horario.profesionalId)).toBe(true);
  }), 25_000);

  it('preserva objetos Date, opcionales ausentes y registros append-only', () => ejecutar(async repos => {
    await cargarBase(repos);
    const turno = turnoFicticio();
    const odontograma = { id: randomUUID(), pacienteId, actualizadoEn: inicio };
    const auditoria: AuditoriaTurno = {
      id: randomUUID(), turnoId: turno.id, accion: 'creado', actor: 'paciente', fecha: inicio,
      detalle: { despues: turno, anidado: [fin], literal: inicio.toISOString() },
    };
    const historial = { id: randomUUID(), pacienteId, profesionalId, fecha: fin, texto: 'Prueba ficticia' };
    const pieza = { id: randomUUID(), odontogramaId: odontograma.id, pieza: 11, estado: 'sano' as const, registradoPor: profesionalId, fecha: fin };
    await repos.auditoria.agregar(auditoria);
    await repos.turnos.guardar(turno);
    await repos.historiaClinica.agregar(historial);
    await repos.estadosPieza.agregar(pieza);
    await repos.odontogramas.guardar(odontograma);
    expect(await repos.turnos.buscarPorId(turno.id)).toStrictEqual(turno);
    expect(await repos.odontogramas.buscarPorId(odontograma.id)).toStrictEqual(odontograma);
    expect(await repos.auditoria.listar(a => a.turnoId === turno.id)).toStrictEqual([auditoria]);
    expect(await repos.historiaClinica.listar()).toStrictEqual([historial]);
    expect(await repos.estadosPieza.listar()).toStrictEqual([pieza]);
  }), 25_000);
}

describe('contrato de repositorios en memoria', () => contrato(probar => probar(crearRepositoriosEnMemoria({ seed: false }))));
describe.skipIf(!process.env.TEST_DATABASE_URL)('contrato de repositorios PostgreSQL', () => contrato(prepararPostgres));
