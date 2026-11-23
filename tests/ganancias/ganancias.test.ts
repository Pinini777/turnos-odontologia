import { describe, expect, it } from 'vitest';
import { calcularGanancias } from '../../src/modules/ganancias/aplicacion/calcular-ganancias';
import { sumarGanancias } from '../../src/modules/ganancias/dominio/ganancias';
import type { EstadoTurno, Turno } from '../../src/shared/entidades';
import { SinPermisoError } from '../../src/shared/errores';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { SESIONES } from '../plataforma/helpers';
import { guardarTurnoDeGanancias, PERIODO, SESION_BRUNO } from './fixtures';

/** Lunes 23/11/2026, 09:00 a 13:00 de Mendoza (UTC-3): ver `fixtures.ts`. */
function turno(estado: EstadoTurno, precioAlReservar: number, inicio: string, fin: string): Turno {
  return {
    id: `turno-${estado}-${inicio}-${String(precioAlReservar)}`,
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date(inicio),
    fin: new Date(fin),
    estado,
    origen: 'recepcion',
    precioAlReservar,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-20T12:00:00Z'),
  };
}

describe('sumarGanancias (dominio)', () => {
  it('suma los tres turnos atendidos del período: 15000 + 25000 + 10000 = 50000', () => {
    const turnos = [
      turno('atendido', 15000, '2026-11-23T12:00:00Z', '2026-11-23T12:30:00Z'),
      turno('atendido', 25000, '2026-11-23T13:00:00Z', '2026-11-23T13:45:00Z'),
      turno('atendido', 10000, '2026-11-23T15:00:00Z', '2026-11-23T15:15:00Z'),
    ];
    expect(sumarGanancias(turnos, PERIODO)).toBe(50000);
  });

  it('devuelve 0 cuando no hay turnos atendidos en el período', () => {
    const turnos = [
      turno('atendido', 15000, '2026-11-24T12:00:00Z', '2026-11-24T12:30:00Z'),
      turno('reservado', 25000, '2026-11-23T13:00:00Z', '2026-11-23T13:45:00Z'),
    ];
    expect(sumarGanancias(turnos, PERIODO)).toBe(0);
  });

  it('ignora cancelados y ausentes: solo cuenta el atendido de 15000', () => {
    const turnos = [
      turno('atendido', 15000, '2026-11-23T12:00:00Z', '2026-11-23T12:30:00Z'),
      turno('cancelado', 25000, '2026-11-23T13:00:00Z', '2026-11-23T13:45:00Z'),
      turno('ausente', 40000, '2026-11-23T14:00:00Z', '2026-11-23T15:00:00Z'),
    ];
    expect(sumarGanancias(turnos, PERIODO)).toBe(15000);
  });

  it('ignora reservados y confirmados: solo cuenta el atendido de 15000', () => {
    const turnos = [
      turno('atendido', 15000, '2026-11-23T12:00:00Z', '2026-11-23T12:30:00Z'),
      turno('reservado', 25000, '2026-11-23T13:00:00Z', '2026-11-23T13:45:00Z'),
      turno('confirmado', 40000, '2026-11-23T14:00:00Z', '2026-11-23T15:00:00Z'),
    ];
    expect(sumarGanancias(turnos, PERIODO)).toBe(15000);
  });

  it('incluye el turno que empieza exactamente en desde', () => {
    const turnos = [turno('atendido', 15000, '2026-11-23T12:00:00Z', '2026-11-23T12:30:00Z')];
    expect(sumarGanancias(turnos, PERIODO)).toBe(15000);
  });

  it('excluye el turno que empieza exactamente en hasta', () => {
    const turnos = [
      turno('atendido', 10000, '2026-11-23T14:00:00Z', '2026-11-23T14:15:00Z'),
      turno('atendido', 15000, '2026-11-23T15:00:00Z', '2026-11-23T15:30:00Z'),
    ];
    expect(sumarGanancias(turnos, { desde: PERIODO.desde, hasta: new Date('2026-11-23T15:00:00Z') })).toBe(10000);
  });

  it('no cuenta un turno que empieza antes de desde aunque termine dentro del período', () => {
    const turnos = [turno('atendido', 15000, '2026-11-23T12:45:00Z', '2026-11-23T13:15:00Z')];
    expect(sumarGanancias(turnos, { desde: new Date('2026-11-23T13:00:00Z'), hasta: PERIODO.hasta })).toBe(0);
  });

  it('suma con decimales sin arrastre: 10000.10 + 20000.20 = 30000.30', () => {
    const turnos = [
      turno('atendido', 10000.1, '2026-11-23T12:00:00Z', '2026-11-23T12:30:00Z'),
      turno('atendido', 20000.2, '2026-11-23T13:00:00Z', '2026-11-23T13:45:00Z'),
    ];
    expect(sumarGanancias(turnos, PERIODO)).toBe(30000.3);
  });
});

describe('calcularGanancias (caso de uso)', () => {
  const pedidoDeAna = (repos: Awaited<ReturnType<typeof crearRepositoriosEnMemoria>>) =>
    calcularGanancias(
      { sesion: SESIONES.prof, profesionalId: SEED.profesionales.anaPerez.id, ...PERIODO },
      { repos },
    );

  it('suma los turnos atendidos del período: 15000 + 25000 + 10000 = 50000', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-1', precioAlReservar: 15000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T12:30:00Z'),
    });
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-2', precioAlReservar: 25000,
      inicio: new Date('2026-11-23T13:00:00Z'), fin: new Date('2026-11-23T13:45:00Z'),
    });
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-3', precioAlReservar: 10000,
      inicio: new Date('2026-11-23T15:00:00Z'), fin: new Date('2026-11-23T15:15:00Z'),
    });

    await expect(pedidoDeAna(repos)).resolves.toBe(50000);
  });

  it('devuelve 0 si el período no tiene turnos atendidos', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-otro-dia', estado: 'atendido', precioAlReservar: 15000,
      inicio: new Date('2026-11-24T12:00:00Z'), fin: new Date('2026-11-24T12:30:00Z'),
    });
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-reservado', estado: 'reservado', precioAlReservar: 25000,
      inicio: new Date('2026-11-23T13:00:00Z'), fin: new Date('2026-11-23T13:45:00Z'),
    });

    await expect(pedidoDeAna(repos)).resolves.toBe(0);
  });

  it('solo cuenta los turnos de la profesional dueña: el de Bruno no se suma', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-1', precioAlReservar: 15000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T12:30:00Z'),
    });
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-2', precioAlReservar: 25000,
      inicio: new Date('2026-11-23T13:00:00Z'), fin: new Date('2026-11-23T13:45:00Z'),
    });
    await guardarTurnoDeGanancias(repos, {
      id: 'bruno-1', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id,
      precioAlReservar: 40000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T13:00:00Z'),
    });

    await expect(pedidoDeAna(repos)).resolves.toBe(40000);
  });

  it('usa precioAlReservar aunque la prestación hoy tenga otro precio (RN-GA-02)', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.prestaciones.guardar({ ...SEED.prestaciones.consulta, precio: 20000 });
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-congelado', prestacionId: SEED.prestaciones.consulta.id, precioAlReservar: 15000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T12:30:00Z'),
    });

    await expect(pedidoDeAna(repos)).resolves.toBe(15000);
  });

  it('otro profesional pidiendo el id ajeno lanza SinPermisoError (propiedad en el caso de uso)', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnoDeGanancias(repos, {
      id: 'ana-1', precioAlReservar: 15000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T12:30:00Z'),
    });

    await expect(
      calcularGanancias(
        { sesion: SESION_BRUNO, profesionalId: SEED.profesionales.anaPerez.id, ...PERIODO },
        { repos },
      ),
    ).rejects.toBeInstanceOf(SinPermisoError);
  });

  it('el profesional dueño sí accede a sus propias ganancias', async () => {
    const repos = crearRepositoriosEnMemoria();
    await guardarTurnoDeGanancias(repos, {
      id: 'bruno-1', profesionalId: SEED.profesionales.brunoGomez.id, boxId: SEED.boxes.box2.id,
      precioAlReservar: 40000,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T13:00:00Z'),
    });

    await expect(
      calcularGanancias(
        { sesion: SESION_BRUNO, profesionalId: SEED.profesionales.brunoGomez.id, ...PERIODO },
        { repos },
      ),
    ).resolves.toBe(40000);
  });
});
