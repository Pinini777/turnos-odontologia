import type { Box, Paciente, Prestacion, Profesional, Turno } from '../../../shared/entidades';
import type { MensajeEmail } from '../../../shared/puertos';
import { enZonaConsultorio } from '../../../shared/zona';

export function armarEmailDeAlta(
  turno: Turno,
  datos: { paciente: Paciente; profesional: Profesional; box: Box; prestacion: Prestacion },
): MensajeEmail {
  const { fecha, hhmm } = enZonaConsultorio(turno.inicio);
  const fechaLocal = fecha.split('-').reverse().join('/');
  return {
    para: datos.paciente.email,
    asunto: `Turno confirmado: ${fechaLocal} ${hhmm}`,
    texto: `Paciente: ${datos.paciente.nombre} ${datos.paciente.apellido}\nFecha: ${fechaLocal} ${hhmm}\nProfesional: ${datos.profesional.nombre}\nBox: ${datos.box.nombre}\nPrestación: ${datos.prestacion.nombre}`,
  };
}
