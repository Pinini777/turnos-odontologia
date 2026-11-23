/**
 * Reglas puras del área de recepción (C-13): sin React, sin red y sin leer la hora.
 * Las fechas de agenda se arman en la zona del consultorio (design D7).
 */

export type EstadoTurno = 'reservado' | 'confirmado' | 'atendido' | 'ausente' | 'cancelado';
export type Accion = 'confirmar' | 'atendido' | 'ausente' | 'reprogramar' | 'cancelar';

/** Zona del consultorio. Argentina no tiene horario de verano: el offset es siempre -03:00. */
export const ZONA_CONSULTORIO = 'America/Argentina/Mendoza';
const OFFSET = '-03:00';

const ACCIONES: Readonly<Record<EstadoTurno, readonly Accion[]>> = {
  reservado: ['confirmar', 'reprogramar', 'cancelar'],
  confirmado: ['atendido', 'ausente', 'reprogramar', 'cancelar'],
  atendido: [],
  ausente: [],
  cancelado: [],
};

/**
 * Acciones que se ofrecen según el estado (spec "Acciones según el estado del turno").
 * No replica la regla horaria de C-05: si atendido/ausente es prematuro, el backend responde 409.
 */
export function accionesPara(estado: EstadoTurno): readonly Accion[] {
  return ACCIONES[estado];
}

// --- Fechas -------------------------------------------------------------------------------

/** "YYYY-MM-DD" a un Date en UTC al mediodía, solo para aritmética de días. */
function aFechaUtc(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

function deFechaUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const f = aFechaUtc(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return deFechaUtc(f);
}

/** Lunes de la semana de `fecha` (la semana va de lunes a domingo). */
export function lunesDe(fecha: string): string {
  const diaSemana = aFechaUtc(fecha).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, diaSemana === 0 ? -6 : 1 - diaSemana);
}

export interface Rango {
  readonly desde: string;
  readonly hasta: string;
}

const inicioDelDia = (fecha: string) => `${fecha}T00:00:00${OFFSET}`;

export function rangoDia(fecha: string): Rango {
  return { desde: inicioDelDia(fecha), hasta: inicioDelDia(sumarDias(fecha, 1)) };
}

export function rangoSemana(fecha: string): Rango {
  const lunes = lunesDe(fecha);
  return { desde: inicioDelDia(lunes), hasta: inicioDelDia(sumarDias(lunes, 7)) };
}

export function diasDeSemana(fecha: string): string[] {
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CONSULTORIO, year: 'numeric', month: '2-digit', day: '2-digit',
});
const formatoHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Fecha local del consultorio ("YYYY-MM-DD") de un instante. */
export function fechaEnZona(instante: string | Date): string {
  return formatoFecha.format(new Date(instante));
}

/** Hora local del consultorio ("HH:mm") de un instante. */
export function horaEnZona(instante: string | Date): string {
  return formatoHora.format(new Date(instante));
}

/** Instante ISO con offset del consultorio para una fecha y hora locales. */
export function instanteLocal(fecha: string, hhmm: string): string {
  return `${fecha}T${hhmm}:00${OFFSET}`;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** "Mar 24/11". */
export function etiquetaDia(fecha: string): string {
  const f = aFechaUtc(fecha);
  const dd = String(f.getUTCDate()).padStart(2, '0');
  const mm = String(f.getUTCMonth() + 1).padStart(2, '0');
  return `${DIAS[f.getUTCDay()]} ${dd}/${mm}`;
}

// --- Listas ----------------------------------------------------------------------------------

/** Agrupa por fecha local y ordena por inicio; los días quedan en orden cronológico. */
export function agruparPorDia<T extends { readonly inicio: string }>(turnos: readonly T[]): Map<string, T[]> {
  const ordenados = [...turnos].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const grupos = new Map<string, T[]>();
  for (const turno of ordenados) {
    const dia = fechaEnZona(turno.inicio);
    grupos.set(dia, [...(grupos.get(dia) ?? []), turno]);
  }
  return grupos;
}

/** Huecos de la mañana (antes de las 14:00) y de la tarde, en hora del consultorio. */
export function separarMananaTarde<T extends { readonly inicio: string }>(huecos: readonly T[]): { manana: T[]; tarde: T[] } {
  const manana: T[] = [];
  const tarde: T[] = [];
  for (const hueco of huecos) {
    (horaEnZona(hueco.inicio) < '14:00' ? manana : tarde).push(hueco);
  }
  return { manana, tarde };
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Busca por nombre, apellido o documento, sin distinguir mayúsculas ni tildes. */
export function filtrarPacientes<T extends { readonly nombre: string; readonly apellido: string; readonly documento: string }>(
  pacientes: readonly T[],
  consulta: string,
): T[] {
  const q = normalizar(consulta);
  if (q.length === 0) return [...pacientes];
  return pacientes.filter((p) => normalizar(`${p.nombre} ${p.apellido} ${p.documento}`).includes(q));
}
