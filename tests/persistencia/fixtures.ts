import { randomUUID } from 'node:crypto';
import type { Turno } from '../../src/shared/entidades';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

export const inicio = new Date('2027-01-04T12:00:00Z');
export const fin = new Date('2027-01-04T12:30:00Z');
export const creadoEn = new Date('2027-01-01T12:00:00Z');
export const profesionalId = SEED.profesionales.anaPerez.id;
export const boxId = SEED.boxes.box1.id;
export const prestacionId = SEED.prestaciones.consulta.id;
export const pacienteId = SEED.pacientes.uno.id;
export const usuarioId = SEED.usuarios.anaPerez.id;

export const turnoFicticio = (cambios: Partial<Turno> = {}): Turno => ({
  id: randomUUID(), profesionalId, boxId, prestacionId, pacienteId,
  inicio, fin, creadoEn, creadoPor: usuarioId, estado: 'reservado', origen: 'profesional',
  precioAlReservar: 15000.25, ...cambios,
});

export async function cargarBase(repos: Repositorios): Promise<void> {
  for (const usuario of Object.values(SEED.usuarios)) await repos.usuarios.guardar(usuario);
  for (const profesional of Object.values(SEED.profesionales)) await repos.profesionales.guardar(profesional);
  for (const box of Object.values(SEED.boxes)) await repos.boxes.guardar(box);
  for (const prestacion of Object.values(SEED.prestaciones)) await repos.prestaciones.guardar(prestacion);
  for (const paciente of Object.values(SEED.pacientes)) await repos.pacientes.guardar(paciente);
  for (const horario of SEED.horarios) await repos.horarios.guardar(horario);
}
