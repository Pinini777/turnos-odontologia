import type { Turno } from '../../src/shared/entidades';
import type { Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { AuthPort, UsuarioSesion } from '../../src/shared/sesion';
import { authDeTest } from '../plataforma/helpers';

/**
 * Período de prueba: lunes 23/11/2026, 09:00 a 13:00 de Mendoza (UTC-3).
 * Los turnos de abajo caen dentro de la grilla semilla (lunes a viernes, 09:00–13:00).
 */
export const PERIODO_ISO = {
  desde: '2026-11-23T12:00:00Z',
  hasta: '2026-11-23T16:00:00Z',
} as const;

export const PERIODO = {
  desde: new Date(PERIODO_ISO.desde),
  hasta: new Date(PERIODO_ISO.hasta),
};

/** Sesión del segundo profesional: `tests/plataforma/helpers.ts` no la conoce y no se puede editar (D9). */
export const SESION_BRUNO: UsuarioSesion = {
  usuarioId: SEED.usuarios.brunoGomez.id,
  rol: 'profesional',
  profesionalId: SEED.profesionales.brunoGomez.id,
};

/** Token propio de Bruno; los tres tokens de `authDeTest` siguen funcionando igual. */
export const TOKEN_BRUNO = 'prof-bruno';

/** `AuthPort` local: envuelve a `authDeTest` y agrega el token de Bruno (D9). */
export const authLocal: AuthPort = {
  async verificar(token) {
    return token === TOKEN_BRUNO ? SESION_BRUNO : authDeTest.verificar(token);
  },
};

/** Turno ficticio del período; `cambios` fija estado, dueño, precio y horario. */
export function turnoDeGanancias(cambios: Partial<Turno> = {}): Turno {
  return {
    id: 'turno-ganancias-base',
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId: SEED.pacientes.uno.id,
    inicio: new Date('2026-11-23T12:00:00Z'),
    fin: new Date('2026-11-23T12:30:00Z'),
    estado: 'atendido',
    origen: 'recepcion',
    precioAlReservar: SEED.prestaciones.consulta.precio,
    creadoPor: SEED.usuarios.recepcion.id,
    creadoEn: new Date('2026-11-20T12:00:00Z'),
    ...cambios,
  };
}

/**
 * Los cinco estados y los dos profesionales, sin solapamientos por profesional ni por box:
 * Ana en el box 1 y Bruno en el box 2, todos dentro de 09:00–13:00 de Mendoza.
 */
export function turnosDeGanancias(): Turno[] {
  return [
    turnoDeGanancias({
      id: 'turno-ganancias-atendido-15000',
      estado: 'atendido',
      precioAlReservar: 15000,
      inicio: new Date('2026-11-23T12:00:00Z'),
      fin: new Date('2026-11-23T12:30:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-ausente-25000',
      estado: 'ausente',
      precioAlReservar: 25000,
      inicio: new Date('2026-11-23T12:45:00Z'),
      fin: new Date('2026-11-23T13:15:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-cancelado-40000',
      estado: 'cancelado',
      precioAlReservar: 40000,
      inicio: new Date('2026-11-23T13:30:00Z'),
      fin: new Date('2026-11-23T14:30:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-atendido-10000',
      estado: 'atendido',
      precioAlReservar: 10000,
      inicio: new Date('2026-11-23T14:45:00Z'),
      fin: new Date('2026-11-23T15:00:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-reservado-40000',
      estado: 'reservado',
      precioAlReservar: 40000,
      inicio: new Date('2026-11-23T15:00:00Z'),
      fin: new Date('2026-11-23T15:30:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-confirmado-25000',
      estado: 'confirmado',
      precioAlReservar: 25000,
      inicio: new Date('2026-11-23T15:30:00Z'),
      fin: new Date('2026-11-23T16:00:00Z'),
    }),
    turnoDeGanancias({
      id: 'turno-ganancias-bruno-atendido-40000',
      profesionalId: SEED.profesionales.brunoGomez.id,
      boxId: SEED.boxes.box2.id,
      estado: 'atendido',
      precioAlReservar: 40000,
      inicio: new Date('2026-11-23T12:00:00Z'),
      fin: new Date('2026-11-23T13:00:00Z'),
    }),
  ];
}

/** Guarda un turno de prueba y lo devuelve. */
export async function guardarTurnoDeGanancias(repos: Repositorios, cambios: Partial<Turno> = {}): Promise<Turno> {
  const turno = turnoDeGanancias(cambios);
  await repos.turnos.guardar(turno);
  return turno;
}

/** Guarda el juego completo de `turnosDeGanancias()` y lo devuelve. */
export async function guardarTurnosDeGanancias(repos: Repositorios): Promise<Turno[]> {
  const turnos = turnosDeGanancias();
  for (const turno of turnos) await repos.turnos.guardar(turno);
  return turnos;
}
