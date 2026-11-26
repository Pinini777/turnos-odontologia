import type { ClienteHttp, PacienteApi } from '../../base/api';
import type { EstadoTurnoUi } from '../../base/components';
import { apiConsultorio } from '../../base/sesion';
import type { DiaSemana } from './formatos';

export interface ProfesionalApi {
  readonly id: string;
  readonly nombre: string;
  readonly matricula: string;
  readonly activo: boolean;
  readonly usuarioId: string;
}

export interface BoxApi {
  readonly id: string;
  readonly nombre: string;
  readonly activo: boolean;
}

export interface PrestacionApi {
  readonly id: string;
  readonly nombre: string;
  readonly duracionMin: number;
  readonly precio: number;
  readonly reservableOnline: boolean;
  readonly activa: boolean;
}

export interface HorarioAtencionApi {
  readonly id: string;
  readonly profesionalId: string;
  readonly diaSemana: DiaSemana;
  readonly desde: string;
  readonly hasta: string;
}

export interface FranjaHorarioInput {
  readonly diaSemana: DiaSemana;
  readonly desde: string;
  readonly hasta: string;
}

export interface BloqueoAgendaApi {
  readonly id: string;
  readonly profesionalId?: string;
  readonly boxId?: string;
  readonly inicio: string;
  readonly fin: string;
  readonly motivo: string;
}

export type CrearBloqueoPayload =
  | {
      readonly profesionalId: string;
      readonly inicio: string;
      readonly fin: string;
      readonly motivo: string;
    }
  | {
      readonly boxId: string;
      readonly inicio: string;
      readonly fin: string;
      readonly motivo: string;
    };

export interface GananciasApi {
  readonly total: number;
}

export interface TurnoAgendaApi {
  readonly id: string;
  readonly profesionalId: string;
  readonly boxId: string;
  readonly prestacionId: string;
  readonly pacienteId: string;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoTurnoUi;
  readonly origen: 'online' | 'recepcion' | 'profesional';
  readonly precioAlReservar?: number;
  readonly creadoPor: string;
  readonly creadoEn: string;
  readonly paciente: { readonly id: string; readonly nombre: string; readonly apellido: string } | null;
  readonly profesional: { readonly id: string; readonly nombre: string } | null;
  readonly box: { readonly id: string; readonly nombre: string } | null;
  readonly prestacion: { readonly id: string; readonly nombre: string; readonly duracionMin: number } | null;
}

export type AccionAuditoriaApi = 'creado' | 'reprogramado' | 'cancelado' | 'estado_cambiado';

export interface AuditoriaTurnoApi {
  readonly id: string;
  readonly turnoId: string;
  readonly accion: AccionAuditoriaApi;
  readonly actor: string;
  readonly fecha: string;
  readonly detalle: Readonly<Record<string, unknown>>;
}

export interface EntradaHistoriaApi {
  readonly id: string;
  readonly pacienteId: string;
  readonly profesionalId: string;
  readonly fecha: string;
  readonly texto: string;
  readonly turnoId?: string;
  readonly corrigeAId?: string;
}

export type CaraPiezaApi = 'oclusal' | 'mesial' | 'distal' | 'vestibular' | 'lingual';
export type EstadoDePiezaApi =
  | 'sano'
  | 'caries'
  | 'obturado'
  | 'ausente'
  | 'corona'
  | 'endodoncia'
  | 'a_extraer';

export interface EstadoPiezaApi {
  readonly id: string;
  readonly odontogramaId: string;
  readonly pieza: number;
  readonly cara?: CaraPiezaApi;
  readonly estado: EstadoDePiezaApi;
  readonly registradoPor: string;
  readonly fecha: string;
}

export interface VistaOdontogramaApi {
  readonly odontogramaId: string | null;
  readonly pacienteId: string;
  readonly actualizadoEn: string | null;
  readonly piezas: readonly EstadoPiezaApi[];
  readonly historial: readonly EstadoPiezaApi[];
}

export interface ItemActualizacionPiezaPayload {
  readonly pieza: number;
  readonly cara?: CaraPiezaApi;
  readonly estado: EstadoDePiezaApi;
}

export function listarPrestaciones(cliente: ClienteHttp = apiConsultorio): Promise<PrestacionApi[]> {
  return cliente.get<PrestacionApi[]>('/api/prestaciones');
}

export function crearPrestacion(
  entrada: {
    readonly nombre: string;
    readonly duracionMin: number;
    readonly precio: number;
    readonly reservableOnline: boolean;
    readonly activa?: boolean;
  },
  cliente: ClienteHttp = apiConsultorio,
): Promise<PrestacionApi> {
  return cliente.post<PrestacionApi>('/api/prestaciones', entrada);
}

export function actualizarPrestacion(
  id: string,
  entrada: {
    readonly nombre?: string;
    readonly duracionMin?: number;
    readonly precio?: number;
    readonly reservableOnline?: boolean;
    readonly activa?: boolean;
  },
  cliente: ClienteHttp = apiConsultorio,
): Promise<PrestacionApi> {
  return cliente.patch<PrestacionApi>(`/api/prestaciones/${encodeURIComponent(id)}`, entrada);
}

export function listarBoxes(cliente: ClienteHttp = apiConsultorio): Promise<BoxApi[]> {
  return cliente.get<BoxApi[]>('/api/boxes');
}

export function crearBox(
  entrada: { readonly nombre: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<BoxApi> {
  return cliente.post<BoxApi>('/api/boxes', entrada);
}

export function actualizarBox(
  id: string,
  entrada: { readonly nombre?: string; readonly activo?: boolean },
  cliente: ClienteHttp = apiConsultorio,
): Promise<BoxApi> {
  return cliente.patch<BoxApi>(`/api/boxes/${encodeURIComponent(id)}`, entrada);
}

export function listarProfesionales(cliente: ClienteHttp = apiConsultorio): Promise<ProfesionalApi[]> {
  return cliente.get<ProfesionalApi[]>('/api/profesionales');
}

export function crearProfesional(
  entrada: { readonly nombre: string; readonly matricula: string; readonly usuarioId: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<ProfesionalApi> {
  return cliente.post<ProfesionalApi>('/api/profesionales', entrada);
}

export function actualizarProfesional(
  id: string,
  entrada: { readonly nombre?: string; readonly matricula?: string; readonly activo?: boolean },
  cliente: ClienteHttp = apiConsultorio,
): Promise<ProfesionalApi> {
  return cliente.patch<ProfesionalApi>(`/api/profesionales/${encodeURIComponent(id)}`, entrada);
}

export function listarHorariosProfesional(
  profesionalId: string,
  cliente: ClienteHttp = apiConsultorio,
): Promise<HorarioAtencionApi[]> {
  return cliente.get<HorarioAtencionApi[]>(
    `/api/profesionales/${encodeURIComponent(profesionalId)}/horarios`,
  );
}

export function guardarHorariosProfesional(
  profesionalId: string,
  horarios: readonly FranjaHorarioInput[],
  cliente: ClienteHttp = apiConsultorio,
): Promise<HorarioAtencionApi[]> {
  return cliente.post<HorarioAtencionApi[]>(
    `/api/profesionales/${encodeURIComponent(profesionalId)}/horarios`,
    { horarios },
  );
}

export function listarBloqueos(
  filtros?: { readonly profesionalId?: string; readonly boxId?: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<BloqueoAgendaApi[]> {
  const params = new URLSearchParams();
  if (filtros?.profesionalId) params.set('profesionalId', filtros.profesionalId);
  if (filtros?.boxId) params.set('boxId', filtros.boxId);
  const qs = params.toString();
  return cliente.get<BloqueoAgendaApi[]>(`/api/bloqueos${qs ? `?${qs}` : ''}`);
}

export function crearBloqueo(
  payload: CrearBloqueoPayload,
  cliente: ClienteHttp = apiConsultorio,
): Promise<BloqueoAgendaApi> {
  return cliente.post<BloqueoAgendaApi>('/api/bloqueos', payload);
}

export function eliminarBloqueo(
  id: string,
  cliente: ClienteHttp = apiConsultorio,
): Promise<void> {
  return cliente.delete<void>(`/api/bloqueos/${encodeURIComponent(id)}`);
}

export function obtenerGanancias(
  profesionalId: string,
  rango: { readonly desde: string; readonly hasta: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<GananciasApi> {
  const params = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
  return cliente.get<GananciasApi>(
    `/api/profesionales/${encodeURIComponent(profesionalId)}/ganancias?${params.toString()}`,
  );
}

export function listarAgenda(
  filtros: {
    readonly desde: string;
    readonly hasta: string;
    readonly profesionalId?: string;
    readonly boxId?: string;
  },
  cliente: ClienteHttp = apiConsultorio,
): Promise<TurnoAgendaApi[]> {
  const params = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta });
  if (filtros.profesionalId) params.set('profesionalId', filtros.profesionalId);
  if (filtros.boxId) params.set('boxId', filtros.boxId);
  return cliente.get<TurnoAgendaApi[]>(`/api/agenda?${params.toString()}`);
}

export function listarAuditoriaTurno(
  turnoId: string,
  cliente: ClienteHttp = apiConsultorio,
): Promise<AuditoriaTurnoApi[]> {
  return cliente.get<AuditoriaTurnoApi[]>(
    `/api/turnos/${encodeURIComponent(turnoId)}/auditoria`,
  );
}

export function cambiarEstadoTurnoProfesional(
  turnoId: string,
  estado: 'confirmado' | 'atendido' | 'ausente',
  cliente: ClienteHttp = apiConsultorio,
): Promise<TurnoAgendaApi> {
  return cliente.post<TurnoAgendaApi>(`/api/turnos/${encodeURIComponent(turnoId)}/estado`, {
    estado,
  });
}

export function listarPacientes(cliente: ClienteHttp = apiConsultorio): Promise<PacienteApi[]> {
  return cliente.get<PacienteApi[]>('/api/pacientes');
}

export function listarHistoriaClinica(
  pacienteId: string,
  cliente: ClienteHttp = apiConsultorio,
): Promise<EntradaHistoriaApi[]> {
  return cliente.get<EntradaHistoriaApi[]>(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/historia`,
  );
}

export function agregarEntradaHistoria(
  pacienteId: string,
  entrada: { readonly texto: string; readonly turnoId?: string; readonly corrigeAId?: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<EntradaHistoriaApi> {
  return cliente.post<EntradaHistoriaApi>(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/historia`,
    entrada,
  );
}

export function obtenerOdontograma(
  pacienteId: string,
  cliente: ClienteHttp = apiConsultorio,
): Promise<VistaOdontogramaApi> {
  return cliente.get<VistaOdontogramaApi>(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/odontograma`,
  );
}

export function actualizarOdontograma(
  pacienteId: string,
  piezas: readonly ItemActualizacionPiezaPayload[],
  cliente: ClienteHttp = apiConsultorio,
): Promise<VistaOdontogramaApi> {
  return cliente.put<VistaOdontogramaApi>(
    `/api/pacientes/${encodeURIComponent(pacienteId)}/odontograma`,
    { piezas },
  );
}
