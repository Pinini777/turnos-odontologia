import { describe, expect, it } from 'vitest';
import { conflictos, enGrilla, seSuperponen } from '../../src/modules/turnos-alta/dominio/agenda';
import type { Turno } from '../../src/shared/entidades';

describe('Intervalos semiabiertos', () => {
  const primero = {
    inicio: new Date('2026-11-24T10:00:00-03:00'),
    fin: new Date('2026-11-24T10:30:00-03:00'),
  };
  const contiguo = {
    inicio: new Date('2026-11-24T10:30:00-03:00'),
    fin: new Date('2026-11-24T11:00:00-03:00'),
  };
  const solapado = {
    inicio: new Date('2026-11-24T10:15:00-03:00'),
    fin: new Date('2026-11-24T10:45:00-03:00'),
  };

  it('no considera superpuestos los intervalos contiguos en ningún orden', () => {
    expect(seSuperponen(primero, contiguo)).toBe(false);
    expect(seSuperponen(contiguo, primero)).toBe(false);
  });

  it('considera superpuestos los intervalos que coinciden desde las 10:15', () => {
    expect(seSuperponen(primero, solapado)).toBe(true);
    expect(seSuperponen(solapado, primero)).toBe(true);
  });
});

describe('Conflictos de agenda', () => {
  const turno: Turno = {
    id: 'turno-1',
    profesionalId: 'profesional-1',
    boxId: 'box-1',
    prestacionId: 'prestacion-1',
    pacienteId: 'paciente-1',
    inicio: new Date('2026-11-24T10:00:00-03:00'),
    fin: new Date('2026-11-24T10:30:00-03:00'),
    estado: 'reservado',
    origen: 'recepcion',
    precioAlReservar: 15000,
    creadoPor: 'usuario-1',
    creadoEn: new Date('2026-11-23T08:00:00-03:00'),
  };

  it('detecta un conflicto solo del profesional', () => {
    expect(conflictos([turno], { ...turno, boxId: 'box-2' })).toEqual({ profesional: true, box: false });
  });

  it('detecta un conflicto solo del box', () => {
    expect(conflictos([turno], { ...turno, profesionalId: 'profesional-2' })).toEqual({ profesional: false, box: true });
  });

  it('detecta conflictos de ambos recursos', () => {
    expect(conflictos([turno], turno)).toEqual({ profesional: true, box: true });
  });

  it('ignora turnos cancelados', () => {
    expect(conflictos([{ ...turno, estado: 'cancelado' }], turno)).toEqual({ profesional: false, box: false });
  });
});

describe('Grilla de 15 minutos', () => {
  it.each(['00', '15', '30', '45'])('acepta el minuto %s', (minuto) => {
    expect(enGrilla(new Date(`2026-11-24T10:${minuto}:00-03:00`), 'America/Argentina/Mendoza')).toBe(true);
  });

  it('rechaza un inicio a las 10:10', () => {
    expect(enGrilla(new Date('2026-11-24T10:10:00-03:00'), 'America/Argentina/Mendoza')).toBe(false);
  });

  it('rechaza un inicio con segundos', () => {
    expect(enGrilla(new Date('2026-11-24T10:15:30-03:00'), 'America/Argentina/Mendoza')).toBe(false);
  });

  it('rechaza un inicio con milisegundos', () => {
    expect(enGrilla(new Date('2026-11-24T10:15:00.001-03:00'), 'America/Argentina/Mendoza')).toBe(false);
  });
});
