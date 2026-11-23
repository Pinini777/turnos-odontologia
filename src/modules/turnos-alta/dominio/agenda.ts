import type { Turno } from '../../../shared/entidades';
import { enZonaConsultorio } from '../../../shared/zona';

export function seSuperponen(a: Pick<Turno, 'inicio' | 'fin'>, b: Pick<Turno, 'inicio' | 'fin'>): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

export function conflictos(turnos: Turno[], nuevo: Turno): { profesional: boolean; box: boolean } {
  const activos = turnos.filter((turno) => turno.estado !== 'cancelado' && seSuperponen(turno, nuevo));
  return {
    profesional: activos.some((turno) => turno.profesionalId === nuevo.profesionalId),
    box: activos.some((turno) => turno.boxId === nuevo.boxId),
  };
}

export function enGrilla(inicio: Date, tz?: string): boolean {
  const minutos = Number(enZonaConsultorio(inicio, tz).hhmm.slice(3));
  return minutos % 15 === 0 && inicio.getUTCSeconds() === 0 && inicio.getUTCMilliseconds() === 0;
}
