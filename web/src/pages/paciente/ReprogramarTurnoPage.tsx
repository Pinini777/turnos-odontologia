import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ErrorApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { CLINICA } from '../../base/clinica';
import {
  AlertaErrorNegocio,
  AvatarIniciales,
  BadgeEstadoTurno,
  Boton,
  Skeleton,
} from '../../base/components';
import {
  aErrorApi,
  descargarCalendarioIcs,
  listarMisTurnos,
  listarPrestacionesPublicas,
  reprogramarMiTurno,
  type HuecoDisponibleApi,
  type PrestacionPublicaApi,
  type TurnoPacienteApi,
} from './apiPaciente';
import {
  construirLinkGoogleCalendar,
  esErrorConflictoHueco,
  etiquetaBox,
  etiquetaProfesional,
  fechaBloqueCalendario,
  fechaInicialSugerida,
  fechaIsoEnZona,
  fechaLargaEnZona,
  horaEnZona,
  puedeAutogestionarTurno,
} from './dominio';
import { GuardiaPaciente } from './GuardiaPaciente';
import { ITEMS_PACIENTE } from './menuPaciente';
import { SelectorHuecosPaciente } from './SelectorHuecosPaciente';
import './paciente.css';

export interface PropsReprogramarTurnoPage {
  readonly obtenerAhora?: () => Date;
}

const relojPorDefecto = () => new Date();

function ReprogramarContenido({ obtenerAhora = relojPorDefecto }: PropsReprogramarTurnoPage) {
  const { id = '' } = useParams();
  const ahoraInicial = obtenerAhora();
  const hoyIso = fechaIsoEnZona(ahoraInicial);

  const [turno, setTurno] = useState<TurnoPacienteApi | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [prestacion, setPrestacion] = useState<PrestacionPublicaApi | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);

  const [fecha, setFecha] = useState(() => fechaInicialSugerida(ahoraInicial));
  const [profesionalId, setProfesionalId] = useState('');
  const [recargaHuecos, setRecargaHuecos] = useState(0);
  const [huecoElegido, setHuecoElegido] = useState<HuecoDisponibleApi | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [errorReprog, setErrorReprog] = useState<ErrorApi | null>(null);
  const [plazoVencidoServidor, setPlazoVencidoServidor] = useState(false);
  const [reprogramado, setReprogramado] = useState<TurnoPacienteApi | null>(null);
  const [descargandoIcs, setDescargandoIcs] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([
      listarMisTurnos(),
      listarPrestacionesPublicas().catch(() => [] as PrestacionPublicaApi[]),
    ])
      .then(([turnos, prestaciones]) => {
        if (!activo) return;
        const encontrado = turnos.find((t) => t.id === id) ?? null;
        if (!encontrado) {
          setNoEncontrado(true);
          return;
        }
        setTurno(encontrado);
        setPrestacion(prestaciones.find((p) => p.id === encontrado.prestacionId) ?? null);
        setFecha(fechaIsoEnZona(new Date(encontrado.inicio)));
      })
      .catch((err: unknown) => {
        if (activo) setErrorCarga(aErrorApi(err));
      });
    return () => {
      activo = false;
    };
  }, [id]);

  async function handleConfirmarReprogramacion(): Promise<void> {
    if (!turno || !huecoElegido) return;
    setEnviando(true);
    setErrorReprog(null);
    try {
      const boxLibre = huecoElegido.boxIds.includes(turno.boxId)
        ? undefined
        : huecoElegido.boxIds[0];
      const actualizado = await reprogramarMiTurno(turno.id, {
        inicio: huecoElegido.inicio,
        profesionalId: huecoElegido.profesionalId,
        ...(boxLibre ? { boxId: boxLibre } : {}),
      });
      setReprogramado(actualizado);
    } catch (err: unknown) {
      const apiErr = aErrorApi(err);
      setErrorReprog(apiErr);
      if (apiErr.code === 'PLAZO_VENCIDO') {
        setPlazoVencidoServidor(true);
      }
      if (esErrorConflictoHueco(apiErr.code)) {
        setHuecoElegido(null);
        setRecargaHuecos((n) => n + 1);
      }
    } finally {
      setEnviando(false);
    }
  }

  async function handleDescargarIcs(turnoId: string): Promise<void> {
    setDescargandoIcs(true);
    try {
      await descargarCalendarioIcs(turnoId);
    } catch (err: unknown) {
      setErrorReprog(aErrorApi(err));
    } finally {
      setDescargandoIcs(false);
    }
  }

  if (reprogramado) {
    const bloque = fechaBloqueCalendario(reprogramado.inicio);
    const nombrePrestacion = prestacion?.nombre ?? 'Consulta odontológica';
    const nombreProfesional = etiquetaProfesional(reprogramado.profesionalId);
    const nombreBox = etiquetaBox(reprogramado.boxId);
    const linkGcal = construirLinkGoogleCalendar({
      prestacionNombre: nombrePrestacion,
      profesionalNombre: nombreProfesional,
      boxNombre: nombreBox,
      inicioIso: reprogramado.inicio,
      finIso: reprogramado.fin,
    });

    return (
      <AppLayout
        titulo="Turno reprogramado"
        subtitulo="Actualizamos tu visita en Clínica Dental Alvear."
        itemsExtra={ITEMS_PACIENTE}
      >
        <article className="pa-card pa-stack" style={{ maxWidth: '48rem' }}>
          <div className="pa-banner-exito" role="status" aria-live="polite">
            <span>Tu turno fue reprogramado correctamente.</span>
          </div>

          <div className="pa-turno-card__top">
            <div className="pa-fecha-bloque" aria-hidden="true">
              <div className="pa-fecha-bloque__mes">{bloque.mesCorto}</div>
              <div className="pa-fecha-bloque__dia">{bloque.dia}</div>
              <div className="pa-fecha-bloque__sem">{bloque.diaSemanaCorto}</div>
            </div>
            <div className="pa-turno-card__info">
              <div className="pa-turno-card__encabezado">
                <h2 className="pa-turno-card__titulo">{nombrePrestacion}</h2>
                <BadgeEstadoTurno estado={reprogramado.estado} />
              </div>
              <p className="pa-turno-card__fecha">
                {fechaLargaEnZona(reprogramado.inicio)} · {horaEnZona(reprogramado.inicio)} a{' '}
                {horaEnZona(reprogramado.fin)}
              </p>
              <p className="pa-nota-ayuda">
                {nombreProfesional} · {nombreBox}
              </p>
            </div>
          </div>

          <div className="pa-acciones">
            <a
              href={linkGcal}
              target="_blank"
              rel="noopener noreferrer"
              className="wb-btn wb-btn--primario"
            >
              Agregar a Google Calendar
            </a>
            <Boton
              variante="secundario"
              cargando={descargandoIcs}
              textoCargando="Descargando…"
              onClick={() => {
                void handleDescargarIcs(reprogramado.id);
              }}
            >
              Descargar .ics
            </Boton>
            <Link to="/paciente/turnos" className="wb-btn wb-btn--secundario">
              Volver a Mis turnos
            </Link>
          </div>
        </article>
      </AppLayout>
    );
  }

  const ahora = obtenerAhora();
  const puedeReprogramar =
    turno !== null &&
    puedeAutogestionarTurno(turno.inicio, turno.estado, ahora) &&
    !plazoVencidoServidor;

  const profesionalNuevo = huecoElegido ? etiquetaProfesional(huecoElegido.profesionalId) : null;

  return (
    <AppLayout
      titulo="Reprogramar turno"
      subtitulo="Elegí un nuevo día y horario disponible para tu visita."
      acciones={
        <Link to="/paciente/turnos" className="wb-btn wb-btn--secundario">
          Volver a Mis turnos
        </Link>
      }
      itemsExtra={ITEMS_PACIENTE}
    >
      <div className="pa-stack">
        {errorCarga ? (
          <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} />
        ) : null}

        {noEncontrado ? (
          <AlertaErrorNegocio
            code="NO_ENCONTRADO"
            mensaje="No encontramos el turno que querés reprogramar."
          />
        ) : turno === null && !errorCarga ? (
          <Skeleton alto="10rem" />
        ) : turno !== null ? (
          <>
            <div className="pa-antes-despues">
              <div>
                <strong>{prestacion?.nombre ?? 'Consulta odontológica'}</strong>
                <div>
                  <span className="pa-tachado">
                    {fechaLargaEnZona(turno.inicio)} · {horaEnZona(turno.inicio)} a{' '}
                    {horaEnZona(turno.fin)} ({etiquetaProfesional(turno.profesionalId)})
                  </span>
                </div>
              </div>
              {huecoElegido ? (
                <>
                  <span className="pa-flecha" aria-hidden="true">
                    →
                  </span>
                  <div className="pa-valor-animado" key={huecoElegido.inicio}>
                    <strong>Nuevo horario</strong>
                    <div>
                      {fechaLargaEnZona(huecoElegido.inicio)} · {horaEnZona(huecoElegido.inicio)} a{' '}
                      {horaEnZona(huecoElegido.fin)} (
                      {etiquetaProfesional(huecoElegido.profesionalId)})
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {!puedeReprogramar ? (
              <div className="pa-banner-aviso" role="alert">
                <strong>Plazo vencido (menos de 24 h):</strong> este turno ya no puede reprogramarse
                online. Comunicate con recepción al {CLINICA.telefono}.
              </div>
            ) : null}

            {errorReprog ? (
              <AlertaErrorNegocio
                code={errorReprog.code}
                mensaje={
                  esErrorConflictoHueco(errorReprog.code)
                    ? `${errorReprog.mensajeLegible} Actualizamos los horarios disponibles para que elijas otro.`
                    : errorReprog.mensajeLegible
                }
              />
            ) : null}

            <div className="pa-reserva-grid">
              <section className="pa-card">
                <SelectorHuecosPaciente
                  prestacionId={turno.prestacionId}
                  profesionalId={profesionalId}
                  onCambiarProfesional={(nuevoProf) => {
                    setProfesionalId(nuevoProf);
                    setErrorReprog(null);
                  }}
                  fecha={fecha}
                  onCambiarFecha={(nuevaFecha) => {
                    setFecha(nuevaFecha);
                    setErrorReprog(null);
                  }}
                  fechaMinima={hoyIso}
                  recarga={recargaHuecos}
                  elegido={huecoElegido}
                  onElegir={setHuecoElegido}
                  deshabilitado={!puedeReprogramar}
                  mostrarNumeracionPasos={false}
                />
              </section>

              <aside className="pa-card pa-resumen-sticky">
                <h2 className="pa-card__titulo">Confirmar cambio</h2>
                <p className="pa-card__sub">
                  El turno volverá a estado Reservado con el nuevo horario elegido.
                </p>

                <div className="pa-resumen-lista">
                  <div className="pa-resumen-fila">
                    <span>Prestación</span>
                    <strong>{prestacion?.nombre ?? 'Consulta odontológica'}</strong>
                  </div>
                  <div className="pa-resumen-fila">
                    <span>Nuevo día</span>
                    <strong key={huecoElegido?.inicio ?? 'sin-d'} className="pa-valor-animado">
                      {huecoElegido ? fechaLargaEnZona(huecoElegido.inicio) : 'Sin elegir'}
                    </strong>
                  </div>
                  <div className="pa-resumen-fila">
                    <span>Nuevo horario</span>
                    <strong key={huecoElegido?.fin ?? 'sin-h'} className="pa-valor-animado">
                      {huecoElegido
                        ? `${horaEnZona(huecoElegido.inicio)} a ${horaEnZona(huecoElegido.fin)}`
                        : 'Elegí una hora'}
                    </strong>
                  </div>
                  <div className="pa-resumen-fila">
                    <span>Profesional</span>
                    <strong key={profesionalNuevo ?? 'sin-pr'} className="pa-valor-animado pa-resumen-prof">
                      {profesionalNuevo ? (
                        <>
                          <AvatarIniciales nombre={profesionalNuevo} tamano="sm" />
                          <span>{profesionalNuevo}</span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </strong>
                  </div>
                </div>

                <Boton
                  variante="primario"
                  anchoCompleto
                  disabled={!puedeReprogramar || !huecoElegido}
                  cargando={enviando}
                  textoCargando="Guardando cambio…"
                  onClick={() => {
                    void handleConfirmarReprogramacion();
                  }}
                >
                  Confirmar nuevo horario
                </Boton>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function ReprogramarTurnoPage(props: PropsReprogramarTurnoPage) {
  return (
    <GuardiaPaciente>
      <ReprogramarContenido {...props} />
    </GuardiaPaciente>
  );
}
