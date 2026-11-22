/** Única fuente de "ahora". El dominio la recibe por parámetro (DD-08). */
export interface Clock {
  ahora(): Date;
}

export class SystemClock implements Clock {
  ahora(): Date {
    return new Date();
  }
}

/** Reloj de tests: siempre devuelve el mismo instante, como copia nueva. */
export class FixedClock implements Clock {
  private readonly ms: number;

  constructor(instante: string | Date) {
    this.ms = new Date(instante).getTime();
    if (Number.isNaN(this.ms)) throw new Error(`FixedClock: instante inválido ${String(instante)}`);
  }

  ahora(): Date {
    return new Date(this.ms);
  }
}
