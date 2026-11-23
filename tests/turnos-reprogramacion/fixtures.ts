import type { Turno } from '../../src/shared/entidades';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

/**
 * El seed de C-01 no trae turnos: cada test guarda los suyos.
 * Por defecto: "Consulta" `reservado` de la Dra. Pérez en el Box 1, martes 24/11/2026 de 10:00 a 10:30
 * en Mendoza (UTC-3), dentro del horario semilla.
 */
export const DIA = '2026-11-24';

/** Instante en la zona del consultorio: `a('10:15')` o `a('10:00', '2026-11-25')`. */
export function a(hhmm: string, dia: string = DIA): Date {
  return new Date(`${dia}T${hhmm}:00-03:00`);
}

/** Lo mismo que `a`, como el texto ISO que recibe la API. */
export function iso(hhmm: string, dia: string = DIA): string {
  return `${dia}T${hhmm}:00-03:00`;
}

/** "Ahora" por defecto: el lunes 23/11/2026 a las 08:00. */
export const AHORA = '2026-11-23T08:00:00-03:00';

export function turnoDePrueba(cambios: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-a-mover',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: a('10:00'),
    fin: a('10:30'),
    estado: 'reservado',
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-20T12:00:00-03:00'),
    ...cambios,
  };
}

/** Guarda un turno de prueba y lo devuelve. */
export async function guardarTurno(repos: Repositorios, cambios: Partial<Turno> = {}): Promise<Turno> {
  const turno = turnoDePrueba(cambios);
  await repos.turnos.guardar(turno);
  return turno;
}
