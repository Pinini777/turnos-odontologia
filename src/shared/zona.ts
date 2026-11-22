import { APP_TZ } from './config';
import type { DiaSemana } from './entidades';

export interface FechaEnZona {
  /** YYYY-MM-DD en la zona del consultorio. */
  fecha: string;
  /** 1 = lunes … 7 = domingo. */
  diaSemana: DiaSemana;
  /** HH:mm en 24 h. */
  hhmm: string;
}

const DIAS: Record<string, DiaSemana> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Convierte un instante al día y la hora del consultorio (APP_TZ, DD-08). */
export function enZonaConsultorio(instante: Date, tz: string = APP_TZ): FechaEnZona {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(instante);
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? '';
  const diaSemana = DIAS[p('weekday')];
  if (diaSemana === undefined) throw new Error(`enZonaConsultorio: día no reconocido en ${tz}`);
  return { fecha: `${p('year')}-${p('month')}-${p('day')}`, diaSemana, hhmm: `${p('hour')}:${p('minute')}` };
}
