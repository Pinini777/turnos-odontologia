import { SinPermisoError } from '../../../shared/errores';
import type { Deps } from '../../../shared/puertos';
import type { UsuarioSesion } from '../../../shared/sesion';
import { sumarGanancias } from '../dominio/ganancias';

/** Lectura pura: no hay "ahora", no hay escritura y no hay estado que proteger (D10). */
export type DepsGanancias = Pick<Deps, 'repos'>;

export interface CalcularGanancias {
  sesion: UsuarioSesion;
  profesionalId: string;
  desde: Date;
  hasta: Date;
}

/** Ganancias del profesional en el período `[desde, hasta)`, recalculadas en cada consulta (RN-GA-03). */
export async function calcularGanancias(
  { sesion, profesionalId, desde, hasta }: CalcularGanancias,
  { repos }: DepsGanancias,
): Promise<number> {
  // Propiedad primero (D6, D7): un id ajeno o inexistente da 403 sin consultar si existe.
  if (sesion.profesionalId !== profesionalId) throw new SinPermisoError();

  const turnos = await repos.turnos.listar((turno) => turno.profesionalId === profesionalId);
  return sumarGanancias(turnos, { desde, hasta });
}
