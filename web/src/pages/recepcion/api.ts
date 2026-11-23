import type { ClienteHttp, PacienteApi } from '../../base/api';
import { apiConsultorio } from '../../base/sesion';
import type { EstadoTurno } from './dominio';

/**
 * Cliente tipado de las rutas que usa la recepción (design D1). Los tipos no declaran ningún
 * campo de precio a propósito (RN-RO-01, design D8): lo que no está en el tipo no se muestra.
 */

export interface Resumen {
  readonly id: string;
  readonly nombre: string;
}

export interface TurnoAgenda {
  readonly id: string;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoTurno;
  readonly profesionalId: string;
  readonly boxId: string;
  readonly pacienteId: string;
  readonly prestacionId: string;
  readonly paciente: Resumen & { readonly apellido: string };
  readonly profesional: Resumen;
  readonly box: Resumen;
  readonly prestacion: Resumen & { readonly duracionMin: number };
}

export interface Hueco {
  readonly inicio: string;
  readonly fin: string;
  readonly profesionalId: string;
  readonly boxIds: readonly string[];
}

export interface Profesional extends Resumen { readonly activo: boolean }
export interface Box extends Resumen { readonly activo: boolean }
export interface Prestacion extends Resumen { readonly duracionMin: number; readonly activa: boolean }

export interface DatosPacienteNuevo {
  readonly nombre: string;
  readonly apellido: string;
  readonly documento: string;
  readonly email: string;
  readonly telefono?: string;
}

export type PacienteDelTurno =
  | { readonly tipo: 'existente'; readonly pacienteId: string }
  | { readonly tipo: 'nuevo'; readonly datos: DatosPacienteNuevo };

export interface SolicitudTurno {
  readonly paciente: PacienteDelTurno;
  readonly profesionalId: string;
  readonly prestacionId: string;
  readonly inicio: string;
  /** Sin box: la API asigna uno libre ("Automático"). */
  readonly boxId?: string;
}

export interface CambiosReprogramacion {
  readonly inicio: string;
  readonly profesionalId?: string;
  readonly boxId?: string;
}

function conQuery(ruta: string, parametros: Readonly<Record<string, string | undefined>>): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') query.set(clave, valor);
  }
  return `${ruta}?${query.toString()}`;
}

const idEnRuta = (id: string) => encodeURIComponent(id);

export function obtenerAgenda(
  filtro: { readonly desde: string; readonly hasta: string; readonly profesionalId?: string; readonly boxId?: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<TurnoAgenda[]> {
  return cliente.get<TurnoAgenda[]>(conQuery('/api/agenda', filtro));
}

export function obtenerHuecos(
  consulta: { readonly prestacionId: string; readonly desde: string; readonly hasta: string; readonly profesionalId?: string },
  cliente: ClienteHttp = apiConsultorio,
): Promise<Hueco[]> {
  return cliente.get<Hueco[]>(conQuery('/api/recepcion/disponibilidad', consulta));
}

export function crearTurnoRecepcion(solicitud: SolicitudTurno, cliente: ClienteHttp = apiConsultorio): Promise<TurnoAgenda> {
  const { paciente, ...resto } = solicitud;
  const cuerpo = paciente.tipo === 'existente'
    ? { pacienteId: paciente.pacienteId, ...resto }
    : { paciente: paciente.datos, ...resto };
  return cliente.post<TurnoAgenda>('/api/recepcion/turnos', cuerpo);
}

export function cancelarTurno(id: string, cliente: ClienteHttp = apiConsultorio): Promise<unknown> {
  return cliente.post(`/api/turnos/${idEnRuta(id)}/cancelar`);
}

export function cambiarEstadoTurno(
  id: string,
  estado: 'confirmado' | 'atendido' | 'ausente',
  cliente: ClienteHttp = apiConsultorio,
): Promise<unknown> {
  return cliente.post(`/api/turnos/${idEnRuta(id)}/estado`, { estado });
}

export function reprogramarTurno(id: string, cambios: CambiosReprogramacion, cliente: ClienteHttp = apiConsultorio): Promise<unknown> {
  return cliente.patch(`/api/turnos/${idEnRuta(id)}/reprogramar`, cambios);
}

export function listarPacientes(cliente: ClienteHttp = apiConsultorio): Promise<PacienteApi[]> {
  return cliente.get<PacienteApi[]>('/api/pacientes');
}

export function crearPaciente(datos: DatosPacienteNuevo, cliente: ClienteHttp = apiConsultorio): Promise<PacienteApi> {
  return cliente.post<PacienteApi>('/api/pacientes', datos);
}

export function listarProfesionales(cliente: ClienteHttp = apiConsultorio): Promise<Profesional[]> {
  return cliente.get<Profesional[]>('/api/profesionales');
}

export function listarBoxes(cliente: ClienteHttp = apiConsultorio): Promise<Box[]> {
  return cliente.get<Box[]>('/api/boxes');
}

export function listarPrestaciones(cliente: ClienteHttp = apiConsultorio): Promise<Prestacion[]> {
  return cliente.get<Prestacion[]>('/api/prestaciones');
}
