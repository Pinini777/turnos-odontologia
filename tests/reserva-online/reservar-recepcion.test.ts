import { describe, expect, it } from 'vitest';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';
import { crearNotificadorEnMemoria } from '../../src/modules/notificaciones';
import {
  reservarTurnoRecepcion,
  type DepsReserva,
} from '../../src/modules/reserva-online/aplicacion/reservar-turno';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import type { Notificador } from '../../src/shared/puertos';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { UsuarioSesion } from '../../src/shared/sesion';

const LUNES_08_00 = '2026-11-30T08:00:00-03:00';
const LUNES_09_00 = '2026-11-30T09:00:00-03:00';
const LUNES_10_00 = '2026-11-30T10:00:00-03:00';
const LUNES_10_30 = '2026-11-30T10:30:00-03:00';

const SESION_RECEPCION: UsuarioSesion = {
  usuarioId: SEED.usuarios.recepcion.id,
  rol: 'recepcionista',
};

const SESION_PROFESIONAL: UsuarioSesion = {
  usuarioId: SEED.usuarios.anaPerez.id,
  rol: 'profesional',
  profesionalId: SEED.profesionales.anaPerez.id,
};

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
    id: 'turno-existente-rec-1',
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

describe('reservarTurnoRecepcion (C-11)', () => {
  it('agenda turno para paciente existente con prestación no reservable online y box automático', async () => {
    const deps = crearContexto();

    const turno = await reservarTurnoRecepcion(
      {
        sesion: SESION_RECEPCION,
        pacienteId: SEED.pacientes.dos.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.extraccion.id,
        inicio: new Date(LUNES_09_00),
      },
      deps,
    );

    expect(turno.origen).toBe('recepcion');
    expect(turno.estado).toBe('reservado');
    expect(turno.pacienteId).toBe(SEED.pacientes.dos.id);
    expect(turno.boxId).toBe(SEED.boxes.box1.id);
    expect(turno.precioAlReservar).toBe(SEED.prestaciones.extraccion.precio);
    expect(turno.creadoPor).toBe(SESION_RECEPCION.usuarioId);
    expect(turno.fin).toEqual(new Date('2026-11-30T10:00:00-03:00'));

    const auditorias = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]?.accion).toBe('creado');
    expect(auditorias[0]?.actor).toBe(SESION_RECEPCION.usuarioId);

    expect(deps.notificador.bandeja).toHaveLength(1);
    const correo = deps.notificador.bandeja[0];
    expect(correo?.para).toBe(SEED.pacientes.dos.email);
    expect(correo?.texto).toContain('calendar.google.com');
    expect(correo?.texto).not.toContain('40000');
    expect(correo?.adjuntos?.some((a) => a.nombre === 'turno.ics')).toBe(true);
  });

  it('asigna origen profesional cuando quien registra tiene rol profesional', async () => {
    const deps = crearContexto();

    const turno = await reservarTurnoRecepcion(
      {
        sesion: SESION_PROFESIONAL,
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        boxId: SEED.boxes.box2.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.origen).toBe('profesional');
    expect(turno.boxId).toBe(SEED.boxes.box2.id);
    const auditorias = await deps.repos.auditoria.listar((a) => a.turnoId === turno.id);
    expect(auditorias[0]?.actor).toBe(SESION_PROFESIONAL.usuarioId);
  });

  it('crea paciente nuevo inline normalizado sin usuarioId y turno atómicamente, enviando confirmación al nuevo email', async () => {
    const deps = crearContexto();

    const turno = await reservarTurnoRecepcion(
      {
        sesion: SESION_RECEPCION,
        paciente: {
          nombre: '  Paciente  ',
          apellido: '  Ficticio Tres ',
          documento: ' 00000003 ',
          email: '  Paciente3@Example.COM  ',
          telefono: '0000-000003',
          obraSocial: 'Obra Social Ficticia',
        },
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.origen).toBe('recepcion');
    expect(turno.estado).toBe('reservado');

    const pacienteGuardado = await deps.repos.pacientes.buscarPorId(turno.pacienteId);
    expect(pacienteGuardado).toBeDefined();
    expect(pacienteGuardado?.usuarioId).toBeUndefined();
    expect(pacienteGuardado?.nombre).toBe('Paciente');
    expect(pacienteGuardado?.apellido).toBe('Ficticio Tres');
    expect(pacienteGuardado?.documento).toBe('00000003');
    expect(pacienteGuardado?.email).toBe('paciente3@example.com');
    expect(pacienteGuardado?.telefono).toBe('0000-000003');

    expect(deps.notificador.bandeja).toHaveLength(1);
    expect(deps.notificador.bandeja[0]?.para).toBe('paciente3@example.com');
    expect(deps.notificador.bandeja[0]?.texto).toContain('calendar.google.com');
    expect(deps.notificador.bandeja[0]?.adjuntos?.some((a) => a.nombre === 'turno.ics')).toBe(true);
  });

  it('no persiste un paciente huérfano si falla la agenda (SOLAPAMIENTO_PROFESIONAL o FUERA_DE_HORARIO)', async () => {
    const deps = crearContexto();
    await deps.repos.turnos.guardar(crearTurnoSemilla());

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Ficticio Cuatro',
            documento: '00000004',
            email: 'paciente4@example.com',
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'SOLAPAMIENTO_PROFESIONAL' });

    const pacientesConDni4 = await deps.repos.pacientes.listar((p) => p.documento === '00000004');
    expect(pacientesConDni4).toHaveLength(0);

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Ficticio Cinco',
            documento: '00000005',
            email: 'paciente5@example.com',
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date('2026-11-30T14:00:00-03:00'),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'FUERA_DE_HORARIO' });

    const pacientesConDni5 = await deps.repos.pacientes.listar((p) => p.documento === '00000005');
    expect(pacientesConDni5).toHaveLength(0);
  });

  it('rechaza alta inline con documento o email duplicado con DUPLICADO sin crear turno', async () => {
    const deps = crearContexto();

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Duplicado Doc',
            documento: SEED.pacientes.uno.documento,
            email: 'nuevo-unico@example.com',
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Duplicado Email',
            documento: '00000099',
            email: 'PACIENTE1@example.com',
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Duplicado Usuario',
            documento: '00000098',
            email: SEED.usuarios.recepcion.email,
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    expect(await deps.repos.turnos.listar()).toHaveLength(0);
  });

  it('rechaza pacienteId inexistente con NO_ENCONTRADO y prestación inactiva con RECURSO_INACTIVO', async () => {
    const deps = crearContexto();

    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          pacienteId: 'paciente-no-existe',
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });

    await deps.repos.prestaciones.guardar({ ...SEED.prestaciones.extraccion, activa: false });
    await expect(
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.extraccion.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'RECURSO_INACTIVO' });
  });

  it('serializa reservas concurrentes con paciente inline sin dejar paciente huérfano', async () => {
    const deps = crearContexto();

    const resultados = await Promise.allSettled([
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Concurrente A',
            documento: '00000010',
            email: 'conc-a@example.com',
          },
          profesionalId: SEED.profesionales.anaPerez.id,
          prestacionId: SEED.prestaciones.consulta.id,
          inicio: new Date(LUNES_10_00),
        },
        deps,
      ),
      reservarTurnoRecepcion(
        {
          sesion: SESION_RECEPCION,
          paciente: {
            nombre: 'Paciente',
            apellido: 'Concurrente B',
            documento: '00000011',
            email: 'conc-b@example.com',
          },
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

    expect(await deps.repos.turnos.listar()).toHaveLength(1);
    const pacientesNuevos = await deps.repos.pacientes.listar(
      (p) => p.documento === '00000010' || p.documento === '00000011',
    );
    expect(pacientesNuevos).toHaveLength(1);
  });

  it('no revierte la reserva ni el alta del paciente si falla el envío SMTP (RN-NO-02)', async () => {
    const base = crearContexto();
    const notificadorFallido: Notificador = {
      async enviar() {
        throw new Error('SMTP timeout');
      },
    };
    const deps: DepsReserva = { ...base, notificador: notificadorFallido };

    const turno = await reservarTurnoRecepcion(
      {
        sesion: SESION_RECEPCION,
        paciente: {
          nombre: 'Paciente',
          apellido: 'Ficticio Seis',
          documento: '00000006',
          email: 'paciente6@example.com',
        },
        profesionalId: SEED.profesionales.anaPerez.id,
        prestacionId: SEED.prestaciones.consulta.id,
        inicio: new Date(LUNES_10_00),
      },
      deps,
    );

    expect(turno.estado).toBe('reservado');
    expect(await deps.repos.turnos.buscarPorId(turno.id)).toEqual(turno);
    expect(await deps.repos.pacientes.buscarPorId(turno.pacienteId)).toBeDefined();
  });
});
