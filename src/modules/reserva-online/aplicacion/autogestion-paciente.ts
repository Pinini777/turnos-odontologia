import type { Box, Paciente, Prestacion, Profesional, Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { Deps, Notificador } from '../../../shared/puertos';
import { enviarConfirmacionTurno, generarIcs, type DatosCalendario } from '../../notificaciones';
import { cancelarTurno, type DepsEstados } from '../../turnos-estados/aplicacion/cambiar-estado';
import {
  reprogramarTurno,
  type CambiosReprogramacion,
  type DepsReprogramacion,
} from '../../turnos-reprogramacion/aplicacion/reprogramar-turno';
import { esReprogramable } from '../../turnos-reprogramacion/dominio/reprogramacion';
import { verificarPlazo24h, verificarPropiedadTurno } from '../dominio/autogestion';

export type { CambiosReprogramacion };

export type DepsListarTurnosPropios = Pick<Deps, 'repos'>;
export type DepsObtenerIcsPropio = Pick<Deps, 'repos' | 'clock'>;
export type DepsCancelarTurnoPaciente = DepsEstados;
export type DepsReprogramarTurnoPaciente = DepsReprogramacion;

export interface SolicitudTurnoPaciente {
  turnoId: string;
  pacienteId: string;
}

export interface ReprogramarTurnoPaciente extends SolicitudTurnoPaciente {
  cambios: CambiosReprogramacion;
}

interface DatosRelacionadosTurno {
  paciente: Paciente;
  profesional: Profesional;
  box: Box;
  prestacion: Prestacion;
}

/**
 * Suprime el correo plano interno de C-10 al delegar `reprogramarTurno`;
 * C-11 despacha luego el correo único con Google Calendar y adjunto `.ics` vía C-06 (design D7).
 */
const notificadorNoop: Notificador = {
  async enviar(): Promise<void> {
    // Intencionalmente vacío.
  },
};

async function cargarDatosRelacionados(
  turno: Turno,
  repos: Deps['repos'],
): Promise<DatosRelacionadosTurno | null> {
  const [paciente, profesional, box, prestacion] = await Promise.all([
    repos.pacientes.buscarPorId(turno.pacienteId),
    repos.profesionales.buscarPorId(turno.profesionalId),
    repos.boxes.buscarPorId(turno.boxId),
    repos.prestaciones.buscarPorId(turno.prestacionId),
  ]);
  if (!paciente || !profesional || !box || !prestacion) {
    return null;
  }
  return { paciente, profesional, box, prestacion };
}

/**
 * Valida en orden estricto:
 * 1) pertenencia (`404 NO_ENCONTRADO`),
 * 2) estado operable `'reservado' | 'confirmado'` (`409 TRANSICION_INVALIDA`),
 * 3) ventana de 24 horas sobre el `inicio` original del turno (`409 PLAZO_VENCIDO`).
 */
async function verificarTurnoOperableEnPlazo(
  turnoId: string,
  pacienteId: string,
  deps: Pick<Deps, 'repos' | 'clock'>,
): Promise<Turno> {
  const turno = verificarPropiedadTurno(await deps.repos.turnos.buscarPorId(turnoId), pacienteId);
  if (!esReprogramable(turno.estado)) {
    throw new ReglaDeNegocioError('TRANSICION_INVALIDA');
  }
  verificarPlazo24h(turno.inicio, deps.clock.ahora());
  return turno;
}

function armarDatosCalendario(turno: Turno, datos: DatosRelacionadosTurno): DatosCalendario {
  return {
    turno: {
      id: turno.id,
      inicio: turno.inicio,
      fin: turno.fin,
      creadoEn: turno.creadoEn,
    },
    paciente: {
      nombre: datos.paciente.nombre,
      apellido: datos.paciente.apellido,
    },
    profesional: { nombre: datos.profesional.nombre },
    box: { nombre: datos.box.nombre },
    prestacion: {
      nombre: datos.prestacion.nombre,
      duracionMin: datos.prestacion.duracionMin,
    },
  };
}

async function notificarReprogramacion(
  turno: Turno,
  deps: Pick<Deps, 'repos' | 'clock' | 'notificador'>,
): Promise<void> {
  try {
    const [datos, historialReprogramaciones] = await Promise.all([
      cargarDatosRelacionados(turno, deps.repos),
      deps.repos.auditoria.listar(
        (entrada) =>
          entrada.turnoId === turno.id &&
          entrada.accion === 'reprogramado' &&
          entrada.detalle.revertido !== true,
      ),
    ]);
    if (!datos) return;

    const sequence = Math.max(1, historialReprogramaciones.length);
    await enviarConfirmacionTurno(
      { notificador: deps.notificador, clock: deps.clock },
      {
        ...armarDatosCalendario(turno, datos),
        paciente: {
          nombre: datos.paciente.nombre,
          apellido: datos.paciente.apellido,
          email: datos.paciente.email,
        },
        tipo: 'reprogramado',
        sequence,
      },
    );
  } catch {
    // RN-NO-02: un fallo de notificación nunca revierte la reprogramación del turno.
  }
}

/**
 * Lista los turnos pertenecientes al paciente ordenados por `inicio` ascendente (incluye cancelados).
 */
export async function listarTurnosPropios(
  pacienteId: string,
  deps: DepsListarTurnosPropios,
): Promise<Turno[]> {
  const turnos = await deps.repos.turnos.listar((turno) => turno.pacienteId === pacienteId);
  return turnos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.id.localeCompare(b.id));
}

/**
 * Genera el contenido `.ics` (RFC 5545) de un turno propio del paciente, sin incluir precios.
 */
export async function obtenerIcsPropio(
  { turnoId, pacienteId }: SolicitudTurnoPaciente,
  deps: DepsObtenerIcsPropio,
): Promise<string> {
  const turno = verificarPropiedadTurno(await deps.repos.turnos.buscarPorId(turnoId), pacienteId);
  const datos = await cargarDatosRelacionados(turno, deps.repos);
  if (!datos) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  return generarIcs(armarDatosCalendario(turno, datos), deps.clock.ahora());
}

/**
 * Cancela un turno propio del paciente respetando propiedad, estado operable y ventana de 24 h (RN-RE-02, RN-RE-03).
 */
export async function cancelarTurnoPaciente(
  { turnoId, pacienteId }: SolicitudTurnoPaciente,
  deps: DepsCancelarTurnoPaciente,
): Promise<Turno> {
  const turno = await verificarTurnoOperableEnPlazo(turnoId, pacienteId, deps);
  return cancelarTurno({ turnoId: turno.id, actor: 'paciente' }, deps);
}

/**
 * Reprograma un turno propio del paciente respetando propiedad, estado operable y ventana de 24 h sobre el inicio original.
 * Delega validaciones de agenda en C-10 (sin correo plano) y envía un único correo completo con Google Calendar e `.ics` (C-06).
 */
export async function reprogramarTurnoPaciente(
  { turnoId, pacienteId, cambios }: ReprogramarTurnoPaciente,
  deps: DepsReprogramarTurnoPaciente,
): Promise<Turno> {
  const turno = await verificarTurnoOperableEnPlazo(turnoId, pacienteId, deps);
  const actualizado = await reprogramarTurno(
    { turnoId: turno.id, cambios, actor: 'paciente' },
    { ...deps, notificador: notificadorNoop },
  );
  await notificarReprogramacion(actualizado, deps);
  return actualizado;
}
