import { randomUUID } from 'node:crypto';
import { APP_TZ } from '../../../shared/config';
import type { Box, Paciente, Prestacion, Profesional, Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import type { UsuarioSesion } from '../../../shared/sesion';
import { enZonaConsultorio } from '../../../shared/zona';
import { estaDentroDeHorario, haySolapamientoIntervalos } from '../../configuracion/dominio/reglas';
import {
  normalizarDocumento,
  normalizarEmail,
  validarUnicidadPaciente,
} from '../../cuentas/dominio/reglas';
import { enviarConfirmacionTurno } from '../../notificaciones';
import { conflictos, enGrilla, seSuperponen } from '../../turnos-alta/dominio/agenda';
import { seleccionarBoxLibre } from '../dominio/disponibilidad';

const MINUTO_MS = 60_000;

export type DepsReserva = Pick<
  Deps,
  'repos' | 'clock' | 'conLockDeAgenda' | 'disponibilidad' | 'notificador'
> & {
  tz?: string;
};

export interface SolicitudReservaOnline {
  pacienteId: string;
  profesionalId: string;
  prestacionId: string;
  inicio: Date;
  boxId?: string;
}

export interface DatosPacienteInline {
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export type SolicitudReservaRecepcion = {
  sesion: UsuarioSesion;
  profesionalId: string;
  prestacionId: string;
  inicio: Date;
  boxId?: string;
} & (
  | { pacienteId: string; paciente?: undefined }
  | { paciente: DatosPacienteInline; pacienteId?: undefined }
);

interface RecursosBase {
  profesional: Profesional;
  prestacion: Prestacion;
  boxExplicito: Box | undefined;
  fin: Date;
}

interface ResultadoValidacionAgenda {
  box: Box;
  turno: Turno;
}

function construirTurno(params: {
  profesional: Profesional;
  box: Box;
  prestacion: Prestacion;
  paciente: Paciente;
  inicio: Date;
  fin: Date;
  ahora: Date;
  origen: Turno['origen'];
  creadoPor: string;
}): Turno {
  return {
    id: randomUUID(),
    profesionalId: params.profesional.id,
    boxId: params.box.id,
    prestacionId: params.prestacion.id,
    pacienteId: params.paciente.id,
    inicio: params.inicio,
    fin: params.fin,
    estado: 'reservado',
    origen: params.origen,
    precioAlReservar: params.prestacion.precio,
    creadoPor: params.creadoPor,
    creadoEn: params.ahora,
  };
}

async function cargarYValidarRecursosBase(params: {
  profesionalId: string;
  prestacionId: string;
  boxId: string | undefined;
  inicio: Date;
  ahora: Date;
  tz: string;
  exigirReservableOnline: boolean;
  deps: DepsReserva;
}): Promise<RecursosBase> {
  const { profesionalId, prestacionId, boxId, inicio, ahora, tz, exigirReservableOnline, deps } = params;

  if (!enGrilla(inicio, tz)) {
    throw new ReglaDeNegocioError('FUERA_DE_GRILLA');
  }
  if (inicio.getTime() < ahora.getTime()) {
    throw new ReglaDeNegocioError('EN_EL_PASADO');
  }

  const [profesional, prestacion, boxExplicito] = await Promise.all([
    deps.repos.profesionales.buscarPorId(profesionalId),
    deps.repos.prestaciones.buscarPorId(prestacionId),
    boxId !== undefined ? deps.repos.boxes.buscarPorId(boxId) : Promise.resolve(undefined),
  ]);

  if (!profesional || !prestacion || (boxId !== undefined && !boxExplicito)) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  if (
    !profesional.activo ||
    !prestacion.activa ||
    (exigirReservableOnline && !prestacion.reservableOnline) ||
    (boxExplicito !== undefined && !boxExplicito.activo)
  ) {
    throw new ReglaDeNegocioError('RECURSO_INACTIVO');
  }

  return {
    profesional,
    prestacion,
    boxExplicito,
    fin: new Date(inicio.getTime() + prestacion.duracionMin * MINUTO_MS),
  };
}

async function validarAgendaYSeleccionarBox(params: {
  profesional: Profesional;
  prestacion: Prestacion;
  paciente: Paciente;
  boxExplicito: Box | undefined;
  inicio: Date;
  fin: Date;
  ahora: Date;
  tz: string;
  origen: Turno['origen'];
  creadoPor: string;
  deps: DepsReserva;
}): Promise<ResultadoValidacionAgenda> {
  const { profesional, prestacion, paciente, boxExplicito, inicio, fin, ahora, tz, origen, creadoPor, deps } = params;

  if (boxExplicito !== undefined) {
    const codigo = await deps.disponibilidad.verificar({
      profesionalId: profesional.id,
      boxId: boxExplicito.id,
      inicio,
      fin,
    });
    if (codigo !== null) {
      throw new ReglaDeNegocioError(codigo);
    }

    const turnosExistentes = await deps.repos.turnos.listar(
      (t) => t.profesionalId === profesional.id || t.boxId === boxExplicito.id,
    );
    const candidato = construirTurno({
      profesional,
      box: boxExplicito,
      prestacion,
      paciente,
      inicio,
      fin,
      ahora,
      origen,
      creadoPor,
    });
    const choque = conflictos(turnosExistentes, candidato);
    if (choque.profesional) throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');
    if (choque.box) throw new ReglaDeNegocioError('SOLAPAMIENTO_BOX');

    return { box: boxExplicito, turno: candidato };
  }

  const [horarios, bloqueos, turnos, boxes] = await Promise.all([
    deps.repos.horarios.listar((h) => h.profesionalId === profesional.id),
    deps.repos.bloqueos.listar(),
    deps.repos.turnos.listar((t) => t.estado !== 'cancelado'),
    deps.repos.boxes.listar(),
  ]);

  const inicioZona = enZonaConsultorio(inicio, tz);
  const finZona = enZonaConsultorio(fin, tz);
  const horariosDelDia = horarios.filter((h) => h.diaSemana === inicioZona.diaSemana);
  if (!estaDentroDeHorario(inicio, fin, inicioZona, finZona, horariosDelDia)) {
    throw new ReglaDeNegocioError('FUERA_DE_HORARIO');
  }

  const profesionalBloqueado = bloqueos.some(
    (b) => b.profesionalId === profesional.id && haySolapamientoIntervalos(inicio, fin, b.inicio, b.fin),
  );
  if (profesionalBloqueado) {
    throw new ReglaDeNegocioError('EN_BLOQUEO');
  }

  const intervalo = { inicio, fin };
  const profesionalOcupado = turnos.some(
    (t) => t.profesionalId === profesional.id && seSuperponen(t, intervalo),
  );
  if (profesionalOcupado) {
    throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');
  }

  const boxElegido = seleccionarBoxLibre({
    inicio,
    fin,
    boxes,
    bloqueos,
    turnos,
  });

  const codigo = await deps.disponibilidad.verificar({
    profesionalId: profesional.id,
    boxId: boxElegido.id,
    inicio,
    fin,
  });
  if (codigo !== null) {
    throw new ReglaDeNegocioError(codigo);
  }

  const turno = construirTurno({
    profesional,
    box: boxElegido,
    prestacion,
    paciente,
    inicio,
    fin,
    ahora,
    origen,
    creadoPor,
  });

  return { box: boxElegido, turno };
}

async function persistirTurnoConAuditoria(
  turno: Turno,
  actor: string,
  fecha: Date,
  deps: DepsReserva,
): Promise<void> {
  await deps.repos.auditoria.agregar({
    id: randomUUID(),
    turnoId: turno.id,
    accion: 'creado',
    actor,
    fecha,
    detalle: { despues: turno },
  });

  try {
    await deps.repos.turnos.guardar(turno);
  } catch (error) {
    try {
      await deps.repos.auditoria.agregar({
        id: randomUUID(),
        turnoId: turno.id,
        accion: 'creado',
        actor,
        fecha,
        detalle: { antes: turno, revertido: true },
      });
    } catch {
      // Se ignora: el error prioritario es el fallo de persistencia del turno.
    }
    throw error;
  }
}

async function notificarConfirmacionSinRevertir(
  deps: DepsReserva,
  tz: string,
  datos: {
    turno: Turno;
    paciente: Paciente;
    profesional: Profesional;
    box: Box;
    prestacion: Prestacion;
  },
): Promise<void> {
  try {
    await enviarConfirmacionTurno(
      { notificador: deps.notificador, clock: deps.clock, zonaHoraria: tz },
      { ...datos, tipo: 'creado' },
    );
  } catch {
    // La falla de notificación no revierte la reserva (RN-NO-02).
  }
}

function construirPacienteInline(datos: DatosPacienteInline): Paciente {
  const paciente: Paciente = {
    id: randomUUID(),
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    documento: normalizarDocumento(datos.documento),
    email: normalizarEmail(datos.email),
  };
  if (datos.telefono !== undefined) paciente.telefono = datos.telefono;
  if (datos.obraSocial !== undefined) paciente.obraSocial = datos.obraSocial;
  if (datos.plan !== undefined) paciente.plan = datos.plan;
  if (datos.nroAfiliado !== undefined) paciente.nroAfiliado = datos.nroAfiliado;
  return paciente;
}

/**
 * Reserva un turno online para un paciente autenticado (US-060).
 * Exige prestación activa con `reservableOnline: true`, autoasigna box libre si se omite `boxId`
 * dentro de `conLockDeAgenda`, registra auditoría con `actor: 'paciente'` y envía confirmación C-06.
 */
export async function reservarTurnoOnline(
  solicitud: SolicitudReservaOnline,
  deps: DepsReserva,
): Promise<Turno> {
  const tz = deps.tz ?? APP_TZ;
  const ahora = deps.clock.ahora();

  const { profesional, prestacion, boxExplicito, fin } = await cargarYValidarRecursosBase({
    profesionalId: solicitud.profesionalId,
    prestacionId: solicitud.prestacionId,
    boxId: solicitud.boxId,
    inicio: solicitud.inicio,
    ahora,
    tz,
    exigirReservableOnline: true,
    deps,
  });

  const paciente = await deps.repos.pacientes.buscarPorId(solicitud.pacienteId);
  if (!paciente) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }

  const creadoPor = paciente.usuarioId ?? 'paciente';

  const { box, turno } = await deps.conLockDeAgenda(async () => {
    const resultado = await validarAgendaYSeleccionarBox({
      profesional,
      prestacion,
      paciente,
      boxExplicito,
      inicio: solicitud.inicio,
      fin,
      ahora,
      tz,
      origen: 'online',
      creadoPor,
      deps,
    });
    await persistirTurnoConAuditoria(resultado.turno, 'paciente', ahora, deps);
    return resultado;
  });

  await notificarConfirmacionSinRevertir(deps, tz, {
    turno,
    paciente,
    profesional,
    box,
    prestacion,
  });

  return turno;
}

/**
 * Registra un turno asistido desde recepción o profesional (US-061).
 * Habilita cualquier prestación activa (incluyendo `reservableOnline: false`),
 * acepta paciente existente (`pacienteId`) o nuevo inline (`paciente`) de forma atómica
 * dentro de un único `conLockDeAgenda` (sin pacientes huérfanos ante fallo de agenda),
 * registra auditoría con `actor: sesion.usuarioId` y envía confirmación C-06.
 */
export async function reservarTurnoRecepcion(
  solicitud: SolicitudReservaRecepcion,
  deps: DepsReserva,
): Promise<Turno> {
  const tz = deps.tz ?? APP_TZ;
  const ahora = deps.clock.ahora();

  const { profesional, prestacion, boxExplicito, fin } = await cargarYValidarRecursosBase({
    profesionalId: solicitud.profesionalId,
    prestacionId: solicitud.prestacionId,
    boxId: solicitud.boxId,
    inicio: solicitud.inicio,
    ahora,
    tz,
    exigirReservableOnline: false,
    deps,
  });

  const origen: Turno['origen'] = solicitud.sesion.rol === 'profesional' ? 'profesional' : 'recepcion';
  const actor = solicitud.sesion.usuarioId;

  const { paciente, box, turno } = await deps.conLockDeAgenda(async () => {
    let pacienteResuelto: Paciente;
    let esNuevoInline = false;

    if (solicitud.pacienteId !== undefined) {
      const existente = await deps.repos.pacientes.buscarPorId(solicitud.pacienteId);
      if (!existente) {
        throw new ReglaDeNegocioError('NO_ENCONTRADO');
      }
      pacienteResuelto = existente;
    } else {
      const [usuarios, pacientes] = await Promise.all([
        deps.repos.usuarios.listar(),
        deps.repos.pacientes.listar(),
      ]);
      validarUnicidadPaciente({
        email: solicitud.paciente.email,
        documento: solicitud.paciente.documento,
        usuarios,
        pacientes,
      });
      pacienteResuelto = construirPacienteInline(solicitud.paciente);
      esNuevoInline = true;
    }

    const resultado = await validarAgendaYSeleccionarBox({
      profesional,
      prestacion,
      paciente: pacienteResuelto,
      boxExplicito,
      inicio: solicitud.inicio,
      fin,
      ahora,
      tz,
      origen,
      creadoPor: actor,
      deps,
    });

    if (esNuevoInline) {
      await deps.repos.pacientes.guardar(pacienteResuelto);
    }
    await persistirTurnoConAuditoria(resultado.turno, actor, ahora, deps);

    return { paciente: pacienteResuelto, box: resultado.box, turno: resultado.turno };
  });

  await notificarConfirmacionSinRevertir(deps, tz, {
    turno,
    paciente,
    profesional,
    box,
    prestacion,
  });

  return turno;
}
