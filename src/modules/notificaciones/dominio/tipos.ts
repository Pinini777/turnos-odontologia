export type TipoNotificacionTurno = 'creado' | 'reprogramado';

export const NOMBRE_CONSULTORIO_POR_DEFECTO = 'Consultorio Odontológico';

export interface TurnoParaNotificacion {
  readonly id: string;
  readonly inicio: Date;
  readonly fin: Date;
  readonly creadoEn?: Date;
}

export interface PacienteParaNotificacion {
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
}

export interface ProfesionalParaNotificacion {
  readonly nombre: string;
}

export interface BoxParaNotificacion {
  readonly nombre: string;
}

export interface PrestacionParaNotificacion {
  readonly nombre: string;
  readonly duracionMin?: number;
}

export interface DatosCalendario {
  readonly turno: TurnoParaNotificacion;
  readonly paciente: Pick<PacienteParaNotificacion, 'nombre' | 'apellido'>;
  readonly profesional: ProfesionalParaNotificacion;
  readonly box: BoxParaNotificacion;
  readonly prestacion: PrestacionParaNotificacion;
  readonly tipo?: TipoNotificacionTurno;
  readonly sequence?: number;
  readonly consultorio?: string;
}

export interface DatosConfirmacionTurno extends DatosCalendario {
  readonly paciente: PacienteParaNotificacion;
}

export interface OpcionesEmailConfirmacion {
  /** Zona horaria del consultorio (ej. America/Argentina/Mendoza, DD-08). */
  readonly zonaHoraria: string;
  /** Instante inyectado desde Clock para el DTSTAMP del archivo .ics. */
  readonly dtstamp?: Date;
}
