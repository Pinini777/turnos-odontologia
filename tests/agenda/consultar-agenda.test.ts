import { describe, expect, it } from 'vitest';
import { consultarAgenda } from '../../src/modules/agenda/aplicacion/consultar-agenda';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { lunes, turno } from './fixtures';

const RANGO = { desde: lunes('09:00'), hasta: lunes('13:00') };

async function reposCon(turnos: Turno[]) {
  const repos = crearRepositoriosEnMemoria();
  for (const t of turnos) await repos.turnos.guardar(t);
  return repos;
}

describe('consultarAgenda (repositorios en memoria)', () => {
  it('El turno trae los cuatro resúmenes', async () => {
    const repos = await reposCon([turno()]);
    const [t] = await consultarAgenda(RANGO, { repos });

    expect(t).toMatchObject({
      id: 'turno-agenda-base',
      paciente: { id: SEED.pacientes.uno.id, nombre: 'Paciente', apellido: 'Ficticio Uno' },
      profesional: { id: SEED.profesionales.anaPerez.id, nombre: 'Dra. Ana Pérez' },
      box: { id: SEED.boxes.box1.id, nombre: 'Box 1' },
      prestacion: { id: SEED.prestaciones.consulta.id, nombre: 'Consulta', duracionMin: 30 },
    });
  });

  it('el resumen de la prestación no trae precio y el paciente no trae documento ni email', async () => {
    const repos = await reposCon([turno()]);
    const [t] = await consultarAgenda(RANGO, { repos });

    expect(t?.prestacion).toEqual({ id: SEED.prestaciones.consulta.id, nombre: 'Consulta', duracionMin: 30 });
    expect(t?.paciente).toEqual({ id: SEED.pacientes.uno.id, nombre: 'Paciente', apellido: 'Ficticio Uno' });
  });

  it('Los turnos cancelados aparecen con su estado', async () => {
    const repos = await reposCon([
      turno({ id: 'reservado' }),
      turno({ id: 'cancelado', estado: 'cancelado', inicio: lunes('10:00') }),
    ]);
    const agenda = await consultarAgenda(RANGO, { repos });

    expect(agenda.map((t) => [t.id, t.estado])).toEqual([
      ['reservado', 'reservado'],
      ['cancelado', 'cancelado'],
    ]);
  });

  it('Rango sin turnos devuelve una lista vacía', async () => {
    const repos = await reposCon([turno({ inicio: lunes('14:00') })]);
    expect(await consultarAgenda(RANGO, { repos })).toEqual([]);
  });

  it('aplica los filtros y ordena por inicio', async () => {
    const repos = await reposCon([
      turno({ id: 'ana-11', inicio: lunes('11:00') }),
      turno({ id: 'bruno-09', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id }),
      turno({ id: 'ana-10', inicio: lunes('10:00') }),
    ]);
    const agenda = await consultarAgenda(
      { ...RANGO, profesionalId: SEED.profesionales.anaPerez.id, boxId: SEED.boxes.box1.id },
      { repos },
    );

    expect(agenda.map((t) => t.id)).toEqual(['ana-10', 'ana-11']);
  });

  it('un turno con una referencia inexistente devuelve null en ese resumen sin romper la agenda', async () => {
    const repos = await reposCon([turno({ pacienteId: 'paciente-huerfano' })]);
    const [t] = await consultarAgenda(RANGO, { repos });

    expect(t?.paciente).toBeNull();
    expect(t?.profesional).toEqual({ id: SEED.profesionales.anaPerez.id, nombre: 'Dra. Ana Pérez' });
  });
});
