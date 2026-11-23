import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import type {
  CaraPieza,
  EstadoDePieza,
  EstadoPieza,
  Odontograma,
} from '../../../shared/entidades';
import { ReglaDeNegocioError, SinPermisoError } from '../../../shared/errores';
import type { ConLockDeAgenda } from '../../../shared/lock';
import type { Repositorios } from '../../../shared/repositorios';
import type { UsuarioSesion } from '../../../shared/sesion';
import { ordenarCronologicamente, proyectarEstadoActual } from '../dominio/proyeccion';

export interface VistaOdontograma {
  odontogramaId: string | null;
  pacienteId: string;
  actualizadoEn: Date | null;
  piezas: EstadoPieza[];
  historial: EstadoPieza[];
}

export interface DepsOdontograma {
  repos: Repositorios;
  clock: Clock;
  conLockDeAgenda: ConLockDeAgenda;
  generarId?: () => string;
}

export interface ItemActualizacionPieza {
  pieza: number;
  cara?: CaraPieza;
  estado: EstadoDePieza;
}

export interface EntradaActualizacionOdontograma {
  piezas: readonly ItemActualizacionPieza[];
}

async function armarVista(
  repos: Repositorios,
  odontograma: Odontograma,
): Promise<VistaOdontograma> {
  const registros = await repos.estadosPieza.listar((e) => e.odontogramaId === odontograma.id);
  const historial = ordenarCronologicamente(registros);
  return {
    odontogramaId: odontograma.id,
    pacienteId: odontograma.pacienteId,
    actualizadoEn: odontograma.actualizadoEn,
    piezas: proyectarEstadoActual(historial),
    historial,
  };
}

export async function obtenerOdontograma(
  repos: Repositorios,
  pacienteId: string,
): Promise<VistaOdontograma> {
  if (!(await repos.pacientes.existe(pacienteId))) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }

  const [odontograma] = await repos.odontogramas.listar((o) => o.pacienteId === pacienteId);
  if (!odontograma) {
    return {
      odontogramaId: null,
      pacienteId,
      actualizadoEn: null,
      piezas: [],
      historial: [],
    };
  }

  return armarVista(repos, odontograma);
}

export async function actualizarOdontograma(
  deps: DepsOdontograma,
  sesion: UsuarioSesion,
  pacienteId: string,
  entrada: EntradaActualizacionOdontograma,
): Promise<VistaOdontograma> {
  if (sesion.rol !== 'profesional' || !sesion.profesionalId) {
    throw new SinPermisoError();
  }
  const profesionalId = sesion.profesionalId;

  return deps.conLockDeAgenda(async () => {
    if (!(await deps.repos.pacientes.existe(pacienteId))) {
      throw new ReglaDeNegocioError('NO_ENCONTRADO');
    }

    const ahora = deps.clock.ahora();
    const generarId = deps.generarId ?? randomUUID;
    const [existente] = await deps.repos.odontogramas.listar((o) => o.pacienteId === pacienteId);
    const odontograma: Odontograma = existente
      ? { ...existente, actualizadoEn: ahora }
      : { id: generarId(), pacienteId, actualizadoEn: ahora };

    for (const item of entrada.piezas) {
      const registro: EstadoPieza = {
        id: generarId(),
        odontogramaId: odontograma.id,
        pieza: item.pieza,
        ...(item.cara === undefined ? {} : { cara: item.cara }),
        estado: item.estado,
        registradoPor: profesionalId,
        fecha: ahora,
      };
      await deps.repos.estadosPieza.agregar(registro);
    }

    await deps.repos.odontogramas.guardar(odontograma);
    return armarVista(deps.repos, odontograma);
  });
}
