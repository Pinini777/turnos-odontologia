import { describe, expect, it } from 'vitest';
import {
  filtrarPorRecursos,
  ordenarPorFecha,
  ordenarPorInicio,
  turnosEnRango,
} from '../../src/modules/agenda/dominio/agenda';
import { SEED } from '../../src/shared/seed';
import { lunes, registro, turno } from './fixtures';

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);
const RANGO = { desde: lunes('09:00'), hasta: lunes('13:00') };

describe('turnosEnRango: intervalo [desde, hasta) sobre inicio', () => {
  it('Turno que empieza exactamente en `desde` se incluye', () => {
    expect(ids(turnosEnRango([turno({ id: 'a', inicio: lunes('09:00') })], RANGO))).toEqual(['a']);
  });

  it('Turno que empieza exactamente en `hasta` se excluye', () => {
    const turnos = [turno({ id: 'a', inicio: lunes('13:00') }), turno({ id: 'b', inicio: lunes('12:30') })];
    expect(ids(turnosEnRango(turnos, RANGO))).toEqual(['b']);
  });

  it('un turno anterior a `desde` queda afuera', () => {
    expect(turnosEnRango([turno({ inicio: lunes('08:45') })], RANGO)).toEqual([]);
  });
});

describe('filtrarPorRecursos: filtros opcionales combinados con AND', () => {
  const turnos = [
    turno({ id: 'ana-box1' }),
    turno({ id: 'ana-box2', boxId: SEED.boxes.box2.id }),
    turno({ id: 'bruno-box1', profesionalId: SEED.profesionales.brunoGomez.id }),
  ];

  it('sin filtros devuelve todos', () => {
    expect(ids(filtrarPorRecursos(turnos, {}))).toEqual(['ana-box1', 'ana-box2', 'bruno-box1']);
  });

  it('filtra por profesional', () => {
    expect(ids(filtrarPorRecursos(turnos, { profesionalId: SEED.profesionales.anaPerez.id }))).toEqual([
      'ana-box1',
      'ana-box2',
    ]);
  });

  it('filtra por box', () => {
    expect(ids(filtrarPorRecursos(turnos, { boxId: SEED.boxes.box2.id }))).toEqual(['ana-box2']);
  });

  it('combina profesional y box con AND', () => {
    const filtro = { profesionalId: SEED.profesionales.anaPerez.id, boxId: SEED.boxes.box1.id };
    expect(ids(filtrarPorRecursos(turnos, filtro))).toEqual(['ana-box1']);
  });

  it('un id que no existe devuelve []', () => {
    expect(filtrarPorRecursos(turnos, { boxId: 'no-existe' })).toEqual([]);
  });
});

describe('orden determinista', () => {
  it('ordena por inicio ascendente sin mutar la entrada', () => {
    const turnos = [
      turno({ id: '11', inicio: lunes('11:00') }),
      turno({ id: '09', inicio: lunes('09:00') }),
      turno({ id: '10', inicio: lunes('10:00') }),
    ];
    expect(ids(ordenarPorInicio(turnos))).toEqual(['09', '10', '11']);
    expect(ids(turnos)).toEqual(['11', '09', '10']);
  });

  it('un empate de inicio conserva el orden de entrada', () => {
    const turnos = [turno({ id: 'box2', boxId: SEED.boxes.box2.id }), turno({ id: 'box1' })];
    expect(ids(ordenarPorInicio(turnos))).toEqual(['box2', 'box1']);
  });

  it('ordena la auditoría por fecha y conserva el orden de entrada en empates', () => {
    const registros = [
      registro({ id: 'tarde', fecha: lunes('09:15') }),
      registro({ id: 'empate-1', fecha: lunes('08:30') }),
      registro({ id: 'empate-2', fecha: lunes('08:30') }),
    ];
    expect(ids(ordenarPorFecha(registros))).toEqual(['empate-1', 'empate-2', 'tarde']);
  });
});
