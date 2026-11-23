export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const OFFSET_APP_TZ = '-03:00';

export const OPCIONES_DURACION_MIN: readonly number[] = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180,
];

export const OPCIONES_HORA_15: readonly string[] = (() => {
  const resultado: string[] = [];
  for (let hora = 7; hora <= 21; hora++) {
    for (const minuto of [0, 15, 30, 45]) {
      resultado.push(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`);
    }
  }
  return resultado;
})();

export const DIAS_SEMANA: readonly { readonly valor: DiaSemana; readonly etiqueta: string }[] = [
  { valor: 1, etiqueta: 'Lunes' },
  { valor: 2, etiqueta: 'Martes' },
  { valor: 3, etiqueta: 'Miércoles' },
  { valor: 4, etiqueta: 'Jueves' },
  { valor: 5, etiqueta: 'Viernes' },
  { valor: 6, etiqueta: 'Sábado' },
  { valor: 7, etiqueta: 'Domingo' },
];

export function etiquetaDiaSemana(dia: DiaSemana): string {
  return DIAS_SEMANA.find((d) => d.valor === dia)?.etiqueta ?? `Día ${String(dia)}`;
}

export function formatearArs(monto: number): string {
  const negativo = monto < 0;
  const absoluto = Math.abs(monto);
  const [entero = '0', decimales = '00'] = absoluto.toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}$ ${conMiles},${decimales}`;
}

export function diaSiguienteIso(fechaIso: string): string {
  const partes = fechaIso.split('-').map(Number);
  const anio = partes[0] ?? 2026;
  const mes = partes[1] ?? 1;
  const dia = partes[2] ?? 1;
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));
  const y = siguiente.getUTCFullYear();
  const m = String(siguiente.getUTCMonth() + 1).padStart(2, '0');
  const d = String(siguiente.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface EntradaRangoBloqueo {
  readonly diaDesde: string;
  readonly diaHasta: string;
  readonly diaCompleto: boolean;
  readonly horaDesde?: string;
  readonly horaHasta?: string;
}

export function construirRangoBloqueo(entrada: EntradaRangoBloqueo): {
  readonly inicio: string;
  readonly fin: string;
} {
  if (entrada.diaCompleto) {
    return {
      inicio: `${entrada.diaDesde}T00:00:00${OFFSET_APP_TZ}`,
      fin: `${diaSiguienteIso(entrada.diaHasta)}T00:00:00${OFFSET_APP_TZ}`,
    };
  }
  const horaDesde = entrada.horaDesde ?? '08:00';
  const horaHasta = entrada.horaHasta ?? '09:00';
  return {
    inicio: `${entrada.diaDesde}T${horaDesde}:00${OFFSET_APP_TZ}`,
    fin: `${entrada.diaHasta}T${horaHasta}:00${OFFSET_APP_TZ}`,
  };
}

export function construirRangoFechasIso(
  diaDesde: string,
  diaHasta: string,
): { readonly desde: string; readonly hasta: string } {
  return {
    desde: `${diaDesde}T00:00:00${OFFSET_APP_TZ}`,
    hasta: `${diaSiguienteIso(diaHasta)}T00:00:00${OFFSET_APP_TZ}`,
  };
}

export function fechaLocalADateIso(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function obtenerRangoMesActual(base: Date = new Date()): {
  readonly desde: string;
  readonly hasta: string;
} {
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fin = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { desde: fechaLocalADateIso(inicio), hasta: fechaLocalADateIso(fin) };
}

export function obtenerRangoUltimos7Dias(base: Date = new Date()): {
  readonly desde: string;
  readonly hasta: string;
} {
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 6);
  return { desde: fechaLocalADateIso(inicio), hasta: fechaLocalADateIso(base) };
}

export function obtenerRangoMesAnterior(base: Date = new Date()): {
  readonly desde: string;
  readonly hasta: string;
} {
  const inicio = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const fin = new Date(base.getFullYear(), base.getMonth(), 0);
  return { desde: fechaLocalADateIso(inicio), hasta: fechaLocalADateIso(fin) };
}

export function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(fecha);
}

export function formatearHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(fecha);
}
