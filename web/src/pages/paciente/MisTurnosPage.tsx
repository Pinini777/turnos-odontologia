import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ErrorApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { CLINICA } from '../../base/clinica';
import {
  AlertaErrorNegocio,
  AvatarIniciales,
  BadgeEstadoTurno,
  Boton,
  EstadoVacio,
  Skeleton,
} from '../../base/components';
import {
  aErrorApi,
  cancelarMiTurno,
  descargarCalendarioIcs,
  listarMisTurnos,
  listarPrestacionesPublicas,
  type PrestacionPublicaApi,
  type TurnoPacienteApi,
} from './apiPaciente';
import {
  construirLinkGoogleCalendar,
  esTurnoActivo,
  etiquetaBox,
  etiquetaProfesional,
  fechaBloqueCalendario,
  fechaLargaEnZona,
  horaEnZona,
  puedeAutogestionarTurno,
} from './dominio';
import { GuardiaPaciente } from './GuardiaPaciente';
import { ITEMS_PACIENTE } from './menuPaciente';
import './paciente.css';

export interface PropsMisTurnosPage {
  readonly obtenerAhora?: () => Date;
}

const relojPorDefecto = () => new Date();

function MisTurnosContenido({ obtenerAhora = relojPorDefecto }: PropsMisTurnosPage) {
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState<TurnoPacienteApi[] | null>(null);
  const [prestaciones, setPrestaciones] = useState<ReadonlyMap<string, PrestacionPublicaApi>>(
    () => new Map(),
  );
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);
  const [errorAccion, setErrorAccion] = useState<ErrorApi | null>(null);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [descargandoIcsId, setDescargandoIcsId] = useState<string | null>(null);
  const [plazosVencidos, setPlazosVencidos] = useState<ReadonlySet<string>>(() => new Set());

  async function cargarTurnos(): Promise<void> {
    setErrorCarga(null);
    try {
      const [listaTurnos, listaPrestaciones] = await Promise.all([
        listarMisTurnos(),
        listarPrestacionesPublicas().catch(() => [] as PrestacionPublicaApi[]),
      ]);
      setTurnos(listaTurnos);
      setPrestaciones(new Map(listaPrestaciones.map((p) => [p.id, p])));
    } catch (err: unknown) {
      setErrorCarga(aErrorApi(err));
    }
  }

  useEffect(() => {
    let activo = true;
    Promise.all([
      listarMisTurnos(),
      listarPrestacionesPublicas().catch(() => [] as PrestacionPublicaApi[]),
    ])
      .then(([listaTurnos, listaPrestaciones]) => {
        if (!activo) return;
        setTurnos(listaTurnos);
        setPrestaciones(new Map(listaPrestaciones.map((p) => [p.id, p])));
      })
      .catch((err: unknown) => {
        if (activo) setErrorCarga(aErrorApi(err));
      });
    return () => {
      activo = false;
    };
  }, []);

  async function handleConfirmarCancelacion(turnoId: string): Promise<void> {
    setCancelandoId(turnoId);
    setErrorAccion(null);
    setMensajeOk(null);
    try {
      await cancelarMiTurno(turnoId);
      setConfirmandoId(null);
      setMensajeOk('Tu turno fue cancelado correctamente.');
      await cargarTurnos();
    } catch (err: unknown) {
      const apiErr = aErrorApi(err);
      setErrorAccion(apiErr);
      setConfirmandoId(null);
      if (apiErr.code === 'PLAZO_VENCIDO') {
        setPlazosVencidos((prev) => new Set([...prev, turnoId]));
      }
    } finally {
      setCancelandoId(null);
    }
  }

  async function handleDescargarIcs(turnoId: string): Promise<void> {
    setDescargandoIcsId(turnoId);
    setErrorAccion(null);
    try {
      await descargarCalendarioIcs(turnoId);
    } catch (err: unknown) {
      setErrorAccion(aErrorApi(err));
    } finally {
      setDescargandoIcsId(null);
    }
  }

  const ahora = obtenerAhora();
  const proximos = (turnos ?? []).filter((t) => esTurnoActivo(t.estado));
  const historial = (turnos ?? []).filter((t) => !esTurnoActivo(t.estado));

  const renderTarjeta = (turno: TurnoPacienteApi, esHistorial: boolean) => {
    const bloque = fechaBloqueCalendario(turno.inicio);
    const prestacion = prestaciones.get(turno.prestacionId);
    const nombrePrestacion = prestacion?.nombre ?? 'Consulta odontológica';
    const nombreProfesional = etiquetaProfesional(turno.profesionalId);
    const nombreBox = etiquetaBox(turno.boxId);
    const plazoHabilitado =
      !esHistorial &&
      puedeAutogestionarTurno(turno.inicio, turno.estado, ahora) &&
      !plazosVencidos.has(turno.id);

    const linkGcal = construirLinkGoogleCalendar({
      prestacionNombre: nombrePrestacion,
      profesionalNombre: nombreProfesional,
      boxNombre: nombreBox,
      inicioIso: turno.inicio,
      finIso: turno.fin,
    });

    return (
      <article
        key={turno.id}
        className={`pa-turno-card${esHistorial ? ' pa-turno-card--historial' : ''}`}
      >
        <div className="pa-turno-card__top">
          <div className="pa-fecha-bloque" aria-hidden="true">
            <div className="pa-fecha-bloque__mes">{bloque.mesCorto}</div>
            <div className="pa-fecha-bloque__dia">{bloque.dia}</div>
            <div className="pa-fecha-bloque__sem">{bloque.diaSemanaCorto}</div>
          </div>

          <div className="pa-turno-card__info">
            <div className="pa-turno-card__encabezado">
              <h3 className="pa-turno-card__titulo">{nombrePrestacion}</h3>
              <BadgeEstadoTurno estado={turno.estado} />
            </div>
            <p className="pa-turno-card__fecha">
              {fechaLargaEnZona(turno.inicio)} · {horaEnZona(turno.inicio)} a{' '}
              {horaEnZona(turno.fin)}
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

        {!esHistorial ? (
          <>
            <div className="pa-acciones">
              <a
                href={linkGcal}
                target="_blank"
                rel="noopener noreferrer"
                className="wb-btn wb-btn--secundario"
              >
                Agregar a Google Calendar
              </a>
              <Boton
                variante="secundario"
                cargando={descargandoIcsId === turno.id}
                textoCargando="Descargando…"
                onClick={() => {
                  void handleDescargarIcs(turno.id);
                }}
              >
                Descargar .ics
              </Boton>
              <Boton
                variante="primario"
                disabled={!plazoHabilitado}
                onClick={() => {
                  void navigate(`/paciente/turnos/${encodeURIComponent(turno.id)}/reprogramar`);
                }}
              >
                Reprogramar
              </Boton>
              <Boton
                variante="peligro"
                disabled={!plazoHabilitado}
                onClick={() => {
                  setErrorAccion(null);
                  setConfirmandoId(turno.id);
                }}
              >
                Cancelar turno
              </Boton>
            </div>

            {confirmandoId === turno.id ? (
              <div className="pa-confirmacion-cancelar" role="region" aria-label="Confirmar cancelación">
                <span>¿Seguro que querés cancelar este turno?</span>
                <div className="pa-acciones">
                  <Boton
                    variante="peligro"
                    cargando={cancelandoId === turno.id}
                    textoCargando="Cancelando…"
                    onClick={() => {
                      void handleConfirmarCancelacion(turno.id);
                    }}
                  >
                    Sí, cancelar turno
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => setConfirmandoId(null)}
                  >
                    Mantener turno
                  </Boton>
                </div>
              </div>
            ) : null}

            {!plazoHabilitado ? (
              <div className="pa-banner-aviso" role="note">
                <strong>Plazo vencido (menos de 24 h):</strong> solo podés cancelar o reprogramar
                online hasta 24 horas antes del inicio. Si necesitás asistencia, llamá al{' '}
                {CLINICA.telefono}.
              </div>
            ) : null}
          </>
        ) : null}
      </article>
    );
  };

  return (
    <AppLayout
      titulo="Mis turnos"
      subtitulo="Consultá tus próximas visitas, descargá el recordatorio o modificá un turno."
      acciones={
        <Link to="/paciente/reservar" className="wb-btn wb-btn--primario">
          Reservar nuevo turno
        </Link>
      }
      itemsExtra={ITEMS_PACIENTE}
    >
      <div className="pa-stack">
        <div className="pa-banner-aviso">
          <strong>Política de cambios:</strong> podés cancelar o reprogramar tu turno online hasta{' '}
          <strong>24 horas antes</strong> del horario programado. Si faltan menos de 24 horas,
          comunicate con recepción al {CLINICA.telefono}.
        </div>

        {mensajeOk ? (
          <div className="pa-banner-exito" role="status" aria-live="polite">
            <span>{mensajeOk}</span>
          </div>
        ) : null}

        {errorCarga ? (
          <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} />
        ) : null}

        {errorAccion ? (
          <AlertaErrorNegocio code={errorAccion.code} mensaje={errorAccion.mensajeLegible} />
        ) : null}

        {turnos === null && !errorCarga ? (
          <div className="pa-stack" aria-label="Cargando tus turnos">
            <Skeleton alto="8rem" />
            <Skeleton alto="8rem" />
          </div>
        ) : turnos !== null && turnos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no tenés turnos registrados"
            descripcion="Podés elegir una prestación y reservar un horario disponible en pocos pasos."
            accion={
              <Link to="/paciente/reservar" className="wb-btn wb-btn--primario">
                Reservar mi primer turno
              </Link>
            }
          />
        ) : (
          <>
            <section aria-labelledby="pa-proximos-titulo">
              <h2 id="pa-proximos-titulo" className="pa-seccion-titulo">
                Próximos turnos ({proximos.length})
              </h2>
              {proximos.length === 0 ? (
                <EstadoVacio
                  titulo="No tenés próximos turnos activos"
                  descripcion="Cuando reserves un nuevo turno va a aparecer acá con acceso directo a Google Calendar."
                  accion={
                    <Link to="/paciente/reservar" className="wb-btn wb-btn--primario">
                      Reservar turno
                    </Link>
                  }
                />
              ) : (
                <div className="pa-turnos-lista">
                  {proximos.map((t) => renderTarjeta(t, false))}
                </div>
              )}
            </section>

            {historial.length > 0 ? (
              <section aria-labelledby="pa-historial-titulo">
                <h2 id="pa-historial-titulo" className="pa-seccion-titulo">
                  Historial ({historial.length})
                </h2>
                <div className="pa-turnos-lista">
                  {historial.map((t) => renderTarjeta(t, true))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export function MisTurnosPage(props: PropsMisTurnosPage) {
  return (
    <GuardiaPaciente>
      <MisTurnosContenido {...props} />
    </GuardiaPaciente>
  );
}
