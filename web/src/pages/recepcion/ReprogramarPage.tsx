import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ErrorApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio, BadgeEstadoTurno, Boton, EstadoVacio, SkeletonTarjetas } from '../../base/components';
import { obtenerAgenda, reprogramarTurno, type Hueco, type TurnoAgenda } from './api';
import { aErrorApi, esSolapamiento, nombrePorId, useCatalogos } from './comun';
import { etiquetaDia, fechaEnZona, horaEnZona, rangoDia } from './dominio';
import { ITEMS_RECEPCION } from './menu';
import { SelectorHuecos } from './SelectorHuecos';
import './recepcion.css';

function turnoDelEstado(estado: unknown, id: string | undefined): TurnoAgenda | null {
  if (typeof estado !== 'object' || estado === null || !('turno' in estado)) return null;
  const t: unknown = estado.turno;
  return typeof t === 'object' && t !== null && 'id' in t && t.id === id ? (t as TurnoAgenda) : null;
}

/**
 * Box a enviar. "Automático" conserva el box actual si está libre en el hueco; si no, toma el
 * primero libre: C-10 conserva el box cuando no se manda, y eso daría SOLAPAMIENTO_BOX.
 */
function boxParaEnviar(turno: TurnoAgenda, hueco: Hueco, elegido: string | null): string | undefined {
  if (elegido) return elegido;
  return hueco.boxIds.includes(turno.boxId) ? undefined : hueco.boxIds[0];
}

/** Reprogramar eligiendo un hueco libre (spec, mockup reprogramar.html). */
export function ReprogramarPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profesionales, boxes } = useCatalogos();

  const [turno, setTurno] = useState<TurnoAgenda | null>(() => turnoDelEstado(location.state, id));
  const [buscando, setBuscando] = useState(turno === null);
  const [profesionalId, setProfesionalId] = useState(turno?.profesionalId ?? '');
  const [fecha, setFecha] = useState(turno ? fechaEnZona(turno.inicio) : (params.get('fecha') ?? fechaEnZona(new Date())));
  const [hueco, setHueco] = useState<Hueco | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  // Sin el turno en el estado de navegación (p. ej., al recargar), se busca en la agenda de ese día.
  useEffect(() => {
    if (turno !== null) return undefined;
    let vigente = true;
    obtenerAgenda(rangoDia(params.get('fecha') ?? fechaEnZona(new Date())))
      .then((lista) => {
        if (!vigente) return;
        const encontrado = lista.find((t) => t.id === id) ?? null;
        setTurno(encontrado);
        if (encontrado) {
          setProfesionalId(encontrado.profesionalId);
          setFecha(fechaEnZona(encontrado.inicio));
        }
      })
      .catch((e: unknown) => vigente && setError(aErrorApi(e)))
      .finally(() => vigente && setBuscando(false));
    return () => {
      vigente = false;
    };
  }, [turno, id, params]);

  const volver = (dia: string) => navigate(`/recepcion/agenda?fecha=${dia}`);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!turno || !hueco) return;
    const box = boxParaEnviar(turno, hueco, boxId);
    setEnviando(true);
    setError(null);
    try {
      await reprogramarTurno(turno.id, {
        inicio: hueco.inicio,
        ...(hueco.profesionalId !== turno.profesionalId ? { profesionalId: hueco.profesionalId } : {}),
        ...(box ? { boxId: box } : {}),
      });
      volver(fechaEnZona(hueco.inicio));
    } catch (err: unknown) {
      const apiError = aErrorApi(err);
      setError(apiError);
      if (esSolapamiento(apiError)) setRecarga((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  };

  const layout = (contenido: React.ReactNode) => (
    <AppLayout titulo="Reprogramar turno" subtitulo="Elegí un hueco libre para mover el turno." itemsExtra={ITEMS_RECEPCION}>
      {contenido}
    </AppLayout>
  );

  if (buscando) return layout(<SkeletonTarjetas cantidad={2} />);
  if (!turno) {
    return layout(
      <>
        {error ? <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} /> : null}
        <EstadoVacio
          titulo="No encontramos el turno"
          descripcion="Volvé a la agenda y elegí Reprogramar desde el turno."
          accion={<Boton onClick={() => volver(fecha)}>Ir a la agenda</Boton>}
        />
      </>,
    );
  }

  const nombresProfesional = nombrePorId(profesionales);
  const nombresBox = nombrePorId(boxes);
  const paciente = `${turno.paciente.nombre} ${turno.paciente.apellido}`;
  const boxNuevo = hueco ? boxParaEnviar(turno, hueco, boxId) : undefined;

  return layout(
    <form onSubmit={confirmar} className="rc-pila" style={{ maxWidth: '52rem' }} noValidate>
      {error ? <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} detalles={error.detalles} /> : null}

      <section className="rc-card" aria-label="Turno actual">
        <div className="rc-turno__fila">
          <div>
            <strong>{paciente}</strong>
            <div className="rc-hint" style={{ margin: 0 }}>{`${turno.prestacion.nombre} · ${turno.prestacion.duracionMin} min`}</div>
          </div>
          <BadgeEstadoTurno estado={turno.estado} />
        </div>
        <div className="rc-comparar">
          <div className="rc-cuando">
            <small>Ahora</small>
            <strong>{`${etiquetaDia(fechaEnZona(turno.inicio))} · ${horaEnZona(turno.inicio)}`}</strong>
            <span>{`${horaEnZona(turno.inicio)}–${horaEnZona(turno.fin)} · ${turno.profesional.nombre} · ${turno.box.nombre}`}</span>
          </div>
          <div className="rc-flecha" aria-hidden="true">→</div>
          <div className="rc-cuando rc-cuando--nuevo">
            <small>Nuevo horario</small>
            {hueco ? (
              <>
                <strong>{`${etiquetaDia(fechaEnZona(hueco.inicio))} · ${horaEnZona(hueco.inicio)}`}</strong>
                <span>{`${horaEnZona(hueco.inicio)}–${horaEnZona(hueco.fin)} · ${nombresProfesional.get(hueco.profesionalId) ?? ''} · ${boxNuevo ? (nombresBox.get(boxNuevo) ?? boxNuevo) : turno.box.nombre}`}</span>
              </>
            ) : (
              <span>Elegí un hueco libre</span>
            )}
          </div>
        </div>
        <p className="rc-nota" style={{ margin: 0 }}>
          Al reprogramar, el turno vuelve a <strong>Reservado</strong> (hay que confirmarlo de nuevo) y el paciente recibe un email con el nuevo horario.
        </p>
      </section>

      <section className="rc-card" aria-labelledby="rc-nuevo-hueco">
        <h2 id="rc-nuevo-hueco">Nuevo hueco</h2>
        <p className="rc-hint">{`Huecos libres para ${turno.prestacion.nombre}. Podés cambiar de profesional.`}</p>
        <div className="rc-grid-2" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="rc-field">
            <label htmlFor="rc-re-profesional">Profesional</label>
            <select id="rc-re-profesional" className="rc-select" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}>
              {profesionales.length === 0 ? <option value={turno.profesionalId}>{turno.profesional.nombre}</option> : null}
              {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="rc-field">
            <label htmlFor="rc-re-dia">Día</label>
            <input id="rc-re-dia" className="rc-input" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          </div>
        </div>
        <SelectorHuecos
          prestacionId={turno.prestacionId}
          profesionalId={profesionalId}
          fecha={fecha}
          onCambiarFecha={setFecha}
          recarga={recarga}
          elegido={hueco}
          onElegir={setHueco}
          boxElegido={boxId}
          onElegirBox={setBoxId}
          nombresBox={nombresBox}
          nombresProfesional={nombresProfesional}
        />
      </section>

      <div className="rc-acciones">
        <Boton variante="secundario" onClick={() => volver(fechaEnZona(turno.inicio))}>Volver</Boton>
        <Boton type="submit" disabled={!hueco || enviando} cargando={enviando} textoCargando="Reprogramando…">
          {hueco ? `Reprogramar a las ${horaEnZona(hueco.inicio)}` : 'Elegí un hueco'}
        </Boton>
      </div>
    </form>,
  );
}
