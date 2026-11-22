import type { HorarioAtencion } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import type { FechaEnZona } from '../../../shared/zona';

const HORA_EN_GRILLA_15 = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** Valida que la duración de una prestación sea un entero positivo múltiplo de 15 min (RN-AG-06). */
export function validarDuracionPrestacion(duracionMin: number): void {
  if (!(Number.isInteger(duracionMin) && duracionMin > 0 && duracionMin % 15 === 0)) {
    throw new ReglaDeNegocioError('DURACION_INVALIDA');
  }
}

/** Verifica formato HH:mm (00:00–23:45) con minutos en la grilla de 15 min (RN-AG-05). */
export function esHoraEnGrilla15(hhmm: string): boolean {
  return HORA_EN_GRILLA_15.test(hhmm);
}

/** Exige que ambos extremos de una franja horaria caigan en la grilla de 15 min (RN-AG-05). */
export function validarFranjaHorarioEnGrilla(desde: string, hasta: string): void {
  if (!esHoraEnGrilla15(desde) || !esHoraEnGrilla15(hasta)) {
    throw new ReglaDeNegocioError('FUERA_DE_GRILLA');
  }
}

/** Detecta solapamiento entre intervalos semiabiertos [aInicio, aFin) y [bInicio, bFin) (RN-AG-04). */
export function haySolapamientoIntervalos(
  aInicio: Date,
  aFin: Date,
  bInicio: Date,
  bFin: Date,
): boolean {
  return aInicio.getTime() < bFin.getTime() && bInicio.getTime() < aFin.getTime();
}

/** Verifica que [inicio, fin) esté contenido en alguna franja del mismo día en APP_TZ (RN-AG-09). */
export function estaDentroDeHorario(
  inicio: Date,
  fin: Date,
  inicioZona: FechaEnZona,
  finZona: FechaEnZona,
  horariosDelDia: ReadonlyArray<Pick<HorarioAtencion, 'desde' | 'hasta'>>,
): boolean {
  if (inicio.getTime() >= fin.getTime()) return false;
  if (inicioZona.fecha !== finZona.fecha) return false;

  return horariosDelDia.some(
    (h) =>
      h.desde <= inicioZona.hhmm &&
      (finZona.hhmm < h.hasta ||
        (finZona.hhmm === h.hasta && fin.getUTCSeconds() === 0 && fin.getUTCMilliseconds() === 0)),
  );
}
