import type { AuditoriaTurno, Turno } from '../../src/shared/entidades';
import { SEED } from '../../src/shared/seed';

/**
 * Lunes 23/11/2026 de 09:00 a 13:00 de Mendoza (UTC-3), dentro del horario semilla.
 * Todos los datos son ficticios (RN-DA-01).
 */
export const LUNES_ISO = {
  desde: '2026-11-23T12:00:00Z',
  hasta: '2026-11-23T16:00:00Z',
} as const;

/** Hora del lunes 23/11/2026 en Mendoza → instante UTC. `hhmm` = '09:00'. */
export const lunes = (hhmm: string): Date => new Date(`2026-11-23T${hhmm}:00-03:00`);

/** Turno de Susanita Chirusi (paciente semilla 1) con la Dra. Pérez en el Box 1, Consulta de 30 min, lunes a las 09:00. */
export function turno(cambios: Partial<Turno> = {}): Turno {
  const inicio = cambios.inicio ?? lunes('09:00');
  return {
    id: 'turno-agenda-base',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio,
    fin: new Date(inicio.getTime() + 30 * 60_000),
    estado: 'reservado',
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-20T12:00:00Z'),
    ...cambios,
  };
}

/** Registro de auditoría ficticio del turno base. */
export function registro(cambios: Partial<AuditoriaTurno> = {}): AuditoriaTurno {
  return {
    id: 'auditoria-base',
    turnoId: 'turno-agenda-base',
    accion: 'creado',
    actor: SEED.usuarios.recepcion.id,
    fecha: lunes('08:30'),
    detalle: { despues: { estado: 'reservado' } },
    ...cambios,
  };
}
