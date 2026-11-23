import type {
  BloqueoAgenda,
  Box,
  DiaSemana,
  HorarioAtencion,
  Profesional,
  Turno,
} from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { FechaEnZona } from '../../../shared/zona';
import { estaDentroDeHorario, haySolapamientoIntervalos } from '../../configuracion/dominio/reglas';
import { seSuperponen } from '../../turnos-alta/dominio/agenda';

const MINUTO_MS = 60_000;
const PASO_GRILLA_MS = 15 * MINUTO_MS;
const DIAS: Record<string, DiaSemana> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface HuecoDisponible {
  inicio: Date;
  fin: Date;
  profesionalId: string;
  boxIds: string[];
}

export interface ParametrosCalculoHuecos {
  desde: Date;
  hasta: Date;
  duracionMin: number;
  ahora: Date;
  tz: string;
  profesionales: ReadonlyArray<Profesional>;
  boxes: ReadonlyArray<Box>;
  horarios: ReadonlyArray<HorarioAtencion>;
  bloqueos: ReadonlyArray<BloqueoAgenda>;
  turnos: ReadonlyArray<Turno>;
}

export interface ParametrosSeleccionBox {
  inicio: Date;
  fin: Date;
  boxes: ReadonlyArray<Box>;
  bloqueos: ReadonlyArray<BloqueoAgenda>;
  turnos: ReadonlyArray<Turno>;
}

interface Intervalo {
  inicio: Date;
  fin: Date;
}

function compararPorId(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function crearConversorZona(tz: string): (instante: Date) => FechaEnZona {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  return (instante: Date): FechaEnZona => {
    const partes = formatter.formatToParts(instante);
    const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? '';
    const diaSemana = DIAS[p('weekday')];
    if (diaSemana === undefined) throw new Error(`enZonaConsultorio: día no reconocido en ${tz}`);
    return {
      fecha: `${p('year')}-${p('month')}-${p('day')}`,
      diaSemana,
      hhmm: `${p('hour')}:${p('minute')}`,
    };
  };
}

function estaEnGrilla(instante: Date, zona: FechaEnZona): boolean {
  const minutos = Number(zona.hhmm.slice(3));
  return minutos % 15 === 0 && instante.getUTCSeconds() === 0 && instante.getUTCMilliseconds() === 0;
}

function primerInstanteEnGrilla(desdeMs: number, convertir: (instante: Date) => FechaEnZona): number {
  let candidatoMs = Math.ceil(desdeMs / MINUTO_MS) * MINUTO_MS;
  while (true) {
    const fecha = new Date(candidatoMs);
    if (estaEnGrilla(fecha, convertir(fecha))) return candidatoMs;
    candidatoMs += MINUTO_MS;
  }
}

function boxTieneBloqueo(
  boxId: string,
  intervalo: Intervalo,
  bloqueos: ReadonlyArray<BloqueoAgenda>,
): boolean {
  return bloqueos.some(
    (b) => b.boxId === boxId && haySolapamientoIntervalos(intervalo.inicio, intervalo.fin, b.inicio, b.fin),
  );
}

function boxTieneTurnoActivo(
  boxId: string,
  intervalo: Intervalo,
  turnosActivos: ReadonlyArray<Turno>,
): boolean {
  return turnosActivos.some((t) => t.boxId === boxId && seSuperponen(t, intervalo));
}

function profesionalBloqueadoOOcupado(
  profesionalId: string,
  intervalo: Intervalo,
  bloqueos: ReadonlyArray<BloqueoAgenda>,
  turnosActivos: ReadonlyArray<Turno>,
): boolean {
  const tieneBloqueo = bloqueos.some(
    (b) =>
      b.profesionalId === profesionalId &&
      haySolapamientoIntervalos(intervalo.inicio, intervalo.fin, b.inicio, b.fin),
  );
  if (tieneBloqueo) return true;
  return turnosActivos.some((t) => t.profesionalId === profesionalId && seSuperponen(t, intervalo));
}

/**
 * Calcula los huecos libres `[inicio, fin)` en grilla de 15 minutos en `tz`
 * a partir de `max(desde, ahora)`, ordenados por `inicio` ascendente y `profesionalId`.
 */
export function calcularHuecosDisponibles({
  desde,
  hasta,
  duracionMin,
  ahora,
  tz,
  profesionales,
  boxes,
  horarios,
  bloqueos,
  turnos,
}: ParametrosCalculoHuecos): HuecoDisponible[] {
  if (duracionMin <= 0 || desde.getTime() >= hasta.getTime()) return [];

  const profesionalesActivos = profesionales.filter((p) => p.activo).sort(compararPorId);
  const boxesActivos = boxes.filter((b) => b.activo).sort(compararPorId);
  if (profesionalesActivos.length === 0 || boxesActivos.length === 0) return [];

  const turnosActivos = turnos.filter((t) => t.estado !== 'cancelado');
  const duracionMs = duracionMin * MINUTO_MS;
  const hastaMs = hasta.getTime();
  const inicioEfectivoMs = Math.max(desde.getTime(), ahora.getTime());
  const convertirZona = crearConversorZona(tz);

  const horariosPorProfYDia = new Map<string, HorarioAtencion[]>();
  const diasConAtencion = new Set<DiaSemana>();
  const idsProfActivos = new Set(profesionalesActivos.map((p) => p.id));
  for (const h of horarios) {
    if (!idsProfActivos.has(h.profesionalId)) continue;
    diasConAtencion.add(h.diaSemana);
    const clave = `${h.profesionalId}:${h.diaSemana}`;
    const lista = horariosPorProfYDia.get(clave);
    if (lista) lista.push(h);
    else horariosPorProfYDia.set(clave, [h]);
  }
  if (diasConAtencion.size === 0) return [];

  const huecos: HuecoDisponible[] = [];
  for (
    let candidatoMs = primerInstanteEnGrilla(inicioEfectivoMs, convertirZona);
    candidatoMs + duracionMs <= hastaMs;
    candidatoMs += PASO_GRILLA_MS
  ) {
    const inicio = new Date(candidatoMs);
    const inicioZona = convertirZona(inicio);
    if (!estaEnGrilla(inicio, inicioZona)) continue;
    if (!diasConAtencion.has(inicioZona.diaSemana)) continue;

    const finMs = candidatoMs + duracionMs;
    const fin = new Date(finMs);
    const finZona = convertirZona(fin);

    const profesionalesEnHorario = profesionalesActivos.filter((profesional) => {
      const horariosDelDia = horariosPorProfYDia.get(`${profesional.id}:${inicioZona.diaSemana}`);
      if (!horariosDelDia) return false;
      return estaDentroDeHorario(inicio, fin, inicioZona, finZona, horariosDelDia);
    });
    if (profesionalesEnHorario.length === 0) continue;

    const intervalo: Intervalo = { inicio, fin };
    const boxIdsLibres = boxesActivos
      .filter(
        (box) =>
          !boxTieneBloqueo(box.id, intervalo, bloqueos) &&
          !boxTieneTurnoActivo(box.id, intervalo, turnosActivos),
      )
      .map((box) => box.id);

    if (boxIdsLibres.length === 0) continue;

    for (const profesional of profesionalesEnHorario) {
      if (profesionalBloqueadoOOcupado(profesional.id, intervalo, bloqueos, turnosActivos)) continue;

      huecos.push({
        inicio: new Date(candidatoMs),
        fin: new Date(finMs),
        profesionalId: profesional.id,
        boxIds: [...boxIdsLibres],
      });
    }
  }

  return huecos;
}

/**
 * Elige determinísticamente el primer box activo (ordenado por `id`) sin bloqueo ni turno
 * no cancelado superpuesto en `[inicio, fin)`.
 */
export function seleccionarBoxLibre({
  inicio,
  fin,
  boxes,
  bloqueos,
  turnos,
}: ParametrosSeleccionBox): Box {
  const boxesActivos = boxes.filter((b) => b.activo).sort(compararPorId);
  if (boxesActivos.length === 0) {
    throw new ReglaDeNegocioError('RECURSO_INACTIVO');
  }

  const turnosActivos = turnos.filter((t) => t.estado !== 'cancelado');
  const intervalo: Intervalo = { inicio, fin };
  let algunoConSolapamientoTurno = false;

  for (const box of boxesActivos) {
    const tieneBloqueo = boxTieneBloqueo(box.id, intervalo, bloqueos);
    const tieneTurno = boxTieneTurnoActivo(box.id, intervalo, turnosActivos);

    if (!tieneBloqueo && !tieneTurno) {
      return box;
    }
    if (tieneTurno) {
      algunoConSolapamientoTurno = true;
    }
  }

  throw new ReglaDeNegocioError(algunoConSolapamientoTurno ? 'SOLAPAMIENTO_BOX' : 'EN_BLOQUEO');
}
