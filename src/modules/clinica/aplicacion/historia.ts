import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import type { EntradaHistoriaClinica } from '../../../shared/entidades';
import { ReglaDeNegocioError, SinPermisoError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import type { UsuarioSesion } from '../../../shared/sesion';
import { ordenarCronologicamente } from '../dominio/proyeccion';

export interface DepsHistoria {
  repos: Repositorios;
  clock: Clock;
  generarId?: () => string;
}

export interface NuevaEntradaHistoria {
  texto: string;
  turnoId?: string;
  corrigeAId?: string;
}

export async function listarHistoriaClinica(
  repos: Repositorios,
  pacienteId: string,
): Promise<EntradaHistoriaClinica[]> {
  if (!(await repos.pacientes.existe(pacienteId))) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }
  const entradas = await repos.historiaClinica.listar((e) => e.pacienteId === pacienteId);
  return ordenarCronologicamente(entradas);
}

export async function agregarEntradaHistoria(
  deps: DepsHistoria,
  sesion: UsuarioSesion,
  pacienteId: string,
  entrada: NuevaEntradaHistoria,
): Promise<EntradaHistoriaClinica> {
  if (sesion.rol !== 'profesional' || !sesion.profesionalId) {
    throw new SinPermisoError();
  }
  if (!(await deps.repos.pacientes.existe(pacienteId))) {
    throw new ReglaDeNegocioError('NO_ENCONTRADO');
  }

  if (entrada.turnoId !== undefined) {
    const turno = await deps.repos.turnos.buscarPorId(entrada.turnoId);
    if (!turno || turno.pacienteId !== pacienteId) {
      throw new ReglaDeNegocioError('NO_ENCONTRADO');
    }
  }

  if (entrada.corrigeAId !== undefined) {
    const previas = await deps.repos.historiaClinica.listar(
      (e) => e.id === entrada.corrigeAId && e.pacienteId === pacienteId,
    );
    if (previas.length === 0) {
      throw new ReglaDeNegocioError('NO_ENCONTRADO');
    }
  }

  const registro: EntradaHistoriaClinica = {
    id: (deps.generarId ?? randomUUID)(),
    pacienteId,
    profesionalId: sesion.profesionalId,
    fecha: deps.clock.ahora(),
    texto: entrada.texto.trim(),
    ...(entrada.turnoId === undefined ? {} : { turnoId: entrada.turnoId }),
    ...(entrada.corrigeAId === undefined ? {} : { corrigeAId: entrada.corrigeAId }),
  };

  await deps.repos.historiaClinica.agregar(registro);
  return registro;
}
