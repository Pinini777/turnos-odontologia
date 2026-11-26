export interface DetalleErrorCampo {
  readonly campo: string;
  readonly motivo: string;
}

const MENSAJES_POR_CODIGO: Readonly<Record<string, string>> = {
  SOLAPAMIENTO_PROFESIONAL:
    'El profesional ya tiene un turno reservado en ese horario. Elegí otro bloque disponible.',
  SOLAPAMIENTO_BOX:
    'El box elegido ya está ocupado en ese horario. Elegí otro box o un turno contiguo libre.',
  SOLAPAMIENTO_PACIENTE:
    'El paciente ya tiene otro turno reservado en ese horario. Elegí otro bloque disponible.',
  TURNO_PENDIENTE_EXISTENTE:
    'Ya tenés un turno pendiente de atención. Podés reprogramarlo o cancelarlo desde Mis turnos.',
  FUERA_DE_GRILLA:
    'El horario debe empezar en bloques de 15 minutos (:00, :15, :30 o :45).',
  DURACION_INVALIDA:
    'La duración de la prestación debe ser mayor a 0 y múltiplo de 15 minutos.',
  EN_BLOQUEO:
    'El horario coincide con un bloqueo del profesional o del box (feriado, ausencia o mantenimiento).',
  FUERA_DE_HORARIO:
    'El turno cae fuera del horario de atención del profesional para ese día.',
  EN_EL_PASADO:
    'No se pueden crear ni reprogramar turnos en una fecha u horario pasado.',
  PLAZO_VENCIDO:
    'Solo podés cancelar o reprogramar tu turno online hasta 24 horas antes del inicio.',
  TRANSICION_INVALIDA:
    'No es posible realizar ese cambio de estado para el turno actual.',
  RECURSO_INACTIVO:
    'El profesional, el box o la prestación seleccionados están inactivos.',
  DUPLICADO:
    'Ya existe un registro con ese correo electrónico o documento.',
  NO_ENCONTRADO:
    'No encontramos el registro solicitado.',
  FORMATO_INVALIDO:
    'Revisá los datos ingresados: hay campos con formato inválido.',
  NO_AUTENTICADO:
    'Correo o contraseña incorrectos, o tu sesión venció. Volvé a ingresar.',
  SIN_PERMISO:
    'Tu rol no tiene permiso para realizar esta acción.',
  ERROR_INTERNO:
    'Ocurrió un error inesperado en el servidor. Intentá nuevamente en unos instantes.',
  RED_NO_DISPONIBLE:
    'No se pudo conectar con la API del consultorio. Verificá que el servidor backend esté activo.',
};

export function describirCodigoNegocio(code: string): string {
  return MENSAJES_POR_CODIGO[code] ?? 'No se pudo completar la operación solicitada.';
}
