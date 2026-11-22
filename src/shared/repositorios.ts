import type {
  AuditoriaTurno, BloqueoAgenda, Box, EntradaHistoriaClinica, EstadoPieza, HorarioAtencion,
  Odontograma, Paciente, Prestacion, Profesional, Turno, Usuario,
} from './entidades';
import { cargarSeed } from './seed';

/** Puerto genérico. No hay borrado: un turno "eliminado" es uno cancelado (RN-TU-03). */
export interface Repositorio<T extends { id: string }> {
  guardar(entidad: T): Promise<void>;
  buscarPorId(id: string): Promise<T | undefined>;
  listar(filtro?: (entidad: T) => boolean): Promise<T[]>;
  existe(id: string): Promise<boolean>;
}

/** Solo para configuración que se reemplaza o se quita (horarios, bloqueos). */
export interface RepositorioConBorrado<T extends { id: string }> extends Repositorio<T> {
  borrar(id: string): Promise<void>;
}

/** Auditoría, historia clínica y odontograma: solo se agrega (RN-TU-05, RN-CL-01). */
export interface RepositorioAppendOnly<T> {
  agregar(entidad: T): Promise<void>;
  listar(filtro?: (entidad: T) => boolean): Promise<T[]>;
}

export interface Repositorios {
  usuarios: Repositorio<Usuario>;
  profesionales: Repositorio<Profesional>;
  boxes: Repositorio<Box>;
  prestaciones: Repositorio<Prestacion>;
  horarios: RepositorioConBorrado<HorarioAtencion>;
  bloqueos: RepositorioConBorrado<BloqueoAgenda>;
  pacientes: Repositorio<Paciente>;
  turnos: Repositorio<Turno>;
  odontogramas: Repositorio<Odontograma>;
  auditoria: RepositorioAppendOnly<AuditoriaTurno>;
  historiaClinica: RepositorioAppendOnly<EntradaHistoriaClinica>;
  estadosPieza: RepositorioAppendOnly<EstadoPieza>;
}

/** Devuelve copias para que nadie mute el estado guardado por referencia. */
export class EnMemoria<T extends { id: string }> implements RepositorioConBorrado<T> {
  private readonly datos = new Map<string, T>();

  async guardar(entidad: T): Promise<void> {
    this.datos.set(entidad.id, structuredClone(entidad));
  }

  async buscarPorId(id: string): Promise<T | undefined> {
    const e = this.datos.get(id);
    return e === undefined ? undefined : structuredClone(e);
  }

  async listar(filtro: (entidad: T) => boolean = () => true): Promise<T[]> {
    return [...this.datos.values()].filter(filtro).map((e) => structuredClone(e));
  }

  async existe(id: string): Promise<boolean> {
    return this.datos.has(id);
  }

  async borrar(id: string): Promise<void> {
    this.datos.delete(id);
  }
}

/** Expone solo agregar y listar: no hay forma de editar ni borrar. */
export function appendOnlyEnMemoria<T>(): RepositorioAppendOnly<T> {
  const datos: T[] = [];
  return {
    async agregar(entidad) {
      datos.push(structuredClone(entidad));
    },
    async listar(filtro = () => true) {
      return datos.filter(filtro).map((e) => structuredClone(e));
    },
  };
}

/** Un juego de repositorios nuevo por instancia: los tests no comparten estado. */
export function crearRepositoriosEnMemoria({ seed = true }: { seed?: boolean } = {}): Repositorios {
  const repos: Repositorios = {
    usuarios: new EnMemoria(),
    profesionales: new EnMemoria(),
    boxes: new EnMemoria(),
    prestaciones: new EnMemoria(),
    horarios: new EnMemoria(),
    bloqueos: new EnMemoria(),
    pacientes: new EnMemoria(),
    turnos: new EnMemoria(),
    odontogramas: new EnMemoria(),
    auditoria: appendOnlyEnMemoria(),
    historiaClinica: appendOnlyEnMemoria(),
    estadosPieza: appendOnlyEnMemoria(),
  };
  if (seed) cargarSeed(repos);
  return repos;
}
