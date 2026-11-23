import { describe, expect, it } from 'vitest';
import {
  VENTANA_AUTOGESTION_MS,
  verificarPlazo24h,
  verificarPropiedadTurno,
} from '../../src/modules/reserva-online/dominio/autogestion';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { SEED } from '../../src/shared/seed';

function turnoDePrueba(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-ficticio-1',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-12-01T10:00:00-03:00'),
    fin: new Date('2026-12-01T10:30:00-03:00'),
    estado: 'reservado',
    origen: 'online',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.paciente1.id,
    creadoEn: new Date('2026-11-29T09:00:00-03:00'),
    ...overrides,
  };
}

describe('dominio autogestion — verificarPropiedadTurno', () => {
  it('devuelve el turno cuando pertenece al paciente', () => {
    const turno = turnoDePrueba();
    expect(verificarPropiedadTurno(turno, SEED.pacientes.uno.id)).toEqual(turno);
  });

  it('rechaza con NO_ENCONTRADO cuando el turno no existe', () => {
    expect(() => verificarPropiedadTurno(undefined, SEED.pacientes.uno.id)).toThrow(
      new ReglaDeNegocioError('NO_ENCONTRADO'),
    );
  });

  it('rechaza con NO_ENCONTRADO cuando el turno pertenece a otro paciente', () => {
    const turnoAjeno = turnoDePrueba({ pacienteId: SEED.pacientes.dos.id });
    expect(() => verificarPropiedadTurno(turnoAjeno, SEED.pacientes.uno.id)).toThrow(
      new ReglaDeNegocioError('NO_ENCONTRADO'),
    );
  });

  it('devuelve el turno propio incluso si esta en estado cancelado (la propiedad es independiente del estado)', () => {
    const turnoCancelado = turnoDePrueba({ estado: 'cancelado' });
    expect(verificarPropiedadTurno(turnoCancelado, SEED.pacientes.uno.id)).toEqual(turnoCancelado);
  });
});

describe('dominio autogestion — verificarPlazo24h', () => {
  it('define la ventana de autogestion en 24 horas exactas en milisegundos', () => {
    expect(VENTANA_AUTOGESTION_MS).toBe(86_400_000);
  });

  it('permite operar con 25 horas de anticipacion', () => {
    const inicio = new Date('2026-12-01T10:00:00-03:00');
    const ahora = new Date('2026-11-30T09:00:00-03:00');
    expect(() => verificarPlazo24h(inicio, ahora)).not.toThrow();
  });

  it('permite operar en el borde exacto de 24 horas de anticipacion', () => {
    const inicio = new Date('2026-12-01T10:00:00-03:00');
    const ahora = new Date('2026-11-30T10:00:00-03:00');
    expect(() => verificarPlazo24h(inicio, ahora)).not.toThrow();
  });

  it('permite el borde exacto de 24 horas comparando instantes UTC entre distintos offsets', () => {
    const inicioUtc = new Date('2026-12-01T13:00:00Z');
    const ahoraMendoza = new Date('2026-11-30T10:00:00-03:00');
    expect(() => verificarPlazo24h(inicioUtc, ahoraMendoza)).not.toThrow();
  });

  it('rechaza con PLAZO_VENCIDO a 24 horas menos 1 milisegundo', () => {
    const inicio = new Date('2026-12-01T10:00:00.000-03:00');
    const ahora = new Date('2026-11-30T10:00:00.001-03:00');
    expect(() => verificarPlazo24h(inicio, ahora)).toThrow(new ReglaDeNegocioError('PLAZO_VENCIDO'));
  });

  it('rechaza con PLAZO_VENCIDO con 23 horas de anticipacion', () => {
    const inicio = new Date('2026-12-01T10:00:00-03:00');
    const ahora = new Date('2026-11-30T11:00:00-03:00');
    expect(() => verificarPlazo24h(inicio, ahora)).toThrow(new ReglaDeNegocioError('PLAZO_VENCIDO'));
  });

  it('rechaza con PLAZO_VENCIDO cuando el turno ya empezo o esta en el pasado', () => {
    const inicio = new Date('2026-12-01T10:00:00-03:00');
    expect(() => verificarPlazo24h(inicio, new Date('2026-12-01T10:00:00-03:00'))).toThrow(
      new ReglaDeNegocioError('PLAZO_VENCIDO'),
    );
    expect(() => verificarPlazo24h(inicio, new Date('2026-12-01T10:30:00-03:00'))).toThrow(
      new ReglaDeNegocioError('PLAZO_VENCIDO'),
    );
  });

  it('rechaza con PLAZO_VENCIDO ante fechas invalidas (NaN)', () => {
    const inicio = new Date('2026-12-01T10:00:00-03:00');
    expect(() => verificarPlazo24h(inicio, new Date(Number.NaN))).toThrow(
      new ReglaDeNegocioError('PLAZO_VENCIDO'),
    );
  });
});
