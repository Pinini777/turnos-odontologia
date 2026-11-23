import type { Turno } from '../../../shared/entidades';

export interface PeriodoGanancias {
  desde: Date;
  hasta: Date;
}

/**
 * Ganancias de un período: suma `precioAlReservar` de los turnos `atendido`
 * cuyo `inicio` cae en el intervalo semiabierto [desde, hasta) (RN-GA-01, RN-GA-04).
 * Pura: sin reloj, sin repositorios y sin imports de Fastify (regla dura 9).
 * Suma en centavos para que 10000.10 + 20000.20 dé 30000.30 (D8).
 */
export function sumarGanancias(turnos: readonly Turno[], { desde, hasta }: PeriodoGanancias): number {
  const desdeMs = desde.getTime();
  const hastaMs = hasta.getTime();

  let centavos = 0;
  for (const turno of turnos) {
    if (turno.estado !== 'atendido') continue;
    const inicioMs = turno.inicio.getTime();
    if (inicioMs < desdeMs || inicioMs >= hastaMs) continue;
    centavos += Math.round(turno.precioAlReservar * 100);
  }

  return centavos / 100;
}
