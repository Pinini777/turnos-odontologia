import { describe, expect, it } from 'vitest';
import { consultarDisponibilidad } from '../../src/modules/reserva-online/aplicacion/disponibilidad';
import { FixedClock } from '../../src/shared/clock';
import type { BloqueoAgenda, Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

const d = (iso: string) => new Date(iso);

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

describe('consultarDisponibilidad', () => {
  it('devuelve huecos libres ordenados en modo público sin precios ni datos de pacientes', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.consulta.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T10:00:00-03:00'),
        soloReservablesOnline: true,
      },
      { repos, clock },
    );

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

    for (const hueco of huecos) {
      expect(Object.keys(hueco).sort()).toEqual(['boxIds', 'fin', 'inicio', 'profesionalId']);
      expect('precio' in hueco).toBe(false);
      expect('precioAlReservar' in hueco).toBe(false);
      expect('pacienteId' in hueco).toBe(false);
    }
  });

  it('excluye huecos ocupados por turnos activos y bloqueos desde repositorios conservando otro box libre', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await repos.turnos.guardar(
      crearTurno({
        id: 'turno-ana-0900',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        estado: 'reservado',
      }),
    );
    const bloqueoBox2: BloqueoAgenda = {
      id: 'bloqueo-box2-1000',
      boxId: SEED.boxes.box2.id,
      inicio: d('2026-11-30T10:00:00-03:00'),
      fin: d('2026-11-30T10:30:00-03:00'),
      motivo: 'Mantenimiento',
    };
    await repos.bloqueos.guardar(bloqueoBox2);

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.consulta.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T11:00:00-03:00'),
        soloReservablesOnline: true,
      },
      { repos, clock },
    );

    const anaEn0900 = huecos.find(
      (h) =>
        h.profesionalId === SEED.profesionales.anaPerez.id &&
        h.inicio.getTime() === d('2026-11-30T09:00:00-03:00').getTime(),
    );
    const brunoEn0900 = huecos.find(
      (h) =>
        h.profesionalId === SEED.profesionales.brunoGomez.id &&
        h.inicio.getTime() === d('2026-11-30T09:00:00-03:00').getTime(),
    );
    const anaEn1000 = huecos.find(
      (h) =>
        h.profesionalId === SEED.profesionales.anaPerez.id &&
        h.inicio.getTime() === d('2026-11-30T10:00:00-03:00').getTime(),
    );

    expect(anaEn0900).toBeUndefined();
    expect(brunoEn0900?.boxIds).toEqual([SEED.boxes.box2.id]);
    expect(anaEn1000?.boxIds).toEqual([SEED.boxes.box1.id]);
  });

  it('ignora turnos cancelados, respeta borde contiguo y filtra por profesionalId explícito', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await repos.turnos.guardar(
      crearTurno({
        id: 'cancelado-0900',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        estado: 'cancelado',
      }),
    );
    await repos.turnos.guardar(
      crearTurno({
        id: 'activo-1000',
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        inicio: d('2026-11-30T10:00:00-03:00'),
        fin: d('2026-11-30T10:30:00-03:00'),
        estado: 'reservado',
      }),
    );

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.consulta.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T11:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        soloReservablesOnline: true,
      },
      { repos, clock },
    );

    expect(huecos.every((h) => h.profesionalId === SEED.profesionales.anaPerez.id)).toBe(true);
    expect(huecos.map((h) => h.inicio)).toEqual([
      d('2026-11-30T09:00:00-03:00'),
      d('2026-11-30T09:15:00-03:00'),
      d('2026-11-30T09:30:00-03:00'),
      d('2026-11-30T10:30:00-03:00'),
    ]);
    expect(huecos[0]?.boxIds).toEqual([SEED.boxes.box1.id, SEED.boxes.box2.id]);
    expect(huecos[3]?.boxIds).toEqual([SEED.boxes.box1.id, SEED.boxes.box2.id]);
  });

  it('excluye huecos anteriores al FixedClock y arranca en el borde exacto de ahora', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T09:30:00-03:00');

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.consulta.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T10:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        soloReservablesOnline: true,
      },
      { repos, clock },
    );

    expect(huecos.map((h) => h.inicio)).toEqual([
      d('2026-11-30T09:30:00-03:00'),
      d('2026-11-30T09:45:00-03:00'),
      d('2026-11-30T10:00:00-03:00'),
    ]);
  });

  it('rechaza con NO_ENCONTRADO si la prestación no existe', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: '00000000-0000-4000-8000-999999999999',
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: true,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: '00000000-0000-4000-8000-999999999999',
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: false,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });

  it('rechaza con RECURSO_INACTIVO una prestación no reservable online en modo público o inactiva en cualquier modo', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: SEED.prestaciones.extraccion.id,
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:30:00-03:00'),
          soloReservablesOnline: true,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));

    await repos.prestaciones.guardar({ ...SEED.prestaciones.consulta, activa: false });

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: SEED.prestaciones.consulta.id,
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: true,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: SEED.prestaciones.consulta.id,
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: false,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));
  });

  it('habilita prestaciones activas con reservableOnline false en modo recepción sin exponer precios', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.extraccion.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T10:30:00-03:00'),
        soloReservablesOnline: false,
      },
      { repos, clock },
    );

    expect(huecos).toEqual([
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T10:00:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T10:15:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:15:00-03:00'),
        fin: d('2026-11-30T10:15:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
      {
        inicio: d('2026-11-30T09:30:00-03:00'),
        fin: d('2026-11-30T10:30:00-03:00'),
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxIds: [SEED.boxes.box1.id, SEED.boxes.box2.id],
      },
    ]);
  });

  it('valida profesionalId explícito inexistente (NO_ENCONTRADO) o inactivo (RECURSO_INACTIVO)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: SEED.prestaciones.consulta.id,
          profesionalId: '00000000-0000-4000-8000-999999999999',
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: true,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await repos.profesionales.guardar({ ...SEED.profesionales.brunoGomez, activo: false });

    await expect(
      consultarDisponibilidad(
        {
          prestacionId: SEED.prestaciones.consulta.id,
          profesionalId: SEED.profesionales.brunoGomez.id,
          desde: d('2026-11-30T09:00:00-03:00'),
          hasta: d('2026-11-30T10:00:00-03:00'),
          soloReservablesOnline: true,
        },
        { repos, clock },
      ),
    ).rejects.toThrowError(new ReglaDeNegocioError('RECURSO_INACTIVO'));
  });

  it('omite profesionales y boxes inactivos cuando no se filtra por profesionalId', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock('2026-11-30T08:00:00-03:00');

    await repos.profesionales.guardar({ ...SEED.profesionales.brunoGomez, activo: false });
    await repos.boxes.guardar({ ...SEED.boxes.box2, activo: false });

    const huecos = await consultarDisponibilidad(
      {
        prestacionId: SEED.prestaciones.consulta.id,
        desde: d('2026-11-30T09:00:00-03:00'),
        hasta: d('2026-11-30T09:30:00-03:00'),
        soloReservablesOnline: true,
      },
      { repos, clock },
    );

    expect(huecos).toEqual([
      {
        inicio: d('2026-11-30T09:00:00-03:00'),
        fin: d('2026-11-30T09:30:00-03:00'),
        profesionalId: SEED.profesionales.anaPerez.id,
        boxIds: [SEED.boxes.box1.id],
      },
    ]);
  });
});
