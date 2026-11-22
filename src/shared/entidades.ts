/**
 * Entidades de knowledge-base/04_modelo_de_datos.md. Congeladas después de C-01.
 * Fechas como Date (se serializan en ISO 8601 UTC); montos en ARS como number con 2 decimales.
 */

export type Rol = 'profesional' | 'recepcionista' | 'paciente';
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** HH:mm en la grilla de 15 minutos, en la zona del consultorio. */
export type HoraDelDia = string;

export interface Usuario {
  id: string;
  email: string;
  hashPassword: string;
  rol: Rol;
  activo: boolean;
}

export interface Profesional {
  id: string;
  nombre: string;
  matricula: string;
  activo: boolean;
  usuarioId: string;
}

/** Puesto de atención (los proveedores lo llaman "sillón"). */
export interface Box {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface Prestacion {
  id: string;
  nombre: string;
  /** Múltiplo de 15, mayor que 0 (RN-AG-06). */
  duracionMin: number;
  /** Visible solo para el profesional (RN-RO-01). */
  precio: number;
  reservableOnline: boolean;
  activa: boolean;
}

export interface HorarioAtencion {
  id: string;
  profesionalId: string;
  diaSemana: DiaSemana;
  desde: HoraDelDia;
  hasta: HoraDelDia;
}

/** Exactamente uno de profesionalId o boxId. */
export type BloqueoAgenda = {
  id: string;
  inicio: Date;
  fin: Date;
  motivo: string;
} & ({ profesionalId: string; boxId?: undefined } | { boxId: string; profesionalId?: undefined });

export interface Paciente {
  id: string;
  usuarioId?: string;
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export type EstadoTurno = 'reservado' | 'confirmado' | 'atendido' | 'ausente' | 'cancelado';
export type OrigenTurno = 'online' | 'recepcion' | 'profesional';

export interface Turno {
  id: string;
  profesionalId: string;
  boxId: string;
  prestacionId: string;
  pacienteId: string;
  /** Intervalo semiabierto [inicio, fin) (RN-AG-04). */
  inicio: Date;
  fin: Date;
  estado: EstadoTurno;
  origen: OrigenTurno;
  /** Precio congelado al reservar (RN-GA-02). */
  precioAlReservar: number;
  creadoPor: string;
  creadoEn: Date;
}

export type AccionAuditoria = 'creado' | 'reprogramado' | 'cancelado' | 'estado_cambiado';

/** Append-only (RN-TU-05). */
export interface AuditoriaTurno {
  id: string;
  turnoId: string;
  accion: AccionAuditoria;
  /** usuarioId del actor, o "paciente". */
  actor: string;
  fecha: Date;
  /** Valores antes y después. */
  detalle: Record<string, unknown>;
}

/** Append-only (RN-CL-01): una corrección es una entrada nueva que referencia a la anterior. */
export interface EntradaHistoriaClinica {
  id: string;
  pacienteId: string;
  profesionalId: string;
  fecha: Date;
  texto: string;
  turnoId?: string;
  corrigeAId?: string;
}

export interface Odontograma {
  id: string;
  pacienteId: string;
  actualizadoEn: Date;
}

export type CaraPieza = 'oclusal' | 'mesial' | 'distal' | 'vestibular' | 'lingual';
export type EstadoDePieza = 'sano' | 'caries' | 'obturado' | 'ausente' | 'corona' | 'endodoncia' | 'a_extraer';

/** Append-only: cada cambio del odontograma es un registro nuevo con autor y fecha (RN-CL-02). */
export interface EstadoPieza {
  id: string;
  odontogramaId: string;
  /** Notación FDI: 11–48 y 51–85. */
  pieza: number;
  cara?: CaraPieza;
  estado: EstadoDePieza;
  registradoPor: string;
  fecha: Date;
}
