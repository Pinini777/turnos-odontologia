import { useEffect, useState } from 'react';
import { ErrorApi } from '../../base/api';
import { listarBoxes, listarPrestaciones, listarProfesionales, type Box, type Prestacion, type Profesional } from './api';

/** Cualquier falla se muestra como ErrorApi, con su mensaje legible (design D6). */
export function aErrorApi(error: unknown): ErrorApi {
  return error instanceof ErrorApi ? error : new ErrorApi(0, 'ERROR_INTERNO');
}

export const esSolapamiento = (error: ErrorApi) => error.code.startsWith('SOLAPAMIENTO_');

export interface Catalogos {
  readonly profesionales: readonly Profesional[];
  readonly boxes: readonly Box[];
  readonly prestaciones: readonly Prestacion[];
  readonly cargados: boolean;
}

/** Profesionales, boxes y prestaciones activos. Si un catálogo falla, queda vacío y la pantalla sigue. */
export function useCatalogos(): Catalogos {
  const [catalogos, setCatalogos] = useState<Catalogos>({ profesionales: [], boxes: [], prestaciones: [], cargados: false });
  useEffect(() => {
    let vigente = true;
    const seguro = <T,>(promesa: Promise<T[]>) => promesa.catch((): T[] => []);
    void Promise.all([seguro(listarProfesionales()), seguro(listarBoxes()), seguro(listarPrestaciones())]).then(
      ([profesionales, boxes, prestaciones]) => {
        if (!vigente) return;
        setCatalogos({
          profesionales: profesionales.filter((p) => p.activo),
          boxes: boxes.filter((b) => b.activo),
          prestaciones: prestaciones.filter((p) => p.activa),
          cargados: true,
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, []);
  return catalogos;
}

export function nombrePorId(lista: readonly { readonly id: string; readonly nombre: string }[]): ReadonlyMap<string, string> {
  return new Map(lista.map((x) => [x.id, x.nombre]));
}
