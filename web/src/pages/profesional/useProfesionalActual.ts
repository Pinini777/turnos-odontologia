import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../../base/api';
import { useSesion } from '../../base/sesion';
import { listarProfesionales, type ProfesionalApi } from './apiProfesional';

export interface EstadoProfesionalActual {
  readonly profesional: ProfesionalApi | null;
  readonly profesionales: readonly ProfesionalApi[];
  readonly cargando: boolean;
  readonly error: ErrorApi | null;
  readonly recargar: () => void;
}

export function useProfesionalActual(): EstadoProfesionalActual {
  const { sesion } = useSesion();
  const [profesionales, setProfesionales] = useState<readonly ProfesionalApi[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [version, setVersion] = useState<number>(0);

  const recargar = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!sesion || sesion.usuario.rol !== 'profesional') {
      setProfesionales([]);
      setCargando(false);
      setError(null);
      return;
    }

    let activo = true;
    setCargando(true);
    setError(null);

    listarProfesionales()
      .then((lista) => {
        if (!activo) return;
        setProfesionales(lista);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [sesion, version]);

  const profesional =
    sesion && sesion.usuario.rol === 'profesional'
      ? (profesionales.find((p) => p.usuarioId === sesion.usuario.id) ?? null)
      : null;

  return { profesional, profesionales, cargando, error, recargar };
}
