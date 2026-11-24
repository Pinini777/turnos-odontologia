import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Boton } from '../../base/components';
import type {
  CaraPiezaApi,
  EstadoDePiezaApi,
  EstadoPiezaApi,
  ItemActualizacionPiezaPayload,
} from './apiProfesional';
import { formatearFechaHora } from './formatos';
import { OdontogramaFdi } from './OdontogramaFdiSvg';
import {
  agruparEstadosPorPieza,
  esEstadoSoloPiezaCompleta,
  ETIQUETA_ESTADO_PIEZA,
  nombreAnatomicoFdi,
} from './odontogramaFdi';
import {
  crearMotorOdontograma3d,
  type ClickArcada3d,
  type HoverPieza3d,
  type InstanciaMotor3d,
} from './odontograma3dMotor';
import {
  agregarCambioBorrador,
  aplicarBorradorSobrePiezas,
  CARAS_FDI_ORDEN,
  construirSnapshotsHistorial,
  esPiezaTemporaria,
  esPiezaVisibleEnDenticion,
  ESTADOS_CLINICOS_ORDEN,
  etiquetaCaraAnatomica,
  quitarCambioBorrador,
  SIMBOLO_ESTADO_PIEZA,
  TODAS_LAS_PIEZAS_FDI,
  type TipoDenticion,
} from './odontogramaHistorial';
import { cargarThreeCdn, soportaWebGl2 } from './threeCdn';

export interface PropsOdontograma3d {
  readonly pacienteId: string;
  readonly piezas: readonly EstadoPiezaApi[];
  readonly historial: readonly EstadoPiezaApi[];
  readonly guardando: boolean;
  readonly nombreProfesional: (id: string) => string;
  readonly onGuardarCambios: (items: readonly ItemActualizacionPiezaPayload[]) => Promise<boolean>;
  readonly onNotificar?: (mensaje: string) => void;
  readonly contenidoDebajoDiagrama?: ReactNode;
}

type ModoVista = '3d' | '2d';

function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
  }).format(fecha);
}

export function Odontograma3d({
  pacienteId,
  piezas,
  historial,
  guardando,
  nombreProfesional,
  onGuardarCambios,
  onNotificar,
  contenidoDebajoDiagrama,
}: PropsOdontograma3d) {
  const [denticion, setDenticion] = useState<TipoDenticion>('permanente');
  const [modoVista, setModoVista] = useState<ModoVista>('2d');
  const [rayosX, setRayosX] = useState<boolean>(false);
  const [enfocada, setEnfocada] = useState<boolean>(false);
  const [girandoMini, setGirandoMini] = useState<boolean>(true);
  const [movimientoReducido, setMovimientoReducido] = useState<boolean>(false);

  const [piezaSel, setPiezaSel] = useState<number>(16);
  const [caraSel, setCaraSel] = useState<CaraPiezaApi | ''>('oclusal');
  const [estadoSel, setEstadoSel] = useState<EstadoDePiezaApi>('sano');
  const [borrador, setBorrador] = useState<readonly ItemActualizacionPiezaPayload[]>([]);

  // Máquina del tiempo: null = presente; número = índice en `snapshots`
  const [indiceHistorico, setIndiceHistorico] = useState<number | null>(null);
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const [flashPiezas, setFlashPiezas] = useState<ReadonlySet<number>>(new Set());

  // Estado del motor 3D
  const [motorListo, setMotorListo] = useState<boolean>(false);
  const [mensajeFallback, setMensajeFallback] = useState<string | null>(null);
  const [hover3d, setHover3d] = useState<HoverPieza3d | null>(null);

  const canvasArcadasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAisladaRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const miniRef = useRef<HTMLDivElement | null>(null);
  const motorRef = useRef<InstanciaMotor3d | null>(null);

  // Reiniciar borrador y máquina del tiempo al cambiar de paciente
  useEffect(() => {
    setBorrador([]);
    setIndiceHistorico(null);
    setReproduciendo(false);
    setFlashPiezas(new Set());
    setEnfocada(false);
  }, [pacienteId]);

  const snapshots = useMemo(() => construirSnapshotsHistorial(historial), [historial]);
  const enPasado = indiceHistorico !== null && snapshots[indiceHistorico] !== undefined;

  const piezasPresenteConBorrador = useMemo(
    () => aplicarBorradorSobrePiezas(piezas, borrador),
    [piezas, borrador],
  );

  const piezasVisibles = useMemo(() => {
    if (enPasado && indiceHistorico !== null) {
      return snapshots[indiceHistorico]?.piezasProyectadas ?? [];
    }
    return piezasPresenteConBorrador;
  }, [enPasado, indiceHistorico, snapshots, piezasPresenteConBorrador]);

  const mapaEstadosVisibles = useMemo(
    () => agruparEstadosPorPieza(piezasVisibles),
    [piezasVisibles],
  );

  const soloPiezaCompleta = esEstadoSoloPiezaCompleta(estadoSel);
  const nombrePieza = nombreAnatomicoFdi(piezaSel);
  const cantidadPiezasVisibles = useMemo(
    () => TODAS_LAS_PIEZAS_FDI.filter((id) => esPiezaVisibleEnDenticion(id, denticion)).length,
    [denticion],
  );

  const registroPiezaActual = mapaEstadosVisibles.get(piezaSel);
  const hallazgosPiezaActual = useMemo(() => {
    const items: { readonly clave: string; readonly estado: EstadoDePiezaApi; readonly etiqueta: string }[] = [];
    if (registroPiezaActual?.completa && registroPiezaActual.completa !== 'sano') {
      items.push({
        clave: '*',
        estado: registroPiezaActual.completa,
        etiqueta: `${ETIQUETA_ESTADO_PIEZA[registroPiezaActual.completa]} · pieza completa`,
      });
    } else if (registroPiezaActual) {
      for (const cara of CARAS_FDI_ORDEN) {
        const est = registroPiezaActual.caras[cara];
        if (est && est !== 'sano') {
          items.push({
            clave: cara,
            estado: est,
            etiqueta: `${ETIQUETA_ESTADO_PIEZA[est]} · ${etiquetaCaraAnatomica(piezaSel, cara).toLowerCase()}`,
          });
        }
      }
    }
    return items;
  }, [registroPiezaActual, piezaSel]);

  const seleccionarPiezaYCara = useCallback(
    (pieza: number, cara: CaraPiezaApi) => {
      setPiezaSel(pieza);
      const registro = mapaEstadosVisibles.get(pieza);
      const estadoActual = registro?.completa ?? registro?.caras[cara] ?? 'sano';
      setEstadoSel(estadoActual);
      setCaraSel(esEstadoSoloPiezaCompleta(estadoActual) ? '' : cara);
      onNotificar?.(`Seleccionada pieza ${pieza}, cara ${etiquetaCaraAnatomica(pieza, cara).toLowerCase()}.`);
    },
    [mapaEstadosVisibles, onNotificar],
  );

  const seleccionarPiezaRef = useRef(seleccionarPiezaYCara);
  seleccionarPiezaRef.current = seleccionarPiezaYCara;

  const estadoMotorRef = useRef({
    mapaEstados: mapaEstadosVisibles,
    denticion,
    piezaSeleccionada: piezaSel,
    caraSeleccionada: soloPiezaCompleta ? ('' as const) : caraSel,
    soloPiezaCompleta,
    rayosX,
    enfocada,
    vista3dActiva: modoVista === '3d',
  });
  estadoMotorRef.current = {
    mapaEstados: mapaEstadosVisibles,
    denticion,
    piezaSeleccionada: piezaSel,
    caraSeleccionada: soloPiezaCompleta ? '' : caraSel,
    soloPiezaCompleta,
    rayosX,
    enfocada,
    vista3dActiva: modoVista === '3d',
  };

  // Inicialización progresiva del motor 3D (con fallback silencioso a 2D si falta WebGL 2 o falla la carga CDN)
  useEffect(() => {
    const canvasArcadas = canvasArcadasRef.current;
    const canvasAislada = canvasAisladaRef.current;
    const viewport = viewportRef.current;
    const mini = miniRef.current;

    if (!canvasArcadas || !canvasAislada || !viewport || !mini) return;

    if (!soportaWebGl2()) {
      setMensajeFallback('WebGL 2 no está disponible en este entorno. Usando mapa clásico FDI.');
      setMotorListo(false);
      setModoVista('2d');
      return;
    }

    const ctxArcadas = canvasArcadas.getContext('webgl2', { alpha: true, antialias: true });
    const ctxAislada = canvasAislada.getContext('webgl2', { alpha: true, antialias: true });
    if (!ctxArcadas || !ctxAislada) {
      setMensajeFallback('WebGL 2 no está disponible en este navegador. Usando mapa clásico FDI.');
      setMotorListo(false);
      setModoVista('2d');
      return;
    }

    let cancelado = false;
    let instancia: InstanciaMotor3d | null = null;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      instancia?.dispose();
      instancia = null;
      motorRef.current = null;
      setMotorListo(false);
      setEnfocada(false);
      setModoVista('2d');
      setMensajeFallback('Se interrumpió el contexto 3D. Podés continuar en el mapa clásico FDI.');
    };

    canvasArcadas.addEventListener('webglcontextlost', handleContextLost, { once: true });
    canvasAislada.addEventListener('webglcontextlost', handleContextLost, { once: true });

    cargarThreeCdn()
      .then((modulos) => {
        if (cancelado) return;
        instancia = crearMotorOdontograma3d({
          modulos,
          canvasArcadas,
          canvasAislada,
          contenedorViewport: viewport,
          contenedorMini: mini,
          contextoArcadas: ctxArcadas,
          contextoAislada: ctxAislada,
          estadoInicial: {
            ...estadoMotorRef.current,
            vista3dActiva: true,
          },
          onHover: (info) => setHover3d(info),
          onClickArcada: (click: ClickArcada3d) => {
            seleccionarPiezaRef.current(click.pieza, click.cara);
            setEnfocada(true);
            instancia?.enfocarPieza(click.pieza);
          },
          onClickAislada: (cara: CaraPiezaApi) => {
            if (!estadoMotorRef.current.soloPiezaCompleta) {
              setCaraSel(cara);
            }
          },
          onCambioMovimientoReducido: (reducido) => setMovimientoReducido(reducido),
        });
        motorRef.current = instancia;
        setMotorListo(true);
        setMensajeFallback(null);
        setModoVista('3d');
      })
      .catch(() => {
        if (cancelado) return;
        setMotorListo(false);
        setModoVista('2d');
        setMensajeFallback('No se pudo cargar la vista 3D. Podés trabajar con el mapa clásico FDI.');
      });

    return () => {
      cancelado = true;
      canvasArcadas.removeEventListener('webglcontextlost', handleContextLost);
      canvasAislada.removeEventListener('webglcontextlost', handleContextLost);
      instancia?.dispose();
      motorRef.current = null;
    };
  }, []);

  // Sincronizar estado de React con el motor 3D
  useEffect(() => {
    motorRef.current?.actualizarEstado({
      mapaEstados: mapaEstadosVisibles,
      denticion,
      piezaSeleccionada: piezaSel,
      caraSeleccionada: soloPiezaCompleta ? '' : caraSel,
      soloPiezaCompleta,
      rayosX,
      enfocada,
      vista3dActiva: modoVista === '3d',
      flashPiezas,
    });
    if (modoVista === '3d') {
      const raf = window.requestAnimationFrame(() => {
        motorRef.current?.redimensionar();
      });
      return () => window.cancelAnimationFrame(raf);
    }
    return undefined;
  }, [
    mapaEstadosVisibles,
    denticion,
    piezaSel,
    caraSel,
    soloPiezaCompleta,
    rayosX,
    enfocada,
    modoVista,
    flashPiezas,
  ]);

  // Reproducción automática de la máquina del tiempo
  useEffect(() => {
    if (!reproduciendo) return;
    if (snapshots.length <= 1) {
      setReproduciendo(false);
      return;
    }
    const timer = window.setInterval(() => {
      setIndiceHistorico((prev) => {
        const siguiente = prev === null ? 0 : prev + 1;
        const snap = snapshots[siguiente];
        if (snap) {
          setFlashPiezas(new Set(snap.piezasCambiadas));
        }
        if (siguiente >= snapshots.length - 1) {
          setReproduciendo(false);
          return snapshots.length - 1;
        }
        return siguiente;
      });
    }, 1050);
    return () => window.clearInterval(timer);
  }, [reproduciendo, snapshots]);

  function cambiarDenticion(nueva: TipoDenticion): void {
    setDenticion(nueva);
    setEnfocada(false);
    if (!esPiezaVisibleEnDenticion(piezaSel, nueva)) {
      const defecto = nueva === 'temporaria' ? 75 : 16;
      setPiezaSel(defecto);
      setCaraSel('oclusal');
    }
  }

  function cambiarEstadoClinico(nuevoEstado: EstadoDePiezaApi): void {
    setEstadoSel(nuevoEstado);
    if (esEstadoSoloPiezaCompleta(nuevoEstado)) {
      setCaraSel('');
    } else if (caraSel === '') {
      setCaraSel('oclusal');
    }
  }

  function crearItemActual(): ItemActualizacionPiezaPayload {
    return soloPiezaCompleta || caraSel === ''
      ? { pieza: piezaSel, estado: estadoSel }
      : { pieza: piezaSel, cara: caraSel, estado: estadoSel };
  }

  function handleAgregarBorrador(): void {
    if (enPasado) return;
    const item = crearItemActual();
    setBorrador((prev) => agregarCambioBorrador(prev, item));
  }

  function handleDeshacerBorrador(indice: number): void {
    setBorrador((prev) => quitarCambioBorrador(prev, indice));
  }

  async function handleSubmitOdontograma(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (enPasado || guardando) return;
    const items = borrador.length > 0 ? borrador : [crearItemActual()];
    const ok = await onGuardarCambios(items);
    if (ok) {
      setBorrador([]);
    }
  }

  function irAlSnapshot(indice: number | null): void {
    setReproduciendo(false);
    if (indice === null || indice >= snapshots.length - 1) {
      if (indice === null) {
        setIndiceHistorico(null);
        setFlashPiezas(new Set());
        return;
      }
    }
    setIndiceHistorico(indice);
    const snap = indice !== null ? snapshots[indice] : undefined;
    setFlashPiezas(new Set(snap?.piezasCambiadas ?? []));
  }

  function toggleReproduccion(): void {
    if (reproduciendo) {
      setReproduciendo(false);
      return;
    }
    if (snapshots.length <= 1) return;
    setIndiceHistorico(0);
    setFlashPiezas(new Set(snapshots[0]?.piezasCambiadas ?? []));
    setReproduciendo(true);
  }

  function handleTecladoCanvas(e: KeyboardEvent<HTMLCanvasElement>): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const opciones = TODAS_LAS_PIEZAS_FDI.filter((id) => esPiezaVisibleEnDenticion(id, denticion));
      if (opciones.length === 0) return;
      const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const idxActual = Math.max(0, opciones.indexOf(piezaSel));
      const siguiente = opciones[(idxActual + dir + opciones.length) % opciones.length];
      if (siguiente !== undefined) {
        seleccionarPiezaYCara(siguiente, 'oclusal');
        if (enfocada) motorRef.current?.enfocarPieza(siguiente);
      }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      setEnfocada(true);
      motorRef.current?.enfocarPieza(piezaSel);
      e.preventDefault();
    } else if (/^[1-5]$/.test(e.key) && !soloPiezaCompleta) {
      const cara = CARAS_FDI_ORDEN[Number(e.key) - 1];
      if (cara) setCaraSel(cara);
      e.preventDefault();
    }
  }

  const indiceEfectivo = indiceHistorico ?? Math.max(0, snapshots.length - 1);
  const snapshotActivo = snapshots[indiceEfectivo];

  return (
    <div className="prof-odo-workspace-stack">
      <section className="prof-grid-clinica" aria-label="Odontograma FDI interactivo">
        <div className="prof-odo-col-izq">
          <div className="prof-card prof-odo-stage">
          <div className="prof-odo-toolbar">
            <div className="prof-odo-toolbar__left">
              <div className="prof-odo-segment" role="group" aria-label="Dentición">
                <button
                  type="button"
                  className="prof-odo-segment__btn"
                  aria-pressed={denticion === 'permanente'}
                  onClick={() => cambiarDenticion('permanente')}
                >
                  Permanente
                </button>
                <button
                  type="button"
                  className="prof-odo-segment__btn"
                  aria-pressed={denticion === 'temporaria'}
                  onClick={() => cambiarDenticion('temporaria')}
                >
                  Temporaria
                </button>
                <button
                  type="button"
                  className="prof-odo-segment__btn"
                  aria-pressed={denticion === 'mixta'}
                  onClick={() => cambiarDenticion('mixta')}
                >
                  Mixta
                </button>
              </div>

              <label className="prof-check prof-odo-check-inline">
                <input
                  type="checkbox"
                  checked={denticion !== 'permanente'}
                  onChange={(e) => cambiarDenticion(e.target.checked ? 'mixta' : 'permanente')}
                />
                <span>Mostrar dentición temporaria (51–85)</span>
              </label>
            </div>

            <div className="prof-odo-toolbar__right">
              <button
                type="button"
                className="prof-odo-toggle"
                aria-pressed={rayosX}
                disabled={modoVista !== '3d' || !motorListo}
                onClick={() => setRayosX((prev) => !prev)}
              >
                Rayos X
              </button>

              <div className="prof-odo-segment" role="group" aria-label="Vista">
                <button
                  type="button"
                  className="prof-odo-segment__btn"
                  aria-pressed={modoVista === '3d'}
                  disabled={!motorListo}
                  onClick={() => {
                    if (!motorListo) return;
                    setModoVista('3d');
                    motorRef.current?.redimensionar();
                  }}
                >
                  3D
                </button>
                <button
                  type="button"
                  className="prof-odo-segment__btn"
                  aria-pressed={modoVista === '2d'}
                  onClick={() => {
                    setModoVista('2d');
                    setHover3d(null);
                  }}
                >
                  Mapa clásico
                </button>
              </div>
            </div>
          </div>

          <div
            ref={viewportRef}
            className={['prof-odo-viewport', modoVista === '2d' ? 'prof-odo-viewport--map' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <canvas
              ref={canvasArcadasRef}
              className="prof-odo-canvas"
              tabIndex={0}
              aria-label="Arcadas 3D, usá las flechas para recorrer las piezas"
              hidden={modoVista !== '3d'}
              onKeyDown={handleTecladoCanvas}
            />

            {modoVista === '3d' ? (
              <>
                <div className="prof-odo-hud-id">
                  <span className="prof-odo-eyebrow">
                    {rayosX ? 'Rayos X · Raíces y conductos' : 'Arcadas superior e inferior'}
                  </span>
                  <small>
                    {enfocada
                      ? `Pieza enfocada · ${piezaSel}`
                      : enPasado
                        ? 'Consulta histórica · Solo lectura'
                        : 'Vista de exploración'}
                  </small>
                </div>

                <span className="prof-odo-hud-count">{cantidadPiezasVisibles} piezas</span>

                <div className="prof-odo-hud-orient" aria-hidden="true">
                  <span>D</span>
                  <span className="prof-odo-hud-axis" />
                  <span>I</span>
                  <span>· Vista clínica</span>
                </div>

                <button
                  type="button"
                  className="prof-odo-hud-reset"
                  onClick={() => {
                    setEnfocada(false);
                    motorRef.current?.centrarArcadas();
                  }}
                >
                  Centrar arcadas
                </button>

                {hover3d ? (
                  <div
                    className="prof-odo-tooltip"
                    style={{ left: `${hover3d.x}px`, top: `${hover3d.y}px` }}
                  >
                    {hover3d.pieza} · {nombreAnatomicoFdi(hover3d.pieza)}
                  </div>
                ) : null}
              </>
            ) : (
              <OdontogramaFdi
                piezas={piezasVisibles}
                piezaSeleccionada={piezaSel}
                caraSeleccionada={soloPiezaCompleta ? '' : caraSel}
                mostrarTemporaria={denticion !== 'permanente'}
                denticion={denticion}
                embebido
                piezasDestacadas={flashPiezas}
                onToggleTemporaria={(visible) => cambiarDenticion(visible ? 'mixta' : 'permanente')}
                onSeleccionar={seleccionarPiezaYCara}
              />
            )}
          </div>

          <div className="prof-odo-stage-foot">
            <span>
              {modoVista === '3d'
                ? 'Arrastrá para orbitar · Rueda para acercar · Clic en una pieza para enfocar'
                : 'Seleccioná una pieza o una cara en el esquema FDI'}
            </span>
            <span>← → Piezas · Enter Enfocar · 1–5 Caras</span>
          </div>

          {mensajeFallback ? (
            <p className="prof-odo-fallback">{mensajeFallback}</p>
          ) : null}
          </div>

          {snapshots.length > 0 && snapshotActivo ? (
            <section className="prof-card prof-odo-time" aria-labelledby="titulo-maquina-tiempo">
              <div>
                <span className="prof-odo-eyebrow">Historial clínico</span>
                <h2 id="titulo-maquina-tiempo" className="prof-card__titulo">
                  Máquina del tiempo
                </h2>
                <p className="prof-card__sub" aria-live="polite">
                  {enPasado ? 'Consulta histórica · ' : 'Actual · '}
                  {formatearFechaHora(snapshotActivo.fecha)} · {nombreProfesional(snapshotActivo.autor)}
                </p>
              </div>

              <div className="prof-odo-timeline">
                <label className="prof-sr-only" htmlFor="odo-time-scrub">
                  Fecha de consulta
                </label>
                <input
                  id="odo-time-scrub"
                  type="range"
                  min={0}
                  max={Math.max(0, snapshots.length - 1)}
                  step={1}
                  value={indiceEfectivo}
                  disabled={snapshots.length <= 1}
                  aria-valuetext={formatearFechaHora(snapshotActivo.fecha)}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (idx >= snapshots.length - 1) {
                      irAlSnapshot(null);
                    } else {
                      irAlSnapshot(idx);
                    }
                  }}
                />
                <div className="prof-odo-timeline-steps" aria-label="Consultas">
                  {snapshots.map((snap, i) => (
                    <button
                      key={`${snap.clave}-${i}`}
                      type="button"
                      className="prof-odo-timeline-step"
                      aria-current={i === indiceEfectivo ? 'step' : undefined}
                      aria-label={`Consulta del ${formatearFechaHora(snap.fecha)}`}
                      onClick={() => {
                        if (i >= snapshots.length - 1 && !enPasado) {
                          irAlSnapshot(null);
                        } else {
                          irAlSnapshot(i);
                        }
                      }}
                    >
                      {formatearFechaCorta(snap.fecha)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="prof-odo-time-actions">
                {snapshots.length > 1 ? (
                  <Boton variante="secundario" onClick={toggleReproduccion}>
                    {reproduciendo ? 'Pausar evolución' : 'Reproducir evolución'}
                  </Boton>
                ) : null}
                {enPasado ? (
                  <Boton variante="primario" onClick={() => irAlSnapshot(null)}>
                    Volver al presente
                  </Boton>
                ) : null}
              </div>
            </section>
          ) : null}

          {contenidoDebajoDiagrama}
        </div>

        <aside className="prof-card prof-odo-sheet" aria-labelledby="titulo-editor-pieza">
          <div className="prof-odo-sheet-head">
            <span className="prof-odo-tooth-num">{piezaSel}</span>
            <div className="prof-odo-sheet-title">
              <span className="prof-odo-eyebrow">
                {esPiezaTemporaria(piezaSel) ? 'Pieza temporaria' : 'Pieza permanente'}
              </span>
              <h2 id="titulo-editor-pieza" className="prof-card__titulo">
                {nombrePieza}
              </h2>
            </div>
            <button
              type="button"
              className="prof-odo-focus-btn"
              aria-pressed={enfocada}
              disabled={!motorListo || modoVista !== '3d'}
              onClick={() => {
                if (enfocada) {
                  setEnfocada(false);
                  motorRef.current?.centrarArcadas();
                } else {
                  setEnfocada(true);
                  motorRef.current?.enfocarPieza(piezaSel);
                }
              }}
            >
              {enfocada ? 'Arcadas' : 'Enfocar pieza'}
            </button>
          </div>

          <div className="prof-editor-badge" data-testid="editor-pieza-badge">
            Pieza {piezaSel} ·{' '}
            {soloPiezaCompleta || caraSel === ''
              ? 'Pieza completa'
              : `Cara ${etiquetaCaraAnatomica(piezaSel, caraSel).toLowerCase()}`}
          </div>

          <div ref={miniRef} className="prof-odo-mini">
            <canvas
              ref={canvasAisladaRef}
              className="prof-odo-mini__canvas"
              aria-label="Modelo aislado de la pieza"
              hidden={!motorListo}
            />
            {!motorListo ? <div className="prof-odo-mini__fallback">5 caras FDI</div> : null}

            <div className="prof-odo-mini__faces" role="group" aria-label="Caras de la pieza">
              {CARAS_FDI_ORDEN.map((cara, idx) => {
                const etiqueta = etiquetaCaraAnatomica(piezaSel, cara);
                const activa = !soloPiezaCompleta && caraSel === cara;
                return (
                  <button
                    key={cara}
                    type="button"
                    className={`prof-odo-face-btn prof-odo-face-btn--${cara}`}
                    aria-pressed={activa}
                    disabled={soloPiezaCompleta || enPasado}
                    onClick={() => setCaraSel(cara)}
                  >
                    <span className="prof-odo-face-btn__idx">{idx + 1}</span>
                    {etiqueta}
                  </button>
                );
              })}
            </div>

            {motorListo && !movimientoReducido ? (
              <button
                type="button"
                className="prof-odo-pose-btn"
                onClick={() => {
                  const siguiente = !girandoMini;
                  setGirandoMini(siguiente);
                  motorRef.current?.setGiroMini(siguiente);
                }}
              >
                {girandoMini ? 'Pausar giro' : 'Girar pieza'}
              </button>
            ) : null}
          </div>

          <div className="prof-odo-summary" aria-label="Hallazgos registrados de la pieza">
            <span className="prof-odo-summary__prefix">Registro:</span>
            {hallazgosPiezaActual.length === 0 ? (
              <span>sin hallazgos</span>
            ) : (
              hallazgosPiezaActual.map((h) => (
                <span key={h.clave} className="prof-odo-state-chip">
                  <span className="prof-odo-state-chip__mark" aria-hidden="true">
                    {SIMBOLO_ESTADO_PIEZA[h.estado]}
                  </span>
                  {h.etiqueta}
                </span>
              ))
            )}
          </div>

          <form className="prof-form" onSubmit={(e) => void handleSubmitOdontograma(e)}>
            <div className="prof-odo-palette" role="group" aria-label="Estados clínicos">
              {ESTADOS_CLINICOS_ORDEN.map((est) => (
                <button
                  key={est}
                  type="button"
                  className={`prof-odo-palette__btn prof-odo-state--${est}`}
                  aria-pressed={estadoSel === est}
                  disabled={enPasado}
                  onClick={() => cambiarEstadoClinico(est)}
                >
                  <span className="prof-odo-palette__mark" aria-hidden="true">
                    {SIMBOLO_ESTADO_PIEZA[est]}
                  </span>
                  <span>{ETIQUETA_ESTADO_PIEZA[est]}</span>
                </button>
              ))}
            </div>

            <div className="prof-field">
              <label htmlFor="odo-estado" className="prof-field__label">
                Estado clínico
              </label>
              <select
                id="odo-estado"
                className="prof-select"
                value={estadoSel}
                disabled={enPasado}
                onChange={(e) => cambiarEstadoClinico(e.target.value as EstadoDePiezaApi)}
              >
                <option value="sano">Sano</option>
                <option value="caries">Caries</option>
                <option value="obturado">Obturado</option>
                <option value="corona">Corona (pieza completa)</option>
                <option value="endodoncia">Endodoncia (pieza completa)</option>
                <option value="ausente">Ausente (pieza completa)</option>
                <option value="a_extraer">A extraer (pieza completa)</option>
              </select>
            </div>

            <div className="prof-field">
              <label htmlFor="odo-cara" className="prof-field__label">
                Cara anatómica
              </label>
              <select
                id="odo-cara"
                className="prof-select"
                value={soloPiezaCompleta ? '' : caraSel}
                disabled={soloPiezaCompleta || enPasado}
                onChange={(e) => setCaraSel(e.target.value as CaraPiezaApi | '')}
              >
                <option value="">Pieza completa</option>
                <option value="oclusal">Oclusal</option>
                <option value="mesial">Mesial</option>
                <option value="distal">Distal</option>
                <option value="vestibular">Vestibular</option>
                <option value="lingual">{etiquetaCaraAnatomica(piezaSel, 'lingual')}</option>
              </select>
              <span className="prof-hint">
                {enPasado
                  ? 'Estás viendo una consulta histórica. Volvé al presente para registrar cambios.'
                  : soloPiezaCompleta
                    ? 'Este estado aplica a la pieza completa y no admite cara específica.'
                    : 'Orientación espejada automáticamente según el cuadrante FDI.'}
              </span>
            </div>

            <div className="prof-odo-draft-box">
              <div className="prof-odo-draft-head">
                <span className="prof-odo-draft-title">
                  <span className="prof-odo-draft-count">{borrador.length}</span>
                  <span>
                    {borrador.length === 1 ? 'Cambio en borrador' : 'Cambios en borrador'}
                  </span>
                </span>
                <Boton
                  variante="secundario"
                  disabled={enPasado || guardando}
                  onClick={handleAgregarBorrador}
                >
                  Agregar cambio al borrador
                </Boton>
              </div>

              {borrador.length > 0 ? (
                <ul className="prof-odo-draft-list" aria-label="Cambios pendientes en borrador">
                  {borrador.map((item, idx) => {
                    const descripcion = `Pieza ${item.pieza} · ${
                      item.cara ? etiquetaCaraAnatomica(item.pieza, item.cara) : 'Pieza completa'
                    } · ${ETIQUETA_ESTADO_PIEZA[item.estado]}`;
                    return (
                      <li key={`${item.pieza}-${item.cara ?? 'all'}-${idx}`}>
                        <span>{descripcion}</span>
                        <button
                          type="button"
                          className="prof-odo-undo-btn"
                          disabled={enPasado || guardando}
                          aria-label={`Deshacer ${descripcion}`}
                          onClick={() => handleDeshacerBorrador(idx)}
                        >
                          Deshacer
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <Boton type="submit" cargando={guardando} disabled={enPasado || guardando}>
              {borrador.length > 0
                ? `Guardar en odontograma (${borrador.length})`
                : 'Guardar en odontograma'}
            </Boton>
          </form>
        </aside>
      </section>
    </div>
  );
}
