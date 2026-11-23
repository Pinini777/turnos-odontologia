import { describe, expect, it } from 'vitest';
import {
  calcularHuecosDisponibles,
  seleccionarBoxLibre,
} from '../../src/modules/reserva-online/dominio/disponibilidad';
import type { BloqueoAgenda, Box, HorarioAtencion, Profesional, Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { SEED } from '../../src/shared/seed';

const TZ = 'America/Argentina/Mendoza';
const d = (iso: string) => new Date(iso);

const PROFESIONALES: Profesional[] = [SEED.profesionales.anaPerez, SEED.profesionales.brunoGomez];
const BOXES: Box[] = [SEED.boxes.box1, SEED.boxes.box2];
const HORARIOS: HorarioAtencion[] = SEED.horarios;

function crearTurno(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-1',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: d('2026-11-30T09:00:00-03:00'),
    fin: d('2026-11-30T09:30:00-03:00'),
    estado: 'reservado',
    origen: 'online',
    precioAlReservar: 15000,
    creadoPor: SEED.usuarios.paciente1.id,
    creadoEn: d('2026-11-30T08:00:00-03:00'),
    ...overrides,
  };
}

describe('calcularHuecosDisponibles', () => {
  it('devuelve huecos en grilla de 15 min ordenados por inicio y profesionalId con boxes ordenados', () => {
    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T10:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.brunoGomez, SEED.profesionales.anaPerez],
      boxes: [SEED.boxes.box2, SEED.boxes.box1],
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });

    expect(huecos).toEqual([
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T09:45:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T09:45:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
    ]);
  });

  it('excluye huecos ocupados por turnos activos y bloqueos, conservando el hueco si queda otro box libre', () => {
    const turnoAna = crearTurno({
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      estado: 'reservado',
    });
    const bloqueoBox2: BloqueoAgenda = {
      id: 'bloqueo-box2',
      boxId: SEED.boxes.box2.id,
      inicio: d('2026-11-30T10:00:00-03:00'),
      fin: d('2026-11-30T10:30:00-03:00'),
      motivo: 'Mantenimiento',
    };

    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T11:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: PROFESIONALES,
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [bloqueoBox2],
      turnos: [turnoAna],
    });

    const huecosAna = huecos.filter((h) => h.profesionalId === SEED.profesionales.anaPerez.id);
    const huecosBruno = huecos.filter((h) => h.profesionalId === SEED.profesionales.brunoGomez.id);

    expect(huecosAna.map((h) => h.inicio.toISOString())).not.toContain(
      d('2026-11-30T09:00:00-03:00').toISOString(),
    );
    expect(huecosAna.map((h) => h.inicio.toISOString())).not.toContain(
      d('2026-11-30T09:15:00-03:00').toISOString(),
    );
    expect(huecosAna.map((h) => h.inicio.toISOString())).toContain(
      d('2026-11-30T09:30:00-03:00').toISOString(),
    );

    const bruno0900 = huecosBruno.find((h) => h.inicio.getTime() === d('2026-11-30T09:00:00-03:00').getTime());
    expect(bruno0900?.boxIds).toEqual([SEED.boxes.box2.id]);

    const bruno0915 = huecosBruno.find((h) => h.inicio.getTime() === d('2026-11-30T09:15:00-03:00').getTime());
    expect(bruno0915?.boxIds).toEqual([SEED.boxes.box2.id]);

    const enTramoBloqueoBox2 = huecos.filter(
      (h) =>
        h.inicio.getTime() >= d('2026-11-30T09:45:00-03:00').getTime() &&
        h.inicio.getTime() <= d('2026-11-30T10:15:00-03:00').getTime(),
    );
    expect(enTramoBloqueoBox2.length).toBe(6);
    for (const hueco of enTramoBloqueoBox2) {
      expect(hueco.boxIds).toEqual([SEED.boxes.box1.id]);
    }

    const ana1030 = huecosAna.find((h) => h.inicio.getTime() === d('2026-11-30T10:30:00-03:00').getTime());
    expect(ana1030?.boxIds).toEqual([SEED.boxes.box1.id, SEED.boxes.box2.id]);
  });

  it('no emite ningún hueco cuando todos los boxes activos están ocupados o bloqueados', () => {
    const turnoBox1 = crearTurno({
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      estado: 'confirmado',
    });
    const bloqueoBox2: BloqueoAgenda = {
      id: 'bloqueo-box2',
      boxId: SEED.boxes.box2.id,
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      motivo: 'Mantenimiento',
    };

    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T10:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: PROFESIONALES,
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [bloqueoBox2],
      turnos: [turnoBox1],
    });

    expect(huecos).toEqual([
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
    ]);
  });

  it('excluye huecos en bloqueo de profesional sin afectar al otro profesional y permite borde contiguo', () => {
    const bloqueoAna: BloqueoAgenda = {
      id: 'bloqueo-ana',
      profesionalId: SEED.profesionales.anaPerez.id,
      inicio: d('2026-11-30T10:00:00-03:00'),
      fin: d('2026-11-30T10:30:00-03:00'),
      motivo: 'Ausencia',
    };

    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:30:00-03:00'),
      hasta: d('2026-11-30T11:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: PROFESIONALES,
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [bloqueoAna],
      turnos: [],
    });

    const iniciosAna = huecos
      .filter((h) => h.profesionalId === SEED.profesionales.anaPerez.id)
      .map((h) => h.inicio.toISOString());
    const iniciosBruno = huecos
      .filter((h) => h.profesionalId === SEED.profesionales.brunoGomez.id)
      .map((h) => h.inicio.toISOString());

    expect(iniciosAna).toEqual([
      d('2026-11-30T09:30:00-03:00').toISOString(),
      d('2026-11-30T10:30:00-03:00').toISOString(),
    ]);
    expect(iniciosBruno).toHaveLength(5);
  });

  it('ignora turnos cancelados y respeta el borde contiguo [inicio, fin)', () => {
    const cancelado = crearTurno({
      id: 'turno-cancelado',
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      estado: 'cancelado',
    });
    const activo = crearTurno({
      id: 'turno-activo',
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
      inicio: d('2026-11-30T10:00:00-03:00'),
      fin: d('2026-11-30T10:30:00-03:00'),
      estado: 'reservado',
    });

    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T11:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.anaPerez],
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [cancelado, activo],
    });

    expect(huecos).toEqual([
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T09:45:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T10:30:00-03:00'),
        fin: d('2026-11-30T11:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
    ]);
  });

  it('excluye huecos en el pasado respecto a ahora e incluye el instante exacto igual a ahora', () => {
    const huecos = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T10:30:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T09:30:00-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.anaPerez],
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });

    expect(huecos.map((h) => h.inicio)).toEqual([
      d('2026-11-30T09:30:00-03:00'),
      d('2026-11-30T09:45:00-03:00'),
      d('2026-11-30T10:00:00-03:00'),
    ]);
  });

  it('alinea al siguiente múltiplo de 15 min cuando ahora o desde están fuera de grilla', () => {
    const huecosPorAhora = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T10:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T09:00:00.001-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.anaPerez],
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });
    expect(huecosPorAhora.map((h) => h.inicio)).toEqual([
      d('2026-11-30T09:15:00-03:00'),
      d('2026-11-30T09:30:00-03:00'),
    ]);

    const huecosPorDesde = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:07:00-03:00'),
      hasta: d('2026-11-30T10:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.anaPerez],
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });
    expect(huecosPorDesde.map((h) => h.inicio)).toEqual([
      d('2026-11-30T09:15:00-03:00'),
      d('2026-11-30T09:30:00-03:00'),
    ]);
  });

  it('respeta franjas horarias del profesional (corte de mediodía y fin de semana vacío)', () => {
    const huecosMediodia = calcularHuecosDisponibles({
      desde: d('2026-11-30T12:30:00-03:00'),
      hasta: d('2026-11-30T15:30:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: [SEED.profesionales.anaPerez],
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });

    expect(huecosMediodia.map((h) => [h.inicio, h.fin])).toEqual([
      [d('2026-11-30T12:30:00-03:00'), d('2026-11-30T13:00:00-03:00')],
      [d('2026-11-30T15:00:00-03:00'), d('2026-11-30T15:30:00-03:00')],
    ]);

    const huecosSabado = calcularHuecosDisponibles({
      desde: d('2026-12-05T09:00:00-03:00'),
      hasta: d('2026-12-05T12:00:00-03:00'),
      duracionMin: 30,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: PROFESIONALES,
      boxes: BOXES,
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });
    expect(huecosSabado).toEqual([]);
  });

  it('calcula correctamente prestaciones de 60 minutos e ignora recursos inactivos o rangos vacíos', () => {
    const huecos60 = calcularHuecosDisponibles({
      desde: d('2026-11-30T09:00:00-03:00'),
      hasta: d('2026-11-30T10:30:00-03:00'),
      duracionMin: 60,
      ahora: d('2026-11-30T08:00:00-03:00'),
      tz: TZ,
      profesionales: [
        SEED.profesionales.anaPerez,
        { ...SEED.profesionales.brunoGomez, activo: false },
      ],
      boxes: [SEED.boxes.box1, { ...SEED.boxes.box2, activo: false }],
      horarios: HORARIOS,
      bloqueos: [],
      turnos: [],
    });

    expect(huecos60).toEqual([
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T10:15:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id],
      },
    ]);

    expect(
      calcularHuecosDisponibles({
        desde: d('2026-11-30T10:00:00-03:00'),
        hasta: d('2026-11-30T10:00:00-03:00'),
        duracionMin: 30,
        ahora: d('2026-11-30T08:00:00-03:00'),
        tz: TZ,
        profesionales: PROFESIONALES,
        boxes: BOXES,
        horarios: HORARIOS,
        bloqueos: [],
        turnos: [],
      }),
    ).toEqual([]);
  });
});

describe('seleccionarBoxLibre', () => {
  it('elige el primer box activo libre ordenado por id', () => {
    const seleccionado = seleccionarBoxLibre({
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      boxes: [SEED.boxes.box2, SEED.boxes.box1],
      bloqueos: [],
      turnos: [],
    });

    expect(seleccionado).toEqual(SEED.boxes.box1);
  });

  it('saltea boxes inactivos, ocupados por turno activo o bloqueados y elige el siguiente libre', () => {
    const seleccionadoConTurno = seleccionarBoxLibre({
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      boxes: BOXES,
      bloqueos: [],
      turnos: [crearTurno({ boxId: SEED.boxes.box1.id })],
    });
    expect(seleccionadoConTurno).toEqual(SEED.boxes.box2);

    const seleccionadoConBloqueo = seleccionarBoxLibre({
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      boxes: BOXES,
      bloqueos: [
        {
          id: 'bloqueo-box1',
          boxId: SEED.boxes.box1.id,
          inicio: d('2026-11-30T09:15:00-03:00'),
          fin: d('2026-11-30T09:45:00-03:00'),
          motivo: 'Limpieza',
        },
      ],
      turnos: [],
    });
    expect(seleccionadoConBloqueo).toEqual(SEED.boxes.box2);

    const seleccionadoConInactivo = seleccionarBoxLibre({
      inicio: d('2026-11-30T09:00:00-03:00'),
      fin: d('2026-11-30T09:30:00-03:00'),
      boxes: [{ ...SEED.boxes.box1, activo: false }, SEED.boxes.box2],
      bloqueos: [],
      turnos: [],
    });
    expect(seleccionadoConInactivo).toEqual(SEED.boxes.box2);
  });

  it('considera libre un box con turno cancelado, turno contiguo o bloqueo de profesional', () => {
    const seleccionado = seleccionarBoxLibre({
      inicio: d('2026-11-30T09:30:00-03:00'),
      fin: d('2026-11-30T10:00:00-03:00'),
      boxes: BOXES,
      bloqueos: [
        {
          id: 'bloqueo-prof',
          profesionalId: SEED.profesionales.anaPerez.id,
          inicio: d('2026-11-30T09:30:00-03:00'),
          fin: d('2026-11-30T10:00:00-03:00'),
          motivo: 'Ausencia',
        },
      ],
      turnos: [
        crearTurno({
          id: 'contiguo',
          boxId: SEED.boxes.box1.id,
          inicio: d('2026-11-30T09:00:00-03:00'),
          fin: d('2026-11-30T09:30:00-03:00'),
          estado: 'reservado',
        }),
        crearTurno({
          id: 'cancelado',
          boxId: SEED.boxes.box1.id,
          inicio: d('2026-11-30T09:30:00-03:00'),
          fin: d('2026-11-30T10:00:00-03:00'),
          estado: 'cancelado',
        }),
      ],
    });

    expect(seleccionado).toEqual(SEED.boxes.box1);
  });

  it('lanza RECURSO_INACTIVO si no hay boxes activos', () => {
    expect(() =>
      seleccionarBoxLibre({
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        boxes: [{ ...SEED.boxes.box1, activo: false }],
        bloqueos: [],
        turnos: [],
      }),
    ).toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));

    expect(() =>
      seleccionarBoxLibre({
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        boxes: [],
        bloqueos: [],
        turnos: [],
      }),
    ).toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));
  });

  it('lanza SOLAPAMIENTO_BOX si todos los boxes están ocupados o al menos uno chocó con un turno activo', () => {
    expect(() =>
      seleccionarBoxLibre({
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        boxes: BOXES,
        bloqueos: [],
        turnos: [
          crearTurno({ id: 't1', boxId: SEED.boxes.box1.id }),
          crearTurno({
            id: 't2',
            profesionalId: SEED.profesionales.brunoGomez.id,
            boxId: SEED.boxes.box2.id,
          }),
        ],
      }),
    ).toThrowError(new ReglaDeNegocioError('SOLAPAMIENTO_BOX'));

    expect(() =>
      seleccionarBoxLibre({
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        boxes: BOXES,
        bloqueos: [
          {
            id: 'b2',
            boxId: SEED.boxes.box2.id,
            inicio: d('2026-11-30T09:00:00-03:00'),
            fin: d('2026-11-30T09:30:00-03:00'),
            motivo: 'Mantenimiento',
          },
        ],
        turnos: [crearTurno({ id: 't1', boxId: SEED.boxes.box1.id })],
      }),
    ).toThrowError(new ReglaDeNegocioError('SOLAPAMIENTO_BOX'));
  });

  it('lanza EN_BLOQUEO cuando todos los boxes activos están bloqueados sin choque de turno activo', () => {
    expect(() =>
      seleccionarBoxLibre({
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        boxes: BOXES,
        bloqueos: [
          {
            id: 'b1',
            boxId: SEED.boxes.box1.id,
            inicio: d('2026-11-30T09:00:00-03:00'),
            fin: d('2026-11-30T09:30:00-03:00'),
            motivo: 'Mantenimiento 1',
          },
          {
            id: 'b2',
            boxId: SEED.boxes.box2.id,
            inicio: d('2026-11-30T09:00:00-03:00'),
            fin: d('2026-11-30T09:30:00-03:00'),
            motivo: 'Mantenimiento 2',
          },
        ],
        turnos: [crearTurno({ id: 't-cancelado', boxId: SEED.boxes.box1.id, estado: 'cancelado' })],
      }),
    ).toThrowError(new ReglaDeNegocioError('EN_BLOQUEO'));
  });
});
