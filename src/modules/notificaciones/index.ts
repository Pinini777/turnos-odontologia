export {
  crearNotificador,
  crearNotificadorEnMemoria,
  crearNotificadorSmtp,
  type AdjuntoSmtp,
  type ConfigSmtp,
  type CorreoSmtp,
  type FalloEnvio,
  type NotificadorConBandeja,
  type NotificadorEnMemoria,
  type OpcionesNotificador,
  type OpcionesSmtp,
  type TransporteSmtp,
} from './adapter';

export {
  enviarConfirmacionTurno,
  type DepsConfirmacionTurno,
} from './aplicacion/enviar-confirmacion';

export {
  formatearFechaUtcIcs,
  generarIcs,
  generarLinkGoogleCalendar,
} from './dominio/calendario';

export { armarEmailConfirmacion } from './dominio/confirmacion';

export {
  NOMBRE_CONSULTORIO_POR_DEFECTO,
  type BoxParaNotificacion,
  type DatosCalendario,
  type DatosConfirmacionTurno,
  type OpcionesEmailConfirmacion,
  type PacienteParaNotificacion,
  type PrestacionParaNotificacion,
  type ProfesionalParaNotificacion,
  type TipoNotificacionTurno,
  type TurnoParaNotificacion,
} from './dominio/tipos';
