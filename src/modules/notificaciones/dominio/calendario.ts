import { NOMBRE_CONSULTORIO_POR_DEFECTO, type DatosCalendario } from './tipos';

const GCAL_BASE_URL = 'https://calendar.google.com/calendar/render';
const ICS_PRODID = '-//Turnos Odontologia//Agenda//ES';
const ICS_UID_DOMINIO = 'turnos-odontologia.local';
const MAX_OCTETOS_LINEA_ICS = 75;

const textEncoder = new TextEncoder();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function validarFecha(fecha: Date, nombre: string): void {
  if (Number.isNaN(fecha.getTime())) {
    throw new RangeError(`Fecha inválida en ${nombre}`);
  }
}

function validarIntervalo(inicio: Date, fin: Date): void {
  validarFecha(inicio, 'inicio');
  validarFecha(fin, 'fin');
  if (fin.getTime() <= inicio.getTime()) {
    throw new RangeError('El fin del turno debe ser posterior al inicio');
  }
}

/** Formatea un instante en formato UTC básico de iCalendar/Google Calendar: YYYYMMDDTHHMMSSZ. */
export function formatearFechaUtcIcs(fecha: Date): string {
  validarFecha(fecha, 'fecha');
  const anio = String(fecha.getUTCFullYear()).padStart(4, '0');
  const mes = pad2(fecha.getUTCMonth() + 1);
  const dia = pad2(fecha.getUTCDate());
  const horas = pad2(fecha.getUTCHours());
  const minutos = pad2(fecha.getUTCMinutes());
  const segundos = pad2(fecha.getUTCSeconds());
  return `${anio}${mes}${dia}T${horas}${minutos}${segundos}Z`;
}

function textoTitulo(datos: DatosCalendario): string {
  return `${datos.prestacion.nombre} - ${datos.profesional.nombre}`;
}

function textoUbicacion(datos: DatosCalendario): string {
  const consultorio = datos.consultorio ?? NOMBRE_CONSULTORIO_POR_DEFECTO;
  return `${datos.box.nombre} - ${consultorio}`;
}

function textoDetalle(datos: DatosCalendario): string {
  const nombrePaciente = `${datos.paciente.nombre} ${datos.paciente.apellido}`.trim();
  const encabezado =
    datos.tipo === 'reprogramado'
      ? 'Turno odontológico reprogramado'
      : 'Turno odontológico confirmado';
  return [
    encabezado,
    `Prestación: ${datos.prestacion.nombre}`,
    `Profesional: ${datos.profesional.nombre}`,
    `Box: ${datos.box.nombre}`,
    `Paciente: ${nombrePaciente}`,
  ].join('\n');
}

/** Escapa texto para propiedades TEXT de RFC 5545 (§3.3.11). */
function escaparTextoIcs(valor: string): string {
  return valor
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n');
}

/** Pliega una línea lógica de iCalendar a un máximo de 75 octetos UTF-8 (RFC 5545 §3.1). */
function plegarLineaIcs(linea: string): string {
  if (textEncoder.encode(linea).length <= MAX_OCTETOS_LINEA_ICS) {
    return linea;
  }

  const segmentos: string[] = [];
  let actual = '';
  let octetosActuales = 0;
  let limite = MAX_OCTETOS_LINEA_ICS;

  for (const caracter of linea) {
    const octetosCaracter = textEncoder.encode(caracter).length;
    if (octetosActuales + octetosCaracter > limite && actual.length > 0) {
      segmentos.push(actual);
      actual = caracter;
      octetosActuales = octetosCaracter;
      limite = MAX_OCTETOS_LINEA_ICS - 1; // La continuación suma 1 octeto por el espacio inicial.
    } else {
      actual += caracter;
      octetosActuales += octetosCaracter;
    }
  }

  if (actual.length > 0) {
    segmentos.push(actual);
  }

  return segmentos.join('\r\n ');
}

/**
 * Genera el link "Agregar a Google Calendar" sin OAuth (DD-06, RN-NO-01).
 * Nunca incluye precios (RN-NO-03).
 */
export function generarLinkGoogleCalendar(datos: DatosCalendario): string {
  validarIntervalo(datos.turno.inicio, datos.turno.fin);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: textoTitulo(datos),
    dates: `${formatearFechaUtcIcs(datos.turno.inicio)}/${formatearFechaUtcIcs(datos.turno.fin)}`,
    details: textoDetalle(datos),
    location: textoUbicacion(datos),
  });

  return `${GCAL_BASE_URL}?${params.toString()}`;
}

/**
 * Genera un archivo .ics válido según RFC 5545 escrito a mano, sin dependencias externas (DD-06).
 * Nunca lee la hora del sistema (regla dura 9): usa dtstamp inyectado o turno.creadoEn / turno.inicio.
 * Nunca incluye precios (RN-NO-03).
 */
export function generarIcs(datos: DatosCalendario, dtstamp?: Date): string {
  validarIntervalo(datos.turno.inicio, datos.turno.fin);

  const marcaTemporal = dtstamp ?? datos.turno.creadoEn ?? datos.turno.inicio;
  validarFecha(marcaTemporal, 'dtstamp');

  const secuencia = datos.sequence ?? (datos.tipo === 'reprogramado' ? 1 : 0);
  const lineasLogicas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:turno-${datos.turno.id}@${ICS_UID_DOMINIO}`,
    `DTSTAMP:${formatearFechaUtcIcs(marcaTemporal)}`,
    `DTSTART:${formatearFechaUtcIcs(datos.turno.inicio)}`,
    `DTEND:${formatearFechaUtcIcs(datos.turno.fin)}`,
    `SEQUENCE:${secuencia}`,
    `SUMMARY:${escaparTextoIcs(textoTitulo(datos))}`,
    `DESCRIPTION:${escaparTextoIcs(textoDetalle(datos))}`,
    `LOCATION:${escaparTextoIcs(textoUbicacion(datos))}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lineasLogicas.map(plegarLineaIcs).join('\r\n')}\r\n`;
}
