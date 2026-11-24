import type { KeyboardEvent } from 'react';
import type { CaraPiezaApi, EstadoDePiezaApi, EstadoPiezaApi } from './apiProfesional';
import {
  agruparEstadosPorPieza,
  CUADRANTES_PERMANENTES,
  CUADRANTES_TEMPORARIOS,
  ETIQUETA_ESTADO_PIEZA,
  mapearCarasFdi,
  nombreAnatomicoFdi,
  type EstadoVisualPieza,
} from './odontogramaFdi';
import type { TipoDenticion } from './odontogramaHistorial';

export interface PropsOdontogramaFdi {
  readonly piezas: readonly EstadoPiezaApi[];
  readonly piezaSeleccionada: number;
  readonly caraSeleccionada: CaraPiezaApi | '';
  readonly mostrarTemporaria: boolean;
  readonly onToggleTemporaria: (visible: boolean) => void;
  readonly onSeleccionar: (pieza: number, cara: CaraPiezaApi) => void;
  readonly denticion?: TipoDenticion;
  readonly embebido?: boolean;
  readonly piezasDestacadas?: ReadonlySet<number>;
}

function fillPorEstado(estado: EstadoDePiezaApi): string {
  if (estado === 'caries') return 'url(#prof-pat-caries)';
  if (estado === 'obturado') return '#2563EB';
  return '#FFFFFF';
}

function OverlayPiezaCompleta({ estado }: { readonly estado: EstadoDePiezaApi | undefined }) {
  if (estado === 'ausente') {
    return (
      <g aria-hidden="true" data-overlay="ausente" pointerEvents="none">
        <rect x="3" y="3" width="38" height="38" rx="4" fill="rgba(241,245,249,0.72)" />
        <path
          d="M8 8L36 36M36 8L8 36"
          stroke="#64748B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (estado === 'a_extraer') {
    return (
      <g aria-hidden="true" data-overlay="a_extraer" pointerEvents="none">
        <rect x="3" y="3" width="38" height="38" rx="4" fill="rgba(254,242,242,0.58)" />
        <path
          d="M7 7L37 37M37 7L7 37"
          stroke="#B91C1C"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (estado === 'corona') {
    return (
      <g aria-hidden="true" data-overlay="corona" pointerEvents="none">
        <circle cx="22" cy="22" r="17.5" fill="none" stroke="#0E7490" strokeWidth="2.6" />
        <circle
          cx="22"
          cy="22"
          r="13.2"
          fill="none"
          stroke="#B45309"
          strokeWidth="1.6"
          strokeDasharray="3 2"
        />
      </g>
    );
  }
  if (estado === 'endodoncia') {
    return (
      <g aria-hidden="true" data-overlay="endodoncia" pointerEvents="none">
        <polygon
          points="22,6 34,35 10,35"
          fill="rgba(67,56,202,0.14)"
          stroke="#4338CA"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return null;
}

interface PropsPiezaSvg {
  readonly pieza: number;
  readonly numeroArriba: boolean;
  readonly estadoVisual: EstadoVisualPieza | undefined;
  readonly seleccionada: boolean;
  readonly destacada: boolean;
  readonly caraSeleccionada: CaraPiezaApi | '';
  readonly onSeleccionar: (pieza: number, cara: CaraPiezaApi) => void;
}

function PiezaFdiSvg({
  pieza,
  numeroArriba,
  estadoVisual,
  seleccionada,
  destacada,
  caraSeleccionada,
  onSeleccionar,
}: PropsPiezaSvg) {
  const mapaCaras = mapearCarasFdi(pieza);
  const nombreAnat = nombreAnatomicoFdi(pieza);
  const completa = estadoVisual?.completa;
  const caras = estadoVisual?.caras ?? {};

  const zonas: readonly {
    readonly posicion: 'top' | 'bottom' | 'left' | 'right' | 'center';
    readonly cara: CaraPiezaApi;
    readonly points?: string;
  }[] = [
    { posicion: 'top', cara: mapaCaras.top, points: '3,3 41,3 31,13 13,13' },
    { posicion: 'bottom', cara: mapaCaras.bottom, points: '13,31 31,31 41,41 3,41' },
    { posicion: 'left', cara: mapaCaras.left, points: '3,3 13,13 13,31 3,41' },
    { posicion: 'right', cara: mapaCaras.right, points: '31,13 41,3 41,41 31,31' },
    { posicion: 'center', cara: mapaCaras.center },
  ];

  function manejarTeclado(e: KeyboardEvent<SVGElement>, cara: CaraPiezaApi): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar(pieza, cara);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const tablero = e.currentTarget.closest('.prof-odo-board');
      if (!tablero) return;
      const zonasTablero = Array.from(tablero.querySelectorAll<SVGElement>('.prof-face-zone'));
      const idx = zonasTablero.indexOf(e.currentTarget);
      if (idx === -1) return;
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const siguiente = zonasTablero[(idx + delta + zonasTablero.length) % zonasTablero.length];
      siguiente?.focus();
    }
  }

  const numeroEl = <span className="prof-tooth__num">{pieza}</span>;

  const svgEl = (
    <svg
      className="prof-tooth__svg"
      viewBox="0 0 44 44"
      aria-label={`Pieza dental FDI ${pieza} (${nombreAnat})`}
      data-pieza={pieza}
    >
      {zonas.map((z) => {
        const estadoCara = completa ?? caras[z.cara] ?? 'sano';
        const esActiva = seleccionada && caraSeleccionada === z.cara;
        const ariaLabel = `Pieza ${pieza} (${nombreAnat}), cara ${z.cara} — ${ETIQUETA_ESTADO_PIEZA[estadoCara]}`;
        const fill = completa ? '#FFFFFF' : fillPorEstado(estadoCara);
        const className = ['prof-face-zone', esActiva ? 'prof-face-zone--selected' : '']
          .filter(Boolean)
          .join(' ');

        if (z.posicion === 'center') {
          return (
            <rect
              key={z.cara}
              x="13"
              y="13"
              width="18"
              height="18"
              fill={fill}
              className={className}
              role="button"
              tabIndex={0}
              data-pieza={pieza}
              data-cara={z.cara}
              data-posicion={z.posicion}
              aria-label={ariaLabel}
              aria-pressed={esActiva}
              onClick={() => onSeleccionar(pieza, z.cara)}
              onKeyDown={(e) => manejarTeclado(e, z.cara)}
            />
          );
        }

        return (
          <polygon
            key={z.cara}
            points={z.points}
            fill={fill}
            className={className}
            role="button"
            tabIndex={0}
            data-pieza={pieza}
            data-cara={z.cara}
            data-posicion={z.posicion}
            aria-label={ariaLabel}
            aria-pressed={esActiva}
            onClick={() => onSeleccionar(pieza, z.cara)}
            onKeyDown={(e) => manejarTeclado(e, z.cara)}
          />
        );
      })}
      <OverlayPiezaCompleta estado={completa} />
    </svg>
  );

  return (
    <div
      className={[
        'prof-tooth',
        seleccionada ? 'prof-tooth--selected' : '',
        destacada ? 'prof-tooth--flash' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-tooth-fdi={pieza}
    >
      {numeroArriba ? (
        <>
          {numeroEl}
          {svgEl}
        </>
      ) : (
        <>
          {svgEl}
          {numeroEl}
        </>
      )}
    </div>
  );
}

export function OdontogramaFdi({
  piezas,
  piezaSeleccionada,
  caraSeleccionada,
  mostrarTemporaria,
  onToggleTemporaria,
  onSeleccionar,
  denticion,
  embebido = false,
  piezasDestacadas,
}: PropsOdontogramaFdi) {
  const mapaEstados = agruparEstadosPorPieza(piezas);
  const denticionEfectiva: TipoDenticion = denticion ?? (mostrarTemporaria ? 'mixta' : 'permanente');
  const verPermanentes = denticionEfectiva !== 'temporaria';
  const verTemporarias = denticionEfectiva !== 'permanente';

  function renderCuadrante(
    lista: readonly number[],
    numeroArriba: boolean,
    claseExtra = '',
  ) {
    return (
      <div className={['prof-odo-quad', claseExtra].filter(Boolean).join(' ')}>
        {lista.map((p) => (
          <PiezaFdiSvg
            key={p}
            pieza={p}
            numeroArriba={numeroArriba}
            estadoVisual={mapaEstados.get(p)}
            seleccionada={piezaSeleccionada === p}
            destacada={Boolean(piezasDestacadas?.has(p))}
            caraSeleccionada={caraSeleccionada}
            onSeleccionar={onSeleccionar}
          />
        ))}
      </div>
    );
  }

  const contenido = (
    <>
      {!embebido ? (
        <div className="prof-card__head">
          <div>
            <h2 className="prof-card__titulo">Odontograma FDI</h2>
            <p className="prof-card__sub">
              Seleccioná una cara o pieza para actualizar su estado clínico.
            </p>
          </div>
          <label className="prof-check">
            <input
              type="checkbox"
              checked={mostrarTemporaria}
              onChange={(e) => onToggleTemporaria(e.target.checked)}
            />
            <span>Mostrar dentición temporaria (51–85)</span>
          </label>
        </div>
      ) : null}

      {/* Patrón SVG accesible (WCAG 1.4.1: color + trama) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <pattern
            id="prof-pat-caries"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#FEE2E2" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#DC2626" strokeWidth="2.4" />
          </pattern>
        </defs>
      </svg>

      <div className="prof-odo-legend" aria-label="Leyenda de estados dentales">
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#FFFFFF" stroke="#64748B" strokeWidth="1.3" />
          </svg>
          Sano
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#FCA5A5" stroke="#B91C1C" strokeWidth="1.3" />
            <path d="M2 14L14 2M2 8L8 2M8 14L14 8" stroke="#B91C1C" strokeWidth="1.2" />
          </svg>
          Caries
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#2563EB" stroke="#1E40AF" strokeWidth="1.3" />
          </svg>
          Obturado
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="#0E7490" strokeWidth="2" />
            <circle cx="8" cy="8" r="3.2" fill="none" stroke="#B45309" strokeWidth="1.4" />
          </svg>
          Corona
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="8,2 13,13 3,13" fill="none" stroke="#4338CA" strokeWidth="1.8" />
          </svg>
          Endodoncia
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Ausente
        </span>
        <span className="prof-odo-legend__item">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="#B91C1C" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          A extraer
        </span>
      </div>

      <div className="prof-odo-board" aria-label="Grilla interactiva de piezas dentales FDI">
        {verPermanentes ? (
          <div className="prof-odo-arch">
            <div className="prof-odo-quad-block">
              <span className="prof-odo-quad-label">Cuadrante 1 · Sup. derecho (18–11)</span>
              {renderCuadrante(CUADRANTES_PERMANENTES.q1, true)}
            </div>
            <div className="prof-odo-midline-v" aria-hidden="true" />
            <div className="prof-odo-quad-block">
              <span className="prof-odo-quad-label prof-odo-quad-label--right">
                Cuadrante 2 · Sup. izquierdo (21–28)
              </span>
              {renderCuadrante(CUADRANTES_PERMANENTES.q2, true)}
            </div>
          </div>
        ) : null}

        {verTemporarias ? (
          <div>
            <div className="prof-odo-temp-title">Dentición temporaria superior (55–51 | 61–65)</div>
            <div className="prof-odo-arch">
              <div className="prof-odo-quad-block">
                {renderCuadrante(CUADRANTES_TEMPORARIOS.q5, true, 'prof-odo-quad--temp prof-odo-quad--temp-left')}
              </div>
              <div className="prof-odo-midline-v" aria-hidden="true" />
              <div className="prof-odo-quad-block">
                {renderCuadrante(CUADRANTES_TEMPORARIOS.q6, true, 'prof-odo-quad--temp prof-odo-quad--temp-right')}
              </div>
            </div>
          </div>
        ) : null}

        <hr className="prof-odo-midline-h" />

        {verTemporarias ? (
          <div>
            <div className="prof-odo-temp-title">Dentición temporaria inferior (85–81 | 71–75)</div>
            <div className="prof-odo-arch">
              <div className="prof-odo-quad-block">
                {renderCuadrante(CUADRANTES_TEMPORARIOS.q8, false, 'prof-odo-quad--temp prof-odo-quad--temp-left')}
              </div>
              <div className="prof-odo-midline-v" aria-hidden="true" />
              <div className="prof-odo-quad-block">
                {renderCuadrante(CUADRANTES_TEMPORARIOS.q7, false, 'prof-odo-quad--temp prof-odo-quad--temp-right')}
              </div>
            </div>
          </div>
        ) : null}

        {verPermanentes ? (
          <div className="prof-odo-arch">
            <div className="prof-odo-quad-block">
              <span className="prof-odo-quad-label">Cuadrante 4 · Inf. derecho (48–41)</span>
              {renderCuadrante(CUADRANTES_PERMANENTES.q4, false)}
            </div>
            <div className="prof-odo-midline-v" aria-hidden="true" />
            <div className="prof-odo-quad-block">
              <span className="prof-odo-quad-label prof-odo-quad-label--right">
                Cuadrante 3 · Inf. izquierdo (31–38)
              </span>
              {renderCuadrante(CUADRANTES_PERMANENTES.q3, false)}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  if (embebido) {
    return <div className="prof-odo-map-wrap">{contenido}</div>;
  }

  return <div className="prof-card">{contenido}</div>;
}
