import { useEffect, useState } from 'react';
import type { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, Skeleton } from '../../base/components';
import { obtenerHuecos, type Hueco } from './api';
import { aErrorApi } from './comun';
import { horaEnZona, rangoDia, separarMananaTarde, sumarDias } from './dominio';

export interface PropsSelectorHuecos {
  readonly prestacionId: string;
  /** Vacío = cualquier profesional. */
  readonly profesionalId: string;
  readonly fecha: string;
  readonly onCambiarFecha: (fecha: string) => void;
  /** Cambiarlo vuelve a pedir los huecos (por ejemplo, después de un 409). */
  readonly recarga: number;
  readonly elegido: Hueco | null;
  readonly onElegir: (hueco: Hueco | null) => void;
  /** null = "Automático". */
  readonly boxElegido: string | null;
  readonly onElegirBox: (boxId: string | null) => void;
  readonly nombresBox: ReadonlyMap<string, string>;
  readonly nombresProfesional: ReadonlyMap<string, string>;
}

const mismoHueco = (a: Hueco | null, b: Hueco) => a !== null && a.inicio === b.inicio && a.profesionalId === b.profesionalId;

/** Huecos libres de un día (design D3), agrupados en mañana y tarde, con la elección de box. */
export function SelectorHuecos(props: PropsSelectorHuecos) {
  const { prestacionId, profesionalId, fecha, recarga, elegido, onElegir, boxElegido, onElegirBox } = props;
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  useEffect(() => {
    if (!prestacionId) return undefined;
    let vigente = true;
    setHuecos(null);
    setError(null);
    onElegir(null);
    obtenerHuecos({ prestacionId, ...rangoDia(fecha), ...(profesionalId ? { profesionalId } : {}) })
      .then((lista) => vigente && setHuecos(lista))
      .catch((e: unknown) => vigente && setError(aErrorApi(e)));
    return () => {
      vigente = false;
    };
    // onElegir no va en las dependencias: el padre lo recrea en cada render y repetiría el pedido.
  }, [prestacionId, profesionalId, fecha, recarga]);

  if (!prestacionId) return <p className="rc-hint">Elegí una prestación para ver los huecos libres.</p>;
  if (error) return <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} />;
  if (huecos === null) return <Skeleton alto="6rem" />;
  if (huecos.length === 0) {
    return (
      <div>
        <p className="rc-hint">No hay huecos libres para ese día.</p>
        <Boton variante="secundario" onClick={() => props.onCambiarFecha(sumarDias(fecha, 1))}>Probar el día siguiente</Boton>
      </div>
    );
  }

  const { manana, tarde } = separarMananaTarde(huecos);
  const etiqueta = (h: Hueco) => {
    const hora = horaEnZona(h.inicio);
    return profesionalId ? hora : `${hora} · ${props.nombresProfesional.get(h.profesionalId) ?? 'Profesional'}`;
  };
  const grupo = (titulo: string, lista: readonly Hueco[]) =>
    lista.length === 0 ? null : (
      <div className="rc-huecos__grupo">
        <p className="rc-huecos__etiqueta">{titulo}</p>
        <div className="rc-slots" role="group" aria-label={`Huecos de la ${titulo.toLowerCase()}`}>
          {lista.map((h) => (
            <button
              key={`${h.inicio}-${h.profesionalId}`}
              type="button"
              className="rc-slot"
              aria-pressed={mismoHueco(elegido, h)}
              onClick={() => {
                onElegir(h);
                onElegirBox(null);
              }}
            >
              {etiqueta(h)}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      {grupo('Mañana', manana)}
      {grupo('Tarde', tarde)}
      {elegido ? (
        <div className="rc-field" style={{ marginTop: 'var(--space-5)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>Box</span>
          <div className="rc-chips" role="group" aria-label="Box">
            <button type="button" className="rc-chip" aria-pressed={boxElegido === null} onClick={() => onElegirBox(null)}>Automático</button>
            {elegido.boxIds.map((id) => (
              <button key={id} type="button" className="rc-chip" aria-pressed={boxElegido === id} onClick={() => onElegirBox(id)}>
                {props.nombresBox.get(id) ?? id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
