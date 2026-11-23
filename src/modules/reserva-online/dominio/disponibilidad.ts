import type { BloqueoAgenda, Box, HorarioAtencion, Profesional, Turno } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import { enZonaConsultorio } from '../../../shared/zona';
import { estaDentroDeHorario, haySolapamientoIntervalos } from '../../configuracion/dominio/reglas';
import { enGrilla, seSuperponen } from '../../turnos-alta/dominio/agenda';

const MINUTO_MS = 60_000;
const PASO_GRILLA_MS = 15 * MINUTO_MS;

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

function primerInstanteEnGrilla(desdeMs: number, tz: string): number {
  let candidatoMs = Math.ceil(desdeMs / MINUTO_MS) * MINUTO_MS;
  while (!enGrilla(new Date(candidatoMs), tz)) {
    candidatoMs += MINUTO_MS;
  }
  return candidatoMs;
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

  const huecos: HuecoDisponible[] = [];
  for (
    let candidatoMs = primerInstanteEnGrilla(inicioEfectivoMs, tz);
    candidatoMs + duracionMs <= hastaMs;
    candidatoMs += PASO_GRILLA_MS
  ) {
    const inicio = new Date(candidatoMs);
    if (!enGrilla(inicio, tz)) continue;

    const finMs = candidatoMs + duracionMs;
    const fin = new Date(finMs);
    const intervalo: Intervalo = { inicio, fin };

    const boxIdsLibres = boxesActivos
      .filter(
        (box) =>
          !boxTieneBloqueo(box.id, intervalo, bloqueos) &&
          !boxTieneTurnoActivo(box.id, intervalo, turnosActivos),
      )
      .map((box) => box.id);

    if (boxIdsLibres.length === 0) continue;

    const inicioZona = enZonaConsultorio(inicio, tz);
    const finZona = enZonaConsultorio(fin, tz);

    for (const profesional of profesionalesActivos) {
      const horariosDelDia = horarios.filter(
        (h) => h.profesionalId === profesional.id && h.diaSemana === inicioZona.diaSemana,
      );
      if (!estaDentroDeHorario(inicio, fin, inicioZona, finZona, horariosDelDia)) continue;
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
