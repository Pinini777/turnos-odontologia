import type { MensajeEmail } from '../../../shared/puertos';
import { enZonaConsultorio } from '../../../shared/zona';
import { generarIcs, generarLinkGoogleCalendar } from './calendario';
import {
  NOMBRE_CONSULTORIO_POR_DEFECTO,
  type DatosConfirmacionTurno,
  type OpcionesEmailConfirmacion,
} from './tipos';

function formatearFechaLegible(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}/${anio}`;
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Arma el email de confirmación de turno (alta presencial/online o reprogramación).
 * Incluye fecha y hora en la zona del consultorio, profesional, box, prestación,
 * link "Agregar a Google Calendar" y adjunto .ics (RN-NO-01).
 * Nunca incluye el precio de la prestación (RN-NO-03).
 */
export function armarEmailConfirmacion(
  datos: DatosConfirmacionTurno,
  opciones: OpcionesEmailConfirmacion,
): MensajeEmail {
  const inicioZona = enZonaConsultorio(datos.turno.inicio, opciones.zonaHoraria);
  const finZona = enZonaConsultorio(datos.turno.fin, opciones.zonaHoraria);
  const fechaLegible = formatearFechaLegible(inicioZona.fecha);
  const horarioLegible = `${inicioZona.hhmm} a ${finZona.hhmm}`;

  const linkGoogleCalendar = generarLinkGoogleCalendar(datos);
  const contenidoIcs = generarIcs(datos, opciones.dtstamp);

  const esReprogramado = datos.tipo === 'reprogramado';
  const consultorio = datos.consultorio ?? NOMBRE_CONSULTORIO_POR_DEFECTO;
  const nombrePaciente = `${datos.paciente.nombre} ${datos.paciente.apellido}`.trim();

  const prefijoAsunto = esReprogramado ? 'Turno reprogramado' : 'Confirmación de turno';
  const asunto = `${prefijoAsunto} - ${datos.prestacion.nombre} (${fechaLegible} ${inicioZona.hhmm})`;

  const introduccion = esReprogramado
    ? 'Tu turno odontológico fue reprogramado con los siguientes datos:'
    : 'Tu turno odontológico quedó confirmado con los siguientes datos:';

  const texto = [
    `Hola ${nombrePaciente},`,
    '',
    introduccion,
    `- Consultorio: ${consultorio}`,
    `- Fecha: ${fechaLegible}`,
    `- Horario: ${horarioLegible}`,
    `- Prestación: ${datos.prestacion.nombre}`,
    `- Profesional: ${datos.profesional.nombre}`,
    `- Box: ${datos.box.nombre}`,
    '',
    `Agregar a Google Calendar: ${linkGoogleCalendar}`,
    '',
    'También te adjuntamos el archivo turno.ics para agregarlo a tu calendario.',
  ].join('\n');

  const html = [
    '<!doctype html>',
    '<html lang="es">',
    '<body style="font-family: sans-serif; color: #1f2937; line-height: 1.5;">',
    `  <h2>${escaparHtml(prefijoAsunto)}</h2>`,
    `  <p>Hola ${escaparHtml(nombrePaciente)},</p>`,
    `  <p>${escaparHtml(introduccion)}</p>`,
    '  <ul>',
    `    <li><strong>Consultorio:</strong> ${escaparHtml(consultorio)}</li>`,
    `    <li><strong>Fecha:</strong> ${escaparHtml(fechaLegible)}</li>`,
    `    <li><strong>Horario:</strong> ${escaparHtml(horarioLegible)}</li>`,
    `    <li><strong>Prestación:</strong> ${escaparHtml(datos.prestacion.nombre)}</li>`,
    `    <li><strong>Profesional:</strong> ${escaparHtml(datos.profesional.nombre)}</li>`,
    `    <li><strong>Box:</strong> ${escaparHtml(datos.box.nombre)}</li>`,
    '  </ul>',
    `  <p><a href="${escaparHtml(linkGoogleCalendar)}" target="_blank" rel="noopener noreferrer">Agregar a Google Calendar</a></p>`,
    '  <p>También te adjuntamos el archivo <code>turno.ics</code> para agregarlo a tu calendario.</p>',
    '</body>',
    '</html>',
  ].join('\n');

  return {
    para: datos.paciente.email,
    asunto,
    texto,
    html,
    adjuntos: [
      {
        nombre: 'turno.ics',
        contenido: contenidoIcs,
        tipo: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  };
}
