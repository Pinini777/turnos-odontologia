import type { EstadoTurno, Turno } from '../../src/shared/entidades';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

/**
 * El seed de C-01 no trae turnos: cada test guarda los suyos.
 * Lunes 30/11/2026 de 10:00 a 10:30 en Mendoza (UTC-3): dentro del horario semilla.
 */
export const INICIO = new Date('2026-11-30T13:00:00Z');
export const FIN = new Date('2026-11-30T13:30:00Z');

/** Instantes de prueba relativos al turno de las 10:00. */
export const HORA = {
  unaSemanaAntes: '2026-11-23T13:00:00Z',
  ochoYMedia: '2026-11-30T11:30:00Z',
  nueveCincuentaYNueve: '2026-11-30T12:59:00Z',
  diez: '2026-11-30T13:00:00Z',
  diezYDiez: '2026-11-30T13:10:00Z',
  onceYMedia: '2026-11-30T14:30:00Z',
} as const;

export function turnoDePrueba(estado: EstadoTurno, cambios: Partial<Turno> = {}): Turno {
  return {
    id: `turno-${estado}`,
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: INICIO,
    fin: FIN,
    estado,
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-20T12:00:00Z'),
    ...cambios,
  };
}

/** Guarda un turno de prueba y lo devuelve. */
export async function guardarTurno(repos: Repositorios, estado: EstadoTurno, cambios: Partial<Turno> = {}): Promise<Turno> {
  const turno = turnoDePrueba(estado, cambios);
  await repos.turnos.guardar(turno);
  return turno;
}
