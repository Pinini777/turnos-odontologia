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

export const DIAS_SEMANA: readonly {
  readonly valor: DiaSemana;
  readonly etiqueta: string;
  readonly corta: string;
}[] = [
  { valor: 1, etiqueta: 'Lunes', corta: 'Lun' },
  { valor: 2, etiqueta: 'Martes', corta: 'Mar' },
  { valor: 3, etiqueta: 'Miércoles', corta: 'Mié' },
  { valor: 4, etiqueta: 'Jueves', corta: 'Jue' },
  { valor: 5, etiqueta: 'Viernes', corta: 'Vie' },
  { valor: 6, etiqueta: 'Sábado', corta: 'Sáb' },
  { valor: 7, etiqueta: 'Domingo', corta: 'Dom' },
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

export interface RangoDiasIso {
  readonly desde: string;
  readonly hasta: string;
}

export interface AtajosFechaBloqueo {
  readonly hoy: RangoDiasIso;
  readonly manana: RangoDiasIso;
  readonly estaSemana: RangoDiasIso;
  readonly proximaSemana: RangoDiasIso;
}

function sumarDiasLocalIso(base: Date, dias: number): string {
  return fechaLocalADateIso(new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias));
}

export function obtenerAtajosFechaBloqueo(base: Date = new Date()): AtajosFechaBloqueo {
  const hoyIso = fechaLocalADateIso(base);
  const mananaIso = diaSiguienteIso(hoyIso);
  const diaJs = base.getDay(); // 0=Dom .. 6=Sáb

  if (diaJs >= 1 && diaJs <= 5) {
    const lunesProx = 8 - diaJs;
    return {
      hoy: { desde: hoyIso, hasta: hoyIso },
      manana: { desde: mananaIso, hasta: mananaIso },
      estaSemana: { desde: hoyIso, hasta: sumarDiasLocalIso(base, 5 - diaJs) },
      proximaSemana: {
        desde: sumarDiasLocalIso(base, lunesProx),
        hasta: sumarDiasLocalIso(base, lunesProx + 4),
      },
    };
  }

  const lunesEntrante = diaJs === 6 ? 2 : 1;
  return {
    hoy: { desde: hoyIso, hasta: hoyIso },
    manana: { desde: mananaIso, hasta: mananaIso },
    estaSemana: {
      desde: sumarDiasLocalIso(base, lunesEntrante),
      hasta: sumarDiasLocalIso(base, lunesEntrante + 4),
    },
    proximaSemana: {
      desde: sumarDiasLocalIso(base, lunesEntrante + 7),
      hasta: sumarDiasLocalIso(base, lunesEntrante + 11),
    },
  };
}

export function sumarMinutosEnGrilla(hora: string, minutos: number): string {
  const [hStr, mStr] = hora.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return '09:00';
  const minTope = 7 * 60;
  const maxTope = 21 * 60 + 45;
  const total = Math.max(minTope, Math.min(maxTope, h * 60 + m + minutos));
  const redondeado = Math.floor(total / 15) * 15;
  const hh = String(Math.floor(redondeado / 60)).padStart(2, '0');
  const mm = String(redondeado % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatearFechaCortaIso(fechaIso: string): string {
  const partes = fechaIso.split('-');
  if (partes.length !== 3) return fechaIso;
  const [anio, mes, dia] = partes;
  if (!anio || !mes || !dia) return fechaIso;
  return `${dia}/${mes}/${anio}`;
}

export function esBloqueoDiaCompleto(inicioIso: string, finIso: string): boolean {
  const tInicio = Date.parse(inicioIso);
  const tFin = Date.parse(finIso);
  if (Number.isNaN(tInicio) || Number.isNaN(tFin) || tFin <= tInicio) return false;
  return formatearHora(inicioIso) === '00:00' && formatearHora(finIso) === '00:00';
}
