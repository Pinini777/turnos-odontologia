import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ErrorApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { CLINICA } from '../../base/clinica';
import {
  AlertaErrorNegocio,
  AvatarIniciales,
  BadgeEstadoTurno,
  Boton,
  Campo,
  Skeleton,
} from '../../base/components';
import {
  aErrorApi,
  descargarCalendarioIcs,
  listarPrestacionesPublicas,
  reservarTurnoPaciente,
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
  fechaIsoEnZona,
  fechaLargaEnZona,
  horaEnZona,
  PROFESIONALES_FILTRO,
  sumarDiasIso,
} from './dominio';
import { GuardiaPaciente } from './GuardiaPaciente';
import { ITEMS_PACIENTE } from './menuPaciente';
import { SelectorHuecosPaciente } from './SelectorHuecosPaciente';
import './paciente.css';

export interface PropsReservarPage {
  readonly obtenerAhora?: () => Date;
}

const relojPorDefecto = () => new Date();

function ReservarContenido({ obtenerAhora = relojPorDefecto }: PropsReservarPage) {
  const hoyIso = fechaIsoEnZona(obtenerAhora());
  const [prestaciones, setPrestaciones] = useState<PrestacionPublicaApi[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);
  const [prestacionId, setPrestacionId] = useState('');
  const [profesionalId, setProfesionalId] = useState('');
  const [fecha, setFecha] = useState(hoyIso);
  const [recargaHuecos, setRecargaHuecos] = useState(0);
  const [huecoElegido, setHuecoElegido] = useState<HuecoDisponibleApi | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [errorReserva, setErrorReserva] = useState<ErrorApi | null>(null);
  const [turnoConfirmado, setTurnoConfirmado] = useState<TurnoPacienteApi | null>(null);
  const [descargandoIcs, setDescargandoIcs] = useState(false);
  const [errorIcs, setErrorIcs] = useState<ErrorApi | null>(null);

  useEffect(() => {
    let vigente = true;
    listarPrestacionesPublicas()
      .then((lista) => {
        if (!vigente) return;
        const reservables = lista.filter((p) => p.activa && p.reservableOnline);
        setPrestaciones(reservables);
        if (reservables[0]) {
          setPrestacionId(reservables[0].id);
        }
      })
      .catch((err: unknown) => {
        if (vigente) setErrorCarga(aErrorApi(err));
      });
    return () => {
      vigente = false;
    };
  }, []);

  const prestacionActual = prestaciones?.find((p) => p.id === prestacionId) ?? null;

  async function handleConfirmarReserva(): Promise<void> {
    if (!prestacionActual || !huecoElegido) return;
    setEnviando(true);
    setErrorReserva(null);
    setErrorIcs(null);
    try {
      const creado = await reservarTurnoPaciente({
        prestacionId: prestacionActual.id,
        profesionalId: huecoElegido.profesionalId,
        inicio: huecoElegido.inicio,
      });
      setTurnoConfirmado(creado);
    } catch (err: unknown) {
      const apiErr = aErrorApi(err);
      setErrorReserva(apiErr);
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
    setErrorIcs(null);
    try {
      await descargarCalendarioIcs(turnoId);
    } catch (err: unknown) {
      setErrorIcs(aErrorApi(err));
    } finally {
      setDescargandoIcs(false);
    }
  }

  function handleNuevaReserva(): void {
    setTurnoConfirmado(null);
    setHuecoElegido(null);
    setErrorReserva(null);
    setErrorIcs(null);
    setRecargaHuecos((n) => n + 1);
  }

  if (turnoConfirmado) {
    const bloque = fechaBloqueCalendario(turnoConfirmado.inicio);
    const nombrePrestacion = prestacionActual?.nombre ?? 'Consulta odontológica';
    const nombreProfesional = etiquetaProfesional(turnoConfirmado.profesionalId);
    const nombreBox = etiquetaBox(turnoConfirmado.boxId);
    const linkGcal = construirLinkGoogleCalendar({
      prestacionNombre: nombrePrestacion,
      profesionalNombre: nombreProfesional,
      boxNombre: nombreBox,
      inicioIso: turnoConfirmado.inicio,
      finIso: turnoConfirmado.fin,
    });

    return (
      <AppLayout
        titulo="Turno confirmado"
        subtitulo={`${CLINICA.nombre} · ${CLINICA.direccion}`}
        itemsExtra={ITEMS_PACIENTE}
      >
        <article className="pa-card pa-stack" style={{ maxWidth: '48rem' }}>
          <div className="pa-banner-exito" role="status" aria-live="polite">
            <span>
              Tu turno fue reservado correctamente. Podés agregarlo a tu calendario o consultarlo en
              Mis turnos.
            </span>
          </div>

          <div className="pa-turno-card__top">
            <div className="pa-fecha-bloque" aria-hidden="true">
              <div className="pa-fecha-bloque__mes">{bloque.mesCorto}</div>
              <div className="pa-fecha-bloque__dia">{bloque.dia}</div>
              <div className="pa-fecha-bloque__sem">{bloque.diaSemanaCorto}</div>
            </div>
            <div className="pa-turno-card__info">
              <div className="pa-turno-card__encabezado">
                <h2 className="pa-turno-card__titulo">
                  {nombrePrestacion}
                  {prestacionActual ? ` (${prestacionActual.duracionMin} min)` : ''}
                </h2>
                <BadgeEstadoTurno estado={turnoConfirmado.estado} />
              </div>
              <p className="pa-turno-card__fecha">
                {fechaLargaEnZona(turnoConfirmado.inicio)} · {horaEnZona(turnoConfirmado.inicio)} a{' '}
                {horaEnZona(turnoConfirmado.fin)}
              </p>
            </div>
          </div>

          <div className="pa-turno-card__detalles">
            <div className="pa-detalle-item">
              <span className="pa-detalle-item__label">Profesional</span>
              <span className="pa-detalle-item__prof">
                <AvatarIniciales nombre={nombreProfesional} tamano="sm" />
                {nombreProfesional}
              </span>
            </div>
            <div className="pa-detalle-item">
              <span className="pa-detalle-item__label">Consultorio</span>
              <strong>{nombreBox}</strong>
            </div>
            <div className="pa-detalle-item">
              <span className="pa-detalle-item__label">Dirección</span>
              <strong>{CLINICA.direccion}</strong>
            </div>
          </div>

          {errorIcs ? (
            <AlertaErrorNegocio code={errorIcs.code} mensaje={errorIcs.mensajeLegible} />
          ) : null}

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
                void handleDescargarIcs(turnoConfirmado.id);
              }}
            >
              Descargar .ics
            </Boton>
            <Link to="/paciente/turnos" className="wb-btn wb-btn--secundario">
              Ver Mis turnos
            </Link>
            <Boton variante="fantasma" onClick={handleNuevaReserva}>
              Reservar otro turno
            </Boton>
          </div>

          <p className="pa-nota-ayuda">
            Recordá que podés reprogramar o cancelar online hasta 24 horas antes del inicio del
            turno.
          </p>
        </article>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      titulo="Reservar turno"
      subtitulo={`Elegí la prestación y un horario libre en ${CLINICA.nombre}.`}
      itemsExtra={ITEMS_PACIENTE}
    >
      <div className="pa-stack">
        {errorCarga ? (
          <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} />
        ) : null}

        {errorReserva ? (
          <AlertaErrorNegocio
            code={errorReserva.code}
            mensaje={
              esErrorConflictoHueco(errorReserva.code)
                ? `${errorReserva.mensajeLegible} Actualizamos los horarios libres para que elijas otro.`
                : errorReserva.mensajeLegible
            }
          />
        ) : null}

        <div className="pa-reserva-grid">
          <section className="pa-card">
            <div className="pa-paso">
              <h2 className="pa-paso__label">
                <span className="pa-paso__num" aria-hidden="true">
                  1
                </span>
                Elegí la prestación
              </h2>
              {prestaciones === null ? (
                <Skeleton alto="4.5rem" />
              ) : prestaciones.length === 0 ? (
                <p className="pa-card__sub">
                  No hay prestaciones habilitadas para reserva online en este momento.
                </p>
              ) : (
                <div className="pa-prestaciones" role="group" aria-label="Prestaciones disponibles">
                  {prestaciones.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="pa-prestacion"
                      aria-pressed={prestacionId === p.id}
                      onClick={() => {
                        setPrestacionId(p.id);
                        setErrorReserva(null);
                      }}
                    >
                      <span className="pa-prestacion__nombre">{p.nombre}</span>
                      <span className="pa-prestacion__duracion">{p.duracionMin} min</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pa-paso">
              <h2 className="pa-paso__label">
                <span className="pa-paso__num" aria-hidden="true">
                  2
                </span>
                Elegí el día y el profesional
              </h2>
              <div className="pa-filtros">
                <div>
                  <Campo
                    etiqueta="Fecha"
                    type="date"
                    min={hoyIso}
                    value={fecha}
                    onChange={(e) => {
                      setFecha(e.target.value);
                      setErrorReserva(null);
                    }}
                  />
                  <div className="pa-atajos-fecha" aria-label="Atajos de fecha">
                    <button
                      type="button"
                      className="pa-chip"
                      onClick={() => setFecha(hoyIso)}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      className="pa-chip"
                      onClick={() => setFecha(sumarDiasIso(hoyIso, 1))}
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      className="pa-chip"
                      onClick={() => setFecha(sumarDiasIso(hoyIso, 2))}
                    >
                      En 2 días
                    </button>
                  </div>
                </div>

                <div className="pa-campo-select">
                  <label htmlFor="pa-filtro-profesional">Profesional</label>
                  <select
                    id="pa-filtro-profesional"
                    className="pa-select"
                    value={profesionalId}
                    onChange={(e) => {
                      setProfesionalId(e.target.value);
                      setErrorReserva(null);
                    }}
                  >
                    <option value="">Cualquier profesional disponible</option>
                    {PROFESIONALES_FILTRO.map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pa-paso">
              <h2 className="pa-paso__label">
                <span className="pa-paso__num" aria-hidden="true">
                  3
                </span>
                Seleccioná un horario disponible
              </h2>
              <SelectorHuecosPaciente
                prestacionId={prestacionId}
                profesionalId={profesionalId}
                fecha={fecha}
                onCambiarFecha={(nuevaFecha) => {
                  setFecha(nuevaFecha);
                  setErrorReserva(null);
                }}
                recarga={recargaHuecos}
                elegido={huecoElegido}
                onElegir={setHuecoElegido}
              />
            </div>
          </section>

          <aside className="pa-card" aria-label="Resumen de la reserva">
            <h2 className="pa-card__titulo">Resumen de tu reserva</h2>
            <p className="pa-card__sub">Revisá los datos antes de confirmar tu turno.</p>

            <div className="pa-resumen-lista">
              <div className="pa-resumen-fila">
                <span>Prestación</span>
                <strong>
                  {prestacionActual
                    ? `${prestacionActual.nombre} (${prestacionActual.duracionMin} min)`
                    : 'Sin seleccionar'}
                </strong>
              </div>
              <div className="pa-resumen-fila">
                <span>Fecha</span>
                <strong>
                  {huecoElegido
                    ? fechaLargaEnZona(huecoElegido.inicio)
                    : fecha
                      ? fechaLargaEnZona(`${fecha}T12:00:00-03:00`)
                      : 'Sin seleccionar'}
                </strong>
              </div>
              <div className="pa-resumen-fila">
                <span>Horario</span>
                <strong>
                  {huecoElegido
                    ? `${horaEnZona(huecoElegido.inicio)} a ${horaEnZona(huecoElegido.fin)}`
                    : 'Elegí un bloque libre'}
                </strong>
              </div>
              <div className="pa-resumen-fila">
                <span>Profesional</span>
                <strong>
                  {huecoElegido
                    ? etiquetaProfesional(huecoElegido.profesionalId)
                    : 'Según horario elegido'}
                </strong>
              </div>
              <div className="pa-resumen-fila">
                <span>Consultorio</span>
                <strong>
                  {huecoElegido && huecoElegido.boxIds[0]
                    ? `${etiquetaBox(huecoElegido.boxIds[0])} (asignación automática)`
                    : 'Asignación automática'}
                </strong>
              </div>
            </div>

            <Boton
              variante="primario"
              anchoCompleto
              disabled={!prestacionActual || !huecoElegido}
              cargando={enviando}
              textoCargando="Confirmando turno…"
              onClick={() => {
                void handleConfirmarReserva();
              }}
            >
              Confirmar turno
            </Boton>

            <p className="pa-nota-ayuda">
              Al confirmar vas a poder agregar el turno a Google Calendar o descargar el archivo
              .ics. Podrás reprogramar o cancelar online hasta 24 horas antes.
            </p>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

export function ReservarPage(props: PropsReservarPage) {
  return (
    <GuardiaPaciente>
      <ReservarContenido {...props} />
    </GuardiaPaciente>
  );
}
