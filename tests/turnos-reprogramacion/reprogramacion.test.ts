import { describe, expect, it } from 'vitest';
import { conflictos } from '../../src/modules/turnos-alta/dominio/agenda';
import {
  esReprogramable,
  intervaloNuevo,
  sinElPropio,
} from '../../src/modules/turnos-reprogramacion/dominio/reprogramacion';
import type { EstadoTurno } from '../../src/shared/entidades';
import { a, turnoDePrueba } from './fixtures';

describe('esReprogramable', () => {
  it.each(['reservado', 'confirmado'] as const)('%s se puede reprogramar', (estado) => {
    expect(esReprogramable(estado)).toBe(true);
  });

  it.each(['cancelado', 'atendido', 'ausente'] as const)('%s no se puede reprogramar', (estado: EstadoTurno) => {
    expect(esReprogramable(estado)).toBe(false);
  });
});

describe('intervaloNuevo', () => {
  it('calcula fin = inicio + duración en minutos', () => {
    expect(intervaloNuevo(a('11:00'), 30)).toEqual({ inicio: a('11:00'), fin: a('11:30') });
  });
});

describe('sinElPropio', () => {
  it('saca de la lista solo el turno con ese id', () => {
    const propio = turnoDePrueba({ id: 'propio' });
    const otro = turnoDePrueba({ id: 'otro', inicio: a('11:00'), fin: a('11:30') });
    expect(sinElPropio([propio, otro], 'propio')).toEqual([otro]);
  });

  it('borde: mover 15 min un turno de 10:00–10:30 a 10:15–10:45 no choca consigo mismo', () => {
    const propio = turnoDePrueba({ id: 'propio' });
    const movido = { ...propio, ...intervaloNuevo(a('10:15'), 30) };
    expect(conflictos([propio], movido)).toEqual({ profesional: true, box: true });
    expect(conflictos(sinElPropio([propio], propio.id), movido)).toEqual({ profesional: false, box: false });
  });
});
