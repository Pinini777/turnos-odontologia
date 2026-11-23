import { describe, expect, it } from 'vitest';
import {
  cancelarTurnoPaciente,
  listarTurnosPropios,
  obtenerIcsPropio,
  reprogramarTurnoPaciente,
} from '../../src/modules/reserva-online/aplicacion/autogestion-paciente';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';
import { crearNotificadorEnMemoria } from '../../src/modules/notificaciones';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

function crearContexto(ahoraIso = '2026-11-30T09:00:00-03:00') {
  const repos = crearRepositoriosEnMemoria();
  const clock = new FixedClock(ahoraIso);
  const notificador = crearNotificadorEnMemoria();
  const disponibilidad = crearDisponibilidad(repos);
  const conLockDeAgenda = crearLockDeAgenda();
  return { repos, clock, notificador, disponibilidad, conLockDeAgenda };
}

function crearTurnoBase(overrides: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-ficticio-100',
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

describe('autogestion paciente — listarTurnosPropios (Task 3.1)', () => {
  it('lista unicamente los turnos propios ordenados por inicio ascendente incluyendo cancelados', async () => {
    const deps = crearContexto();
    const turnoTarde = crearTurnoBase({
      id: 'turno-tarde',
      inicio: new Date('2026-12-02T11:00:00-03:00'),
      fin: new Date('2026-12-02T11:30:00-03:00'),
      estado: 'reservado',
    });
    const turnoTempranoCancelado = crearTurnoBase({
      id: 'turno-temprano-cancelado',
      inicio: new Date('2026-12-01T09:30:00-03:00'),
      fin: new Date('2026-12-01T10:00:00-03:00'),
      estado: 'cancelado',
    });
    const turnoAjeno = crearTurnoBase({
      id: 'turno-ajeno',
      pacienteId: SEED.pacientes.dos.id,
      inicio: new Date('2026-12-01T09:00:00-03:00'),
      fin: new Date('2026-12-01T09:30:00-03:00'),
    });

    await deps.repos.turnos.guardar(turnoTarde);
    await deps.repos.turnos.guardar(turnoTempranoCancelado);
    await deps.repos.turnos.guardar(turnoAjeno);

    const resultado = await listarTurnosPropios(SEED.pacientes.uno.id, deps);
    expect(resultado.map((t) => t.id)).toEqual(['turno-temprano-cancelado', 'turno-tarde']);
    expect(resultado.map((t) => t.estado)).toEqual(['cancelado', 'reservado']);
  });

  it('devuelve lista vacia cuando el paciente no tiene turnos aunque existan turnos de otros pacientes', async () => {
    const deps = crearContexto();
    await deps.repos.turnos.guardar(
      crearTurnoBase({ id: 'turno-de-dos', pacienteId: SEED.pacientes.dos.id }),
    );

    const resultado = await listarTurnosPropios(SEED.pacientes.uno.id, deps);
    expect(resultado).toEqual([]);
  });

  it('desempata de forma deterministica por id si dos turnos comparten el mismo inicio', async () => {
    const deps = crearContexto();
    await deps.repos.turnos.guardar(
      crearTurnoBase({
        id: 'turno-b',
        estado: 'cancelado',
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
      }),
    );
    await deps.repos.turnos.guardar(
      crearTurnoBase({
        id: 'turno-a',
        estado: 'reservado',
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
      }),
    );

    const resultado = await listarTurnosPropios(SEED.pacientes.uno.id, deps);
    expect(resultado.map((t) => t.id)).toEqual(['turno-a', 'turno-b']);
  });
});

describe('autogestion paciente — obtenerIcsPropio (Task 3.1)', () => {
  it('genera un archivo .ics RFC 5545 valido con profesional, box y prestacion sin precios', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({ id: 'turno-ics-1' });
    await deps.repos.turnos.guardar(turno);

    const ics = await obtenerIcsPropio(
      { turnoId: turno.id, pacienteId: SEED.pacientes.uno.id },
      deps,
    );

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:turno-turno-ics-1@turnos-odontologia.local');
    expect(ics).toContain('DTSTAMP:20261130T120000Z');
    expect(ics).toContain('DTSTART:20261201T130000Z');
    expect(ics).toContain('DTEND:20261201T133000Z');
    expect(ics).toContain(SEED.profesionales.anaPerez.nombre);
    expect(ics).toContain(SEED.boxes.box1.nombre);
    expect(ics).toContain(SEED.prestaciones.consulta.nombre);
    expect(ics).not.toContain(String(SEED.prestaciones.consulta.precio));
    expect(ics).not.toMatch(/precio/i);
  });

  it('rechaza con NO_ENCONTRADO si el turno pertenece a otro paciente', async () => {
    const deps = crearContexto();
    const turnoAjeno = crearTurnoBase({
      id: 'turno-ajeno-ics',
      pacienteId: SEED.pacientes.dos.id,
    });
    await deps.repos.turnos.guardar(turnoAjeno);

    await expect(
      obtenerIcsPropio({ turnoId: turnoAjeno.id, pacienteId: SEED.pacientes.uno.id }, deps),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });

  it('rechaza con NO_ENCONTRADO si el turno no existe', async () => {
    const deps = crearContexto();
    await expect(
      obtenerIcsPropio({ turnoId: 'inexistente', pacienteId: SEED.pacientes.uno.id }, deps),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });

  it('rechaza con NO_ENCONTRADO si falta alguna entidad asociada al turno', async () => {
    const deps = crearContexto();
    const turnoSinPrestacion = crearTurnoBase({
      id: 'turno-huerfano-prestacion',
      prestacionId: 'prestacion-inexistente',
    });
    await deps.repos.turnos.guardar(turnoSinPrestacion);

    await expect(
      obtenerIcsPropio(
        { turnoId: turnoSinPrestacion.id, pacienteId: SEED.pacientes.uno.id },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });
});

describe('autogestion paciente — cancelarTurnoPaciente (Task 3.2)', () => {
  it('cancela un turno reservado con 25 horas de anticipacion, conserva persistencia y audita con actor paciente', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-cancelar-25h',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    const resultado = await cancelarTurnoPaciente(
      { turnoId: turno.id, pacienteId: SEED.pacientes.uno.id },
      deps,
    );

    expect(resultado.estado).toBe('cancelado');
    const persistido = await deps.repos.turnos.buscarPorId(turno.id);
    expect(persistido?.estado).toBe('cancelado');

    const auditoria = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      turnoId: turno.id,
      accion: 'cancelado',
      actor: 'paciente',
      detalle: { antes: { estado: 'reservado' }, despues: { estado: 'cancelado' } },
    });
  });

  it('rechaza cancelar con 23 horas de anticipacion devolviendo PLAZO_VENCIDO sin modificar el turno', async () => {
    const deps = crearContexto('2026-11-30T11:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-cancelar-23h',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    await expect(
      cancelarTurnoPaciente({ turnoId: turno.id, pacienteId: SEED.pacientes.uno.id }, deps),
    ).rejects.toEqual(new ReglaDeNegocioError('PLAZO_VENCIDO'));

    const persistido = await deps.repos.turnos.buscarPorId(turno.id);
    expect(persistido?.estado).toBe('reservado');
    expect(await deps.repos.auditoria.listar((a) => a.turnoId === turno.id)).toHaveLength(0);
  });

  it('permite cancelar en el borde exacto de 24 horas de anticipacion', async () => {
    const deps = crearContexto('2026-11-30T10:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-cancelar-24h-exactas',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    const resultado = await cancelarTurnoPaciente(
      { turnoId: turno.id, pacienteId: SEED.pacientes.uno.id },
      deps,
    );

    expect(resultado.estado).toBe('cancelado');
  });

  it('permite cancelar un turno confirmado con al menos 24 horas de anticipacion', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-cancelar-confirmado',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'confirmado',
    });
    await deps.repos.turnos.guardar(turno);

    const resultado = await cancelarTurnoPaciente(
      { turnoId: turno.id, pacienteId: SEED.pacientes.uno.id },
      deps,
    );

    expect(resultado.estado).toBe('cancelado');
    const auditoria = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditoria[0]).toMatchObject({
      accion: 'cancelado',
      actor: 'paciente',
      detalle: { antes: { estado: 'confirmado' }, despues: { estado: 'cancelado' } },
    });
  });

  it('evalua estado final antes que el plazo de 24h y devuelve TRANSICION_INVALIDA', async () => {
    // Reloj con solo 2 horas de anticipacion: debe priorizar TRANSICION_INVALIDA sobre PLAZO_VENCIDO.
    const deps = crearContexto('2026-12-01T08:00:00-03:00');
    for (const estado of ['cancelado', 'atendido', 'ausente'] as const) {
      const turno = crearTurnoBase({
        id: `turno-final-${estado}`,
        inicio: new Date('2026-12-01T10:00:00-03:00'),
        fin: new Date('2026-12-01T10:30:00-03:00'),
        estado,
      });
      await deps.repos.turnos.guardar(turno);

      await expect(
        cancelarTurnoPaciente({ turnoId: turno.id, pacienteId: SEED.pacientes.uno.id }, deps),
      ).rejects.toEqual(new ReglaDeNegocioError('TRANSICION_INVALIDA'));
    }
  });

  it('evalua pertenencia antes que estado y plazo, devolviendo NO_ENCONTRADO para turno ajeno o inexistente', async () => {
    const deps = crearContexto('2026-12-01T08:00:00-03:00');
    const turnoAjenoCancelado = crearTurnoBase({
      id: 'turno-ajeno-cancelado',
      pacienteId: SEED.pacientes.dos.id,
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'cancelado',
    });
    await deps.repos.turnos.guardar(turnoAjenoCancelado);

    await expect(
      cancelarTurnoPaciente(
        { turnoId: turnoAjenoCancelado.id, pacienteId: SEED.pacientes.uno.id },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      cancelarTurnoPaciente({ turnoId: 'no-existe', pacienteId: SEED.pacientes.uno.id }, deps),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });
});

describe('autogestion paciente — reprogramarTurnoPaciente (Task 3.2)', () => {
  it('reprograma con 25 horas de anticipacion excluyendo el propio turno y envia un unico email con Google Calendar e .ics sin precio', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-reprog-25h',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    const actualizado = await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: { inicio: new Date('2026-12-01T10:15:00-03:00') },
      },
      deps,
    );

    expect(actualizado.inicio).toEqual(new Date('2026-12-01T10:15:00-03:00'));
    expect(actualizado.fin).toEqual(new Date('2026-12-01T10:45:00-03:00'));
    expect(actualizado.estado).toBe('reservado');

    const auditoria = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      turnoId: turno.id,
      accion: 'reprogramado',
      actor: 'paciente',
    });

    expect(deps.notificador.bandeja).toHaveLength(1);
    const email = deps.notificador.bandeja[0];
    expect(email).toBeDefined();
    expect(email?.para).toBe(SEED.pacientes.uno.email);
    expect(email?.asunto).toContain('Turno reprogramado');
    expect(email?.texto).toContain('https://calendar.google.com/calendar/render');
    expect(email?.texto).not.toContain(String(SEED.prestaciones.consulta.precio));
    expect(email?.texto).not.toMatch(/precio/i);
    expect(email?.html).not.toContain(String(SEED.prestaciones.consulta.precio));
    expect(email?.adjuntos).toHaveLength(1);
    expect(email?.adjuntos?.[0]?.nombre).toBe('turno.ics');
    expect(email?.adjuntos?.[0]?.contenido).toContain('DTSTART:20261201T131500Z');
    expect(email?.adjuntos?.[0]?.contenido).toContain('DTEND:20261201T134500Z');
    expect(email?.adjuntos?.[0]?.contenido).toContain('SEQUENCE:1');
    expect(email?.adjuntos?.[0]?.contenido).not.toContain(String(SEED.prestaciones.consulta.precio));
  });

  it('rechaza reprogramar con 23 horas de anticipacion devolviendo PLAZO_VENCIDO sin modificar ni enviar email', async () => {
    const deps = crearContexto('2026-11-30T11:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-reprog-23h',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: turno.id,
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-02T10:00:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('PLAZO_VENCIDO'));

    const persistido = await deps.repos.turnos.buscarPorId(turno.id);
    expect(persistido?.inicio).toEqual(turno.inicio);
    expect(deps.notificador.bandeja).toHaveLength(0);
  });

  it('permite reprogramar en el borde exacto de 24 horas de anticipacion', async () => {
    const deps = crearContexto('2026-11-30T10:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-reprog-24h-exactas',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    const actualizado = await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: { inicio: new Date('2026-12-01T11:00:00-03:00') },
      },
      deps,
    );

    expect(actualizado.inicio).toEqual(new Date('2026-12-01T11:00:00-03:00'));
    expect(actualizado.fin).toEqual(new Date('2026-12-01T11:30:00-03:00'));
    expect(deps.notificador.bandeja).toHaveLength(1);
  });

  it('aplica la ventana de 24 horas sobre el inicio original permitiendo adelantar a un horario futuro dentro de las proximas 24h', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-reprog-adelantar',
      inicio: new Date('2026-12-02T10:00:00-03:00'),
      fin: new Date('2026-12-02T10:30:00-03:00'),
      estado: 'reservado',
    });
    await deps.repos.turnos.guardar(turno);

    const actualizado = await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: { inicio: new Date('2026-11-30T11:00:00-03:00') },
      },
      deps,
    );

    expect(actualizado.inicio).toEqual(new Date('2026-11-30T11:00:00-03:00'));
    expect(deps.notificador.bandeja).toHaveLength(1);
  });

  it('reprograma un turno confirmado cambiando profesional y box, vuelve a reservado e incrementa SEQUENCE en reprogramaciones sucesivas', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const turno = crearTurnoBase({
      id: 'turno-reprog-multi',
      inicio: new Date('2026-12-02T10:00:00-03:00'),
      fin: new Date('2026-12-02T10:30:00-03:00'),
      estado: 'confirmado',
    });
    await deps.repos.turnos.guardar(turno);

    const primera = await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: {
          inicio: new Date('2026-12-02T11:00:00-03:00'),
          profesionalId: SEED.profesionales.brunoGomez.id,
          boxId: SEED.boxes.box2.id,
        },
      },
      deps,
    );

    expect(primera.estado).toBe('reservado');
    expect(primera.profesionalId).toBe(SEED.profesionales.brunoGomez.id);
    expect(primera.boxId).toBe(SEED.boxes.box2.id);
    expect(deps.notificador.bandeja).toHaveLength(1);
    expect(deps.notificador.bandeja[0]?.texto).toContain(SEED.profesionales.brunoGomez.nombre);
    expect(deps.notificador.bandeja[0]?.texto).toContain(SEED.boxes.box2.nombre);
    expect(deps.notificador.bandeja[0]?.adjuntos?.[0]?.contenido).toContain('SEQUENCE:1');

    await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: { inicio: new Date('2026-12-02T11:30:00-03:00') },
      },
      deps,
    );

    expect(deps.notificador.bandeja).toHaveLength(2);
    expect(deps.notificador.bandeja[1]?.adjuntos?.[0]?.contenido).toContain('SEQUENCE:2');
  });

  it('rechaza reprogramar sobre un hueco ocupado por profesional o box sin alterar el turno original ni enviar email', async () => {
    const deps = crearContexto('2026-11-30T09:00:00-03:00');
    const propio = crearTurnoBase({
      id: 'turno-reprog-choque-propio',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box1.id,
    });
    const ocupadoProf = crearTurnoBase({
      id: 'turno-ocupado-prof',
      pacienteId: SEED.pacientes.dos.id,
      profesionalId: SEED.profesionales.anaPerez.id,
      boxId: SEED.boxes.box2.id,
      inicio: new Date('2026-12-01T11:00:00-03:00'),
      fin: new Date('2026-12-01T11:30:00-03:00'),
    });
    const ocupadoBox = crearTurnoBase({
      id: 'turno-ocupado-box',
      pacienteId: SEED.pacientes.dos.id,
      profesionalId: SEED.profesionales.brunoGomez.id,
      boxId: SEED.boxes.box1.id,
      inicio: new Date('2026-12-01T11:30:00-03:00'),
      fin: new Date('2026-12-01T12:00:00-03:00'),
    });
    await deps.repos.turnos.guardar(propio);
    await deps.repos.turnos.guardar(ocupadoProf);
    await deps.repos.turnos.guardar(ocupadoBox);

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: propio.id,
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-01T11:00:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL'));

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: propio.id,
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-01T11:30:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('SOLAPAMIENTO_BOX'));

    const persistido = await deps.repos.turnos.buscarPorId(propio.id);
    expect(persistido?.inicio).toEqual(propio.inicio);
    expect(deps.notificador.bandeja).toHaveLength(0);
  });

  it('evalua pertenencia y estado antes que el plazo de 24h en reprogramacion', async () => {
    const deps = crearContexto('2026-12-01T08:00:00-03:00');
    const propioCancelado = crearTurnoBase({
      id: 'turno-reprog-cancelado',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'cancelado',
    });
    const ajenoCancelado = crearTurnoBase({
      id: 'turno-reprog-ajeno',
      pacienteId: SEED.pacientes.dos.id,
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
      estado: 'cancelado',
    });
    await deps.repos.turnos.guardar(propioCancelado);
    await deps.repos.turnos.guardar(ajenoCancelado);

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: propioCancelado.id,
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-02T10:00:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('TRANSICION_INVALIDA'));

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: ajenoCancelado.id,
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-02T10:00:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      reprogramarTurnoPaciente(
        {
          turnoId: 'turno-inexistente',
          pacienteId: SEED.pacientes.uno.id,
          cambios: { inicio: new Date('2026-12-02T10:00:00-03:00') },
        },
        deps,
      ),
    ).rejects.toEqual(new ReglaDeNegocioError('NO_ENCONTRADO'));
  });

  it('no revierte la reprogramacion si falla el envio del notificador SMTP (RN-NO-02)', async () => {
    const base = crearContexto('2026-11-30T09:00:00-03:00');
    const depsConFalloSmtp = {
      ...base,
      notificador: {
        async enviar(): Promise<void> {
          throw new Error('SMTP temporalmente no disponible');
        },
      },
    };
    const turno = crearTurnoBase({
      id: 'turno-reprog-fallo-smtp',
      inicio: new Date('2026-12-01T10:00:00-03:00'),
      fin: new Date('2026-12-01T10:30:00-03:00'),
    });
    await depsConFalloSmtp.repos.turnos.guardar(turno);

    const actualizado = await reprogramarTurnoPaciente(
      {
        turnoId: turno.id,
        pacienteId: SEED.pacientes.uno.id,
        cambios: { inicio: new Date('2026-12-01T11:00:00-03:00') },
      },
      depsConFalloSmtp,
    );

    expect(actualizado.inicio).toEqual(new Date('2026-12-01T11:00:00-03:00'));
    const persistido = await depsConFalloSmtp.repos.turnos.buscarPorId(turno.id);
    expect(persistido?.inicio).toEqual(new Date('2026-12-01T11:00:00-03:00'));
  });
});
