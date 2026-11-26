import { CLINICA } from '../../base/clinica';
import type { EstadoTurnoUi } from '../../base/components';

export const ZONA_CONSULTORIO = 'America/Argentina/Mendoza';
export const HORAS_MINIMAS_AUTOGESTION = 24;
const MS_POR_HORA = 60 * 60 * 1000;
const MS_PLAZO_MINIMO = HORAS_MINIMAS_AUTOGESTION * MS_POR_HORA;

export interface HuecoConInicio {
  readonly inicio: string;
}

export interface HuecoConProfesional extends HuecoConInicio {
  readonly profesionalId: string;
}

export interface DiaTira {
  readonly fecha: string;
  readonly diaSemana: string;
  readonly diaNumero: string;
  readonly mesCorto: string;
  readonly etiquetaCompleta: string;
}

export interface DatosGoogleCalendar {
  readonly prestacionNombre: string;
  readonly profesionalNombre: string;
  readonly boxNombre: string;
  readonly inicioIso: string;
  readonly finIso: string;
}

export interface BloqueFechaCalendario {
  readonly mesCorto: string;
  readonly dia: string;
  readonly diaSemanaCorto: string;
}

const PROFESIONALES_CONOCIDOS: Readonly<Record<string, string>> = {
  '00000000-0000-4000-8000-000000000101': 'Dra. Ana Pérez',
  '00000000-0000-4000-8000-000000000102': 'Dr. Bruno Gómez',
};

const BOXES_CONOCIDOS: Readonly<Record<string, string>> = {
  '00000000-0000-4000-8000-000000000201': 'Box 1',
  '00000000-0000-4000-8000-000000000202': 'Box 2',
};

const CODIGOS_CONFLICTO_HUECO = new Set<string>([
  'SOLAPAMIENTO_PROFESIONAL',
  'SOLAPAMIENTO_BOX',
  'SOLAPAMIENTO_PACIENTE',
  'EN_BLOQUEO',
  'FUERA_DE_HORARIO',
  'EN_EL_PASADO',
]);

const ESTADOS_AUTOGESTIONABLES = new Set<EstadoTurnoUi>(['reservado', 'confirmado']);

const fmtHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const fmtFechaLarga = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const fmtFechaPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CONSULTORIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fmtMesCorto = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  month: 'short',
});

const fmtDiaNumero = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  day: '2-digit',
});

const fmtDiaSemanaCorto = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  weekday: 'short',
});

const fmtDiaSemanaEn = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_CONSULTORIO,
  weekday: 'short',
});

function capitalizar(texto: string): string {
  return texto.length > 0 ? `${texto[0]?.toUpperCase() ?? ''}${texto.slice(1)}` : texto;
}

/**
 * Regla RN-RE-02: el paciente puede cancelar o reprogramar un turno activo
 * únicamente si falta al menos 24 horas exactas (`inicio - ahora >= 24 h`).
 */
export function puedeAutogestionarTurno(
  inicioIso: string,
  estado: EstadoTurnoUi,
  ahora: Date,
): boolean {
  if (!ESTADOS_AUTOGESTIONABLES.has(estado)) return false;
  const inicioMs = Date.parse(inicioIso);
  if (Number.isNaN(inicioMs)) return false;
  return inicioMs - ahora.getTime() >= MS_PLAZO_MINIMO;
}

/** Indica si un turno sigue activo (reservado o confirmado). */
export function esTurnoActivo(estado: EstadoTurnoUi): boolean {
  return ESTADOS_AUTOGESTIONABLES.has(estado);
}

/** Indica si un código de error 409 corresponde a un hueco que ya no está libre. */
export function esErrorConflictoHueco(code: string): boolean {
  return CODIGOS_CONFLICTO_HUECO.has(code);
}

/** Convierte una fecha `Date` a `YYYY-MM-DD` en la zona horaria del consultorio. */
export function fechaIsoEnZona(instante: Date): string {
  return fmtFechaPartes.format(instante);
}

/** Extrae `YYYY-MM-DD` en zona del consultorio a partir de un timestamp ISO. */
export function fechaYmdDeIso(iso: string): string {
  return fmtFechaPartes.format(new Date(iso));
}

/**
 * Elige la fecha inicial óptima para reservar:
 * si hoy es día hábil antes de las 18:30 devuelve hoy; si ya cerró la jornada o es fin de semana,
 * avanza automáticamente al próximo día hábil (lunes a viernes).
 */
export function fechaInicialSugerida(ahora: Date): string {
  const hoy = fechaIsoEnZona(ahora);
  const diaEn = fmtDiaSemanaEn.format(ahora);
  const horaStr = fmtHora.format(ahora);
  const minutosDelDia = Number(horaStr.slice(0, 2)) * 60 + Number(horaStr.slice(3, 5));

  if (diaEn === 'Sat') return sumarDiasIso(hoy, 2);
  if (diaEn === 'Sun') return sumarDiasIso(hoy, 1);
  if (minutosDelDia >= 18 * 60 + 30) {
    return diaEn === 'Fri' ? sumarDiasIso(hoy, 3) : sumarDiasIso(hoy, 1);
  }
  return hoy;
}

/** Devuelve el rango diario completo en offset explícito `-03:00` (Mendoza, sin DST). */
export function rangoDiaConsultorio(fechaYmd: string): {
  readonly desde: string;
  readonly hasta: string;
} {
  return {
    desde: `${fechaYmd}T00:00:00-03:00`,
    hasta: `${fechaYmd}T23:59:59-03:00`,
  };
}

/** Devuelve el rango multi-día (máximo 31 días) en offset explícito `-03:00`. */
export function rangoVentanaDias(
  inicioYmd: string,
  cantidadDias: number,
): { readonly desde: string; readonly hasta: string } {
  const finYmd = sumarDiasIso(inicioYmd, Math.max(1, cantidadDias) - 1);
  return {
    desde: `${inicioYmd}T00:00:00-03:00`,
    hasta: `${finYmd}T23:59:59-03:00`,
  };
}

/** Suma `dias` a una fecha calendario `YYYY-MM-DD` sin depender de la zona local del navegador. */
export function sumarDiasIso(fechaYmd: string, dias: number): string {
  const [anioStr, mesStr, diaStr] = fechaYmd.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  const utc = new Date(Date.UTC(anio, mes - 1, dia + dias));
  const y = String(utc.getUTCFullYear()).padStart(4, '0');
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Genera `cantidad` días consecutivos en español para la tira horizontal de fechas. */
export function generarTiraDias(inicioYmd: string, cantidad = 7): DiaTira[] {
  const dias: DiaTira[] = [];
  for (let i = 0; i < cantidad; i++) {
    const fecha = sumarDiasIso(inicioYmd, i);
    const mediodia = new Date(`${fecha}T12:00:00-03:00`);
    const diaSemana = capitalizar(fmtDiaSemanaCorto.format(mediodia).replace(/\.$/, ''));
    const mesCorto = capitalizar(fmtMesCorto.format(mediodia).replace(/\.$/, ''));
    const diaNumero = fmtDiaNumero.format(mediodia);
    dias.push({
      fecha,
      diaSemana,
      diaNumero,
      mesCorto,
      etiquetaCompleta: fechaLargaEnZona(`${fecha}T12:00:00-03:00`),
    });
  }
  return dias;
}

/** Formatea `HH:mm` en zona `America/Argentina/Mendoza`. */
export function horaEnZona(iso: string): string {
  return fmtHora.format(new Date(iso));
}

/** Formatea fecha larga capitalizada en español argentino (ej. "Jueves 26 de noviembre de 2026"). */
export function fechaLargaEnZona(iso: string): string {
  return capitalizar(fmtFechaLarga.format(new Date(iso)));
}

/** Extrae mes corto, día y día de semana para el bloque visual de calendario. */
export function fechaBloqueCalendario(iso: string): BloqueFechaCalendario {
  const fecha = new Date(iso);
  const mesCorto = fmtMesCorto.format(fecha).replace(/\.$/, '').toUpperCase();
  const diaSemanaCorto = capitalizar(fmtDiaSemanaCorto.format(fecha).replace(/\.$/, ''));
  return {
    mesCorto,
    dia: fmtDiaNumero.format(fecha),
    diaSemanaCorto,
  };
}

/**
 * Deduplica huecos con el mismo `inicio` (conservando determinísticamente el primero en la lista),
 * evitando mostrar horas repetidas cuando se consulta con "Cualquier profesional".
 */
export function deduplicarHuecosPorHora<T extends HuecoConProfesional>(
  huecos: readonly T[],
): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const h of huecos) {
    if (vistos.has(h.inicio)) continue;
    vistos.add(h.inicio);
    resultado.push(h);
  }
  return resultado;
}

/** Separa huecos en mañana (< 13:00) y tarde (>= 13:00) según la hora del consultorio. */
export function separarMananaTarde<T extends HuecoConInicio>(
  huecos: readonly T[],
): { readonly manana: T[]; readonly tarde: T[] } {
  const manana: T[] = [];
  const tarde: T[] = [];
  for (const h of huecos) {
    const hora = Number(horaEnZona(h.inicio).slice(0, 2));
    if (hora < 13) manana.push(h);
    else tarde.push(h);
  }
  return { manana, tarde };
}

function formatearFechaUtcCalendar(iso: string): string {
  const d = new Date(iso);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

/**
 * Construye el enlace "Agregar a Google Calendar" (mismo formato que C-06),
 * sin incluir nunca precios ni montos (RN-RO-01).
 */
export function construirLinkGoogleCalendar(datos: DatosGoogleCalendar): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Turno odontológico — ${datos.prestacionNombre}`,
    dates: `${formatearFechaUtcCalendar(datos.inicioIso)}/${formatearFechaUtcCalendar(datos.finIso)}`,
    details: [
      `Prestación: ${datos.prestacionNombre}`,
      `Profesional: ${datos.profesionalNombre}`,
      `Consultorio: ${datos.boxNombre}`,
      `${CLINICA.nombre} · Tel: ${CLINICA.telefono}`,
    ].join('\n'),
    location: `${CLINICA.nombre}, ${CLINICA.direccion}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Resuelve el nombre visible del profesional sin exponer UUIDs crudos ni invocar rutas 403. */
export function etiquetaProfesional(profesionalId: string): string {
  return PROFESIONALES_CONOCIDOS[profesionalId] ?? 'Profesional asignado';
}

/** Resuelve el nombre visible del box sin exponer UUIDs crudos ni invocar rutas 403. */
export function etiquetaBox(boxId: string): string {
  return BOXES_CONOCIDOS[boxId] ?? 'Box asignado';
}

/** Lista de profesionales conocidos del consultorio para el selector visual. */
export const PROFESIONALES_FILTRO: readonly { readonly id: string; readonly nombre: string }[] =
  Object.entries(PROFESIONALES_CONOCIDOS).map(([id, nombre]) => ({ id, nombre }));
