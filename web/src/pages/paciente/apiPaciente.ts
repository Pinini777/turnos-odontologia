import { ErrorApi, type PacienteApi } from '../../base/api';
import type { EstadoTurnoUi } from '../../base/components';
import { apiConsultorio, limpiarSesion, obtenerSesionActual } from '../../base/sesion';

export interface PrestacionPublicaApi {
  readonly id: string;
  readonly nombre: string;
  readonly duracionMin: number;
  readonly reservableOnline: boolean;
  readonly activa: boolean;
}

export interface HuecoDisponibleApi {
  readonly inicio: string;
  readonly fin: string;
  readonly profesionalId: string;
  readonly boxIds: readonly string[];
}

export interface TurnoPacienteApi {
  readonly id: string;
  readonly profesionalId: string;
  readonly boxId: string;
  readonly pacienteId: string;
  readonly prestacionId: string;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoTurnoUi;
  readonly origen: string;
}

export interface EntradaReservarTurno {
  readonly profesionalId: string;
  readonly prestacionId: string;
  readonly inicio: string;
  readonly boxId?: string;
}

export interface EntradaReprogramarTurno {
  readonly inicio: string;
  readonly profesionalId?: string;
  readonly boxId?: string;
}

export interface EntradaActualizarDatosPaciente {
  readonly nombre?: string;
  readonly apellido?: string;
  readonly telefono?: string;
  readonly obraSocial?: string;
  readonly plan?: string;
  readonly nroAfiliado?: string;
}

export function aErrorApi(err: unknown): ErrorApi {
  if (err instanceof ErrorApi) return err;
  return new ErrorApi(500, 'ERROR_INTERNO');
}

export function listarPrestacionesPublicas(): Promise<PrestacionPublicaApi[]> {
  return apiConsultorio.get<PrestacionPublicaApi[]>('/api/public/prestaciones');
}

export function consultarDisponibilidadPublica(params: {
  readonly prestacionId: string;
  readonly desde: string;
  readonly hasta: string;
  readonly profesionalId?: string;
}): Promise<HuecoDisponibleApi[]> {
  const qs = new URLSearchParams({
    prestacionId: params.prestacionId,
    desde: params.desde,
    hasta: params.hasta,
  });
  if (params.profesionalId) {
    qs.set('profesionalId', params.profesionalId);
  }
  return apiConsultorio.get<HuecoDisponibleApi[]>(`/api/public/disponibilidad?${qs.toString()}`);
}

export function reservarTurnoPaciente(entrada: EntradaReservarTurno): Promise<TurnoPacienteApi> {
  return apiConsultorio.post<TurnoPacienteApi>('/api/paciente/turnos', entrada);
}

export function listarMisTurnos(): Promise<TurnoPacienteApi[]> {
  return apiConsultorio.get<TurnoPacienteApi[]>('/api/paciente/turnos');
}

export function cancelarMiTurno(turnoId: string): Promise<TurnoPacienteApi> {
  return apiConsultorio.post<TurnoPacienteApi>(`/api/paciente/turnos/${encodeURIComponent(turnoId)}/cancelar`);
}

export function reprogramarMiTurno(
  turnoId: string,
  entrada: EntradaReprogramarTurno,
): Promise<TurnoPacienteApi> {
  return apiConsultorio.patch<TurnoPacienteApi>(
    `/api/paciente/turnos/${encodeURIComponent(turnoId)}/reprogramar`,
    entrada,
  );
}

export function obtenerMisDatos(): Promise<PacienteApi> {
  return apiConsultorio.get<PacienteApi>('/api/paciente/datos');
}

export function actualizarMisDatos(entrada: EntradaActualizarDatosPaciente): Promise<PacienteApi> {
  return apiConsultorio.patch<PacienteApi>('/api/paciente/datos', entrada);
}

/**
 * Descarga el archivo `.ics` (RFC 5545) del turno autenticado con token Bearer.
 * Usa `fetch` directo porque el endpoint devuelve `text/calendar` y no JSON.
 */
export async function descargarCalendarioIcs(turnoId: string): Promise<string> {
  const headers = new Headers();
  const token = obtenerSesionActual()?.token ?? null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/paciente/turnos/${encodeURIComponent(turnoId)}/calendario.ics`, {
      method: 'GET',
      headers,
    });
  } catch {
    throw new ErrorApi(0, 'RED_NO_DISPONIBLE');
  }

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    let code =
      respuesta.status === 401
        ? 'NO_AUTENTICADO'
        : respuesta.status === 403
          ? 'SIN_PERMISO'
          : respuesta.status === 404
            ? 'NO_ENCONTRADO'
            : 'ERROR_INTERNO';
    try {
      const parsed: unknown = JSON.parse(texto);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'code' in parsed &&
        typeof parsed.code === 'string'
      ) {
        code = parsed.code;
      }
    } catch {
      // Cuerpo no JSON: usar código derivado del status.
    }
    if (respuesta.status === 401 && obtenerSesionActual() !== null) {
      limpiarSesion();
    }
    throw new ErrorApi(respuesta.status, code);
  }

  if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([texto], { type: 'text/calendar;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = objectUrl;
    enlace.download = `turno-${turnoId}.ics`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return texto;
}
