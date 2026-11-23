import { describe, expect, it } from 'vitest';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';
import { crearNotificadorEnMemoria } from '../../src/modules/notificaciones';
import {
  reservarTurnoOnline,
  type DepsReserva,
} from '../../src/modules/reserva-online/aplicacion/reservar-turno';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import type { Notificador } from '../../src/shared/puertos';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

const LUNES_08_00 = '2026-11-30T08:00:00-03:00';
const LUNES_09_00 = '2026-11-30T09:00:00-03:00';
const LUNES_10_00 = '2026-11-30T10:00:00-03:00';
const LUNES_10_30 = '2026-11-30T10:30:00-03:00';

function crearContexto(ahoraIso: string = LUNES_08_00) {
  const repos = crearRepositoriosEnMemoria();
  const clock = new FixedClock(ahoraIso);
  const notificador = crearNotificadorEnMemoria();
  const disponibilidad = crearDisponibilidad(repos);
  const conLockDeAgenda = crearLockDeAgenda();
  return {
    repos,
    clock,
    notificador,
    disponibilidad,
    conLockDeAgenda,
  };
}

function crearTurnoSemilla(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-existente-1',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date(LUNES_10_00),
    fin: new Date(LUNES_10_30),
    estado: 'reservado',
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date(LUNES_08_00),
    ...overrides,
  };
}

describe('reservarTurnoOnline (C-11)', () => {
  it('crea un turno online feliz con boxId explícito, registra auditoría actor paciente y envía email con Calendar e .ics sin precio', async () => {
    const deps = crearContexto();

    const turno = await reservarTurnoOnline(
      {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        boxId: SEED.boxes.box1.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.estado).toBe('reservado');
    expect(turno.origen).toBe('online');
    expect(turno.pacienteId).toBe(SEED.pacientes.uno.id);
    expect(turno.profesionalId).toBe(SEED.profesionales.anaPerez.id);
    expect(turno.boxId).toBe(SEED.boxes.box1.id);
    expect(turno.precioAlReservar).toBe(SEED.prestaciones.consulta.precio);
    expect(turno.inicio).toEqual(new Date(LUNES_10_00));
    expect(turno.fin).toEqual(new Date(LUNES_10_30));

    const persistido = await deps.repos.turnos.buscarPorId(turno.id);
    expect(persistido).toEqual(turno);

    const auditorias = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.accion).toBe('creado');
    expect(auditorias[0]?.actor).toBe('paciente');

    expect(deps.notificador.bandeja).toHaveLength(1);
    const correo = deps.notificador.bandeja[0];
    expect(correo?.para).toBe(SEED.pacientes.uno.email);
    expect(correo?.texto).toContain('calendar.google.com');
    expect(correo?.texto).not.toContain('15000');
    expect(correo?.texto).not.toContain('15.000');
    const adjuntoIcs = correo?.adjuntos?.find((a) => a.nombre === 'turno.ics');
    expect(adjuntoIcs).toBeDefined();
    expect(adjuntoIcs?.contenido).toContain('BEGIN:VCALENDAR');
    expect(adjuntoIcs?.contenido).not.toContain('15000');
  });

  it('autoasigna el primer box activo libre cuando se omite boxId', async () => {
    const deps = crearContexto();
    await deps.repos.turnos.guardar(
      crearTurnoSemilla({
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
      }),
    );

    const turno = await reservarTurnoOnline(
      {
        pacienteId: SEED.pacientes.dos.id,
        profesionalId: SEED.profesionales.brunoGomez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.boxId).toBe(SEED.boxes.box2.id);
    expect(turno.origen).toBe('online');
    expect(turno.estado).toBe('reservado');
  });

  it('serializa reservas concurrentes sobre el mismo profesional y hueco: exactamente 1 tiene éxito y 1 falla con SOLAPAMIENTO_PROFESIONAL', async () => {
    const deps = crearContexto();

    const resultados = await Promise.allSettled([
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.dos.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ]);

    const exitosas = resultados.filter((r) => r.status === 'fulfilled');
    const fallidas = resultados.filter((r) => r.status === 'rejected');

    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]?.reason).toBeInstanceOf(ReglaDeNegocioError);
    expect((fallidas[0]?.reason as ReglaDeNegocioError).code).toBe('SOLAPAMIENTO_PROFESIONAL');

    const turnosGuardados = await deps.repos.turnos.listar();
    expect(turnosGuardados).toHaveLength(1);
  });

  it('rechaza prestación con reservableOnline: false o inactiva, profesional inactivo o box inactivo con RECURSO_INACTIVO', async () => {
    const deps = crearContexto();

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.extraccion.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'RECURSO_INACTIVO' });

    await deps.repos.profesionales.guardar({ ...SEED.profesionales.brunoGomez, activo: false });
    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.brunoGomez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'RECURSO_INACTIVO' });

    await deps.repos.boxes.guardar({ ...SEED.boxes.box2, activo: false });
    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          boxId: SEED.boxes.box2.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'RECURSO_INACTIVO' });

    expect(await deps.repos.turnos.listar()).toHaveLength(0);
  });

  it('rechaza con NO_ENCONTRADO cuando falta paciente, profesional, prestación o boxId explícito', async () => {
    const deps = crearContexto();

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: 'paciente-inexistente',
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          boxId: 'box-inexistente',
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });
  });

  it('rechaza violaciones de agenda: FUERA_DE_GRILLA, EN_EL_PASADO, FUERA_DE_HORARIO, EN_BLOQUEO y SOLAPAMIENTO_BOX', async () => {
    const deps = crearContexto(LUNES_09_00);

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date('2026-11-30T09:07:00-03:00'),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'FUERA_DE_GRILLA' });

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date('2026-11-30T08:45:00-03:00'),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'EN_EL_PASADO' });

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date('2026-11-30T14:00:00-03:00'),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'FUERA_DE_HORARIO' });

    await deps.repos.bloqueos.guardar({
      id: 'bloqueo-prof-1',
      profesionalId: SEED.profesionales.anaPerez.id,
      inicio: new Date('2026-11-30T11:00:00-03:00'),
      fin: new Date('2026-11-30T11:30:00-03:00'),
      motivo: 'Congreso',
    });
    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date('2026-11-30T11:00:00-03:00'),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'EN_BLOQUEO' });

    // Ocupar todos los boxes activos en 10:00-10:30 con otro profesional / turnos ficticios
    await deps.repos.turnos.guardar(
      crearTurnoSemilla({
        id: 'turno-box-1',
        profesionalId: SEED.profesionales.brunoGomez.id,
        boxId: SEED.boxes.box1.id,
      }),
    );
    await deps.repos.turnos.guardar(
      crearTurnoSemilla({
        id: 'turno-box-2',
        profesionalId: 'prof-tercero-ficticio',
        boxId: SEED.boxes.box2.id,
      }),
    );
    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'SOLAPAMIENTO_BOX' });
  });

  it('respeta overrides de DisponibilidadPort incluso cuando se omite boxId', async () => {
    const base = crearContexto();
    const deps: DepsReserva = {
      ...base,
      disponibilidad: {
        async verificar() {
          return 'EN_BLOQUEO';
        },
      },
    };

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'EN_BLOQUEO' });
  });

  it('no revierte la reserva online si falla el envío SMTP (RN-NO-02)', async () => {
    const base = crearContexto();
    const notificadorFallido: Notificador = {
      async enviar() {
        throw new Error('SMTP connection refused');
      },
    };
    const deps: DepsReserva = { ...base, notificador: notificadorFallido };

    const turno = await reservarTurnoOnline(
      {
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.estado).toBe('reservado');
    expect(await deps.repos.turnos.buscarPorId(turno.id)).toEqual(turno);
  });

  it('registra auditoría compensatoria revertido: true si falla guardar el turno', async () => {
    const base = crearContexto();
    const turnosFallido = {
      ...base.repos.turnos,
      listar: base.repos.turnos.listar.bind(base.repos.turnos),
      buscarPorId: base.repos.turnos.buscarPorId.bind(base.repos.turnos),
      existe: base.repos.turnos.existe.bind(base.repos.turnos),
      async guardar(): Promise<void> {
        throw new Error('Disk full');
      },
    };
    const deps: DepsReserva = {
      ...base,
      repos: { ...base.repos, turnos: turnosFallido },
    };

    await expect(
      reservarTurnoOnline(
        {
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toThrow('Disk full');

    const auditorias = await base.repos.auditoria.listar();
    expect(auditorias).toHaveLength(2);
    expect(auditorias[0]?.accion).toBe('creado');
    expect(auditorias[1]?.detalle).toMatchObject({ revertido: true });
  });
});
