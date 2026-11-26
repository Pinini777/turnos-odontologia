/** Códigos de regla de negocio (RN-EX-01 + NO_ENCONTRADO, RECURSO_INACTIVO y DUPLICADO). Un código nuevo se le pide a EP. */
export const CODIGOS_NEGOCIO = [
  'SOLAPAMIENTO_PROFESIONAL',
  'SOLAPAMIENTO_BOX',
  'SOLAPAMIENTO_PACIENTE',
  'TURNO_PENDIENTE_EXISTENTE',
  'FUERA_DE_GRILLA',
  'DURACION_INVALIDA',
  'EN_BLOQUEO',
  'FUERA_DE_HORARIO',
  'EN_EL_PASADO',
  'PLAZO_VENCIDO',
  'TRANSICION_INVALIDA',
  'NO_ENCONTRADO',
  'RECURSO_INACTIVO',
  'DUPLICADO', // un dato que debe ser único ya existe (email, documento, matrícula, nombre de box)
] as const;

export type CodigoNegocio = (typeof CODIGOS_NEGOCIO)[number];

/** Violación de una regla: la API responde 409 {code}, salvo NO_ENCONTRADO → 404. */
export class ReglaDeNegocioError extends Error {
  constructor(readonly code: CodigoNegocio) {
    super(code);
    this.name = 'ReglaDeNegocioError';
  }
}

/** Falta la sesión o es inválida → 401 NO_AUTENTICADO. */
export class NoAutenticadoError extends Error {
  constructor() {
    super('NO_AUTENTICADO');
    this.name = 'NoAutenticadoError';
  }
}

/** Sesión válida con un rol no permitido → 403 SIN_PERMISO. */
export class SinPermisoError extends Error {
  constructor() {
    super('SIN_PERMISO');
    this.name = 'SinPermisoError';
  }
}
