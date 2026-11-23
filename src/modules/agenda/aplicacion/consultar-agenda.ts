import type { Turno } from '../../../shared/entidades';
import type { Repositorios } from '../../../shared/repositorios';
import {
  filtrarPorRecursos,
  ordenarPorInicio,
  turnosEnRango,
  type FiltroRecursos,
  type RangoAgenda,
} from '../dominio/agenda';

export type ConsultaAgenda = RangoAgenda & FiltroRecursos;

/** Turno con los resúmenes para mostrarlo (D4). `null` si una referencia falta por datos inconsistentes. */
export interface TurnoEnAgenda extends Turno {
  paciente: { id: string; nombre: string; apellido: string } | null;
  profesional: { id: string; nombre: string } | null;
  box: { id: string; nombre: string } | null;
  /** Sin `precio` a propósito: no depende solo del serializador global (RN-RO-01). */
  prestacion: { id: string; nombre: string; duracionMin: number } | null;
}

/**
 * Agenda del rango con filtros opcionales, ordenada por `inicio` (US-014).
 * No recibe la sesión: el rol lo valida la ruta y `preSerialization` quita los precios a quien no es profesional.
 */
export async function consultarAgenda(
  consulta: ConsultaAgenda,
  { repos }: { repos: Repositorios },
): Promise<TurnoEnAgenda[]> {
  const turnos = ordenarPorInicio(filtrarPorRecursos(turnosEnRango(await repos.turnos.listar(), consulta), consulta));

  return Promise.all(
    turnos.map(async (turno) => {
      const [paciente, profesional, box, prestacion] = await Promise.all([
        repos.pacientes.buscarPorId(turno.pacienteId),
        repos.profesionales.buscarPorId(turno.profesionalId),
        repos.boxes.buscarPorId(turno.boxId),
        repos.prestaciones.buscarPorId(turno.prestacionId),
      ]);
      return {
        ...turno,
        paciente: paciente ? { id: paciente.id, nombre: paciente.nombre, apellido: paciente.apellido } : null,
        profesional: profesional ? { id: profesional.id, nombre: profesional.nombre } : null,
        box: box ? { id: box.id, nombre: box.nombre } : null,
        prestacion: prestacion
          ? { id: prestacion.id, nombre: prestacion.nombre, duracionMin: prestacion.duracionMin }
          : null,
      };
    }),
  );
}
