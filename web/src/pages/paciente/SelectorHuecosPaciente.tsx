import { useEffect, useState } from 'react';
import type { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, Skeleton } from '../../base/components';
import {
  aErrorApi,
  consultarDisponibilidadPublica,
  type HuecoDisponibleApi,
} from './apiPaciente';
import {
  etiquetaProfesional,
  horaEnZona,
  rangoDiaConsultorio,
  separarMananaTarde,
  sumarDiasIso,
} from './dominio';

export interface PropsSelectorHuecosPaciente {
  readonly prestacionId: string;
  /** Vacío = cualquier profesional disponible. */
  readonly profesionalId: string;
  readonly fecha: string;
  readonly onCambiarFecha: (nuevaFecha: string) => void;
  /** Incrementar este contador vuelve a consultar los huecos libres (p. ej. tras un 409). */
  readonly recarga: number;
  readonly elegido: HuecoDisponibleApi | null;
  readonly onElegir: (hueco: HuecoDisponibleApi | null) => void;
}

function esMismoHueco(a: HuecoDisponibleApi | null, b: HuecoDisponibleApi): boolean {
  return a !== null && a.inicio === b.inicio && a.profesionalId === b.profesionalId;
}

export function SelectorHuecosPaciente({
  prestacionId,
  profesionalId,
  fecha,
  onCambiarFecha,
  recarga,
  elegido,
  onElegir,
}: PropsSelectorHuecosPaciente) {
  const [huecos, setHuecos] = useState<HuecoDisponibleApi[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  useEffect(() => {
    if (!prestacionId || !fecha) return undefined;
    let vigente = true;
    setHuecos(null);
    setError(null);
    onElegir(null);

    consultarDisponibilidadPublica({
      prestacionId,
      ...rangoDiaConsultorio(fecha),
      ...(profesionalId ? { profesionalId } : {}),
    })
      .then((lista) => {
        if (vigente) setHuecos(lista);
      })
      .catch((err: unknown) => {
        if (vigente) setError(aErrorApi(err));
      });

    return () => {
      vigente = false;
    };
    // onElegir se omite intencionalmente para no disparar consultas duplicadas en cada render.
  }, [prestacionId, profesionalId, fecha, recarga]);

  if (!prestacionId) {
    return <p className="pa-card__sub">Elegí primero una prestación para ver los horarios libres.</p>;
  }

  if (error) {
    return <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} />;
  }

  if (huecos === null) {
    return (
      <div className="pa-stack" aria-label="Cargando horarios disponibles">
        <Skeleton alto="2.5rem" />
        <Skeleton alto="2.5rem" />
      </div>
    );
  }

  if (huecos.length === 0) {
    return (
      <div className="pa-sin-huecos" role="status" aria-live="polite">
        <p>No hay horarios disponibles para esta fecha. Podés probar otro día.</p>
        <Boton
          variante="secundario"
          onClick={() => onCambiarFecha(sumarDiasIso(fecha, 1))}
        >
          Probar el día siguiente
        </Boton>
      </div>
    );
  }

  const { manana, tarde } = separarMananaTarde(huecos);

  const renderGrupo = (titulo: string, lista: readonly HuecoDisponibleApi[]) => {
    if (lista.length === 0) return null;
    return (
      <div className="pa-huecos-grupo">
        <p className="pa-huecos-grupo__titulo">{titulo}</p>
        <div className="pa-slots" role="group" aria-label={`Horarios de la ${titulo.toLowerCase()}`}>
          {lista.map((h) => {
            const hora = horaEnZona(h.inicio);
            const etiqueta = profesionalId
              ? hora
              : `${hora} · ${etiquetaProfesional(h.profesionalId)}`;
            return (
              <button
                key={`${h.inicio}-${h.profesionalId}`}
                type="button"
                className="pa-slot"
                aria-pressed={esMismoHueco(elegido, h)}
                onClick={() => onElegir(h)}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderGrupo('Mañana', manana)}
      {renderGrupo('Tarde', tarde)}
    </div>
  );
}
