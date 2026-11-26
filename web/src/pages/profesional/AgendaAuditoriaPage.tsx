import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi } from '../../base/api';
import {
  AlertaErrorNegocio,
  BadgeEstadoTurno,
  Boton,
  Campo,
  EstadoVacio,
  SkeletonTabla,
  type EstadoTurnoUi,
} from '../../base/components';
import {
  cambiarEstadoTurnoProfesional,
  listarAgenda,
  listarAuditoriaTurno,
  listarBoxes,
  listarProfesionales,
  type AuditoriaTurnoApi,
  type BoxApi,
  type ProfesionalApi,
  type TurnoAgendaApi,
} from './apiProfesional';
import {
  construirRangoFechasIso,
  fechaLocalADateIso,
  formatearFechaHora,
  formatearHora,
} from './formatos';
import { GuardiaProfesional } from './GuardiaProfesional';
import { MENU_PROFESIONAL } from './menuProfesional';

const ESTADOS_VALIDOS = new Set<EstadoTurnoUi>([
  'reservado',
  'confirmado',
  'atendido',
  'ausente',
  'cancelado',
]);

const ACTORES_CONOCIDOS: Readonly<Record<string, string>> = {
  paciente: 'Paciente (reserva online)',
  recepcionista: 'Recepción',
  recepcion: 'Recepción',
  'u-recep': 'Recepción',
  '00000000-0000-4000-8000-000000000603': 'Recepción',
  '00000000-0000-4000-8000-000000000003': 'Recepción',
  profesional: 'Profesional',
  'u-prof-1': 'Dra. Ana Pérez',
  '00000000-0000-4000-8000-000000000601': 'Dra. Ana Pérez',
  '00000000-0000-4000-8000-000000000101': 'Dra. Ana Pérez',
  '00000000-0000-4000-8000-000000000001': 'Dra. Ana Pérez',
  'u-prof-2': 'Dr. Bruno Gómez',
  '00000000-0000-4000-8000-000000000602': 'Dr. Bruno Gómez',
  '00000000-0000-4000-8000-000000000102': 'Dr. Bruno Gómez',
  '00000000-0000-4000-8000-000000000002': 'Dr. Bruno Gómez',
  '00000000-0000-4000-8000-000000000604': 'Paciente (reserva online)',
  '00000000-0000-4000-8000-000000007001': 'Paciente (reserva online)',
  sistema: 'Sistema',
};

const BOXES_CONOCIDOS: Readonly<Record<string, string>> = {
  'box-1': 'Box 1',
  'box-2': 'Box 2',
  '00000000-0000-4000-8000-000000000201': 'Box 1',
  '00000000-0000-4000-8000-000000000202': 'Box 2',
};

function esEstadoTurno(valor: unknown): valor is EstadoTurnoUi {
  return typeof valor === 'string' && ESTADOS_VALIDOS.has(valor as EstadoTurnoUi);
}

function esObjeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null;
}

function extraerEstado(nodo: unknown): EstadoTurnoUi | null {
  if (esEstadoTurno(nodo)) return nodo;
  if (esObjeto(nodo) && esEstadoTurno(nodo.estado)) return nodo.estado;
  return null;
}

function extraerHorario(nodo: unknown): { inicio: string; fin?: string } | null {
  if (!esObjeto(nodo) || typeof nodo.inicio !== 'string') return null;
  return {
    inicio: nodo.inicio,
    ...(typeof nodo.fin === 'string' ? { fin: nodo.fin } : {}),
  };
}

function extraerBoxId(nodo: unknown): string | null {
  if (!esObjeto(nodo) || typeof nodo.boxId !== 'string') return null;
  return nodo.boxId;
}

function formatearRangoHorario(horario: { inicio: string; fin?: string }): string {
  return horario.fin
    ? `${formatearFechaHora(horario.inicio)} – ${formatearHora(horario.fin)}`
    : formatearFechaHora(horario.inicio);
}

function etiquetaAccionMovimiento(
  accion: string,
  detalle: Readonly<Record<string, unknown>>,
): string {
  if (detalle.revertido === true || accion === 'reversion_fallo_guardado') {
    return 'Cambio revertido por error al guardar';
  }
  if (accion === 'creado') return 'Turno reservado';
  if (accion === 'estado_cambiado') return 'Cambio de estado';
  if (accion === 'reprogramado') return 'Turno reprogramado';
  if (accion === 'cancelado') return 'Turno cancelado';
  return 'Movimiento del turno';
}

function etiquetaActorMovimiento(
  actor: string,
  profesionales: readonly ProfesionalApi[],
): string {
  const directo = ACTORES_CONOCIDOS[actor];
  if (directo) return directo;
  const prof = profesionales.find((p) => p.usuarioId === actor || p.id === actor);
  if (prof) return prof.nombre;
  if (/^[0-9a-f-]{20,}$/i.test(actor) || actor.startsWith('u-')) {
    return 'Personal del consultorio';
  }
  return actor;
}

function nombreBoxLegible(boxId: string, boxes: readonly BoxApi[]): string {
  return boxes.find((b) => b.id === boxId)?.nombre ?? BOXES_CONOCIDOS[boxId] ?? 'Box asignado';
}

function renderizarDetalleMovimiento(
  reg: AuditoriaTurnoApi,
  boxes: readonly BoxApi[],
): ReactNode {
  const det = reg.detalle;
  const nodoAntes = det.antes ?? det.anterior ?? det.estadoAnterior;
  const nodoDespues = det.despues ?? det.nuevo ?? det.estadoNuevo;

  const estadoAntes = extraerEstado(nodoAntes);
  const estadoDespues = extraerEstado(nodoDespues) ?? extraerEstado(det.estado);
  const horarioAntes = extraerHorario(nodoAntes);
  const horarioDespues = extraerHorario(nodoDespues) ?? extraerHorario(det);
  const boxDespues = extraerBoxId(nodoDespues) ?? extraerBoxId(det);
  const motivo = typeof det.motivo === 'string' && det.motivo.trim() ? det.motivo.trim() : null;

  if (reg.accion === 'creado') {
    const estadoInicial = estadoDespues ?? 'reservado';
    return (
      <div
        className="prof-movimiento-detalle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <span>Estado inicial:</span>
        <BadgeEstadoTurno estado={estadoInicial} />
        {horarioDespues ? (
          <span>· Horario: {formatearRangoHorario(horarioDespues)}</span>
        ) : null}
        {boxDespues ? <span>· {nombreBoxLegible(boxDespues, boxes)}</span> : null}
      </div>
    );
  }

  if (reg.accion === 'reprogramado') {
    return (
      <div
        className="prof-movimiento-detalle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        {horarioAntes ? <span>Horario anterior: {formatearRangoHorario(horarioAntes)}</span> : null}
        {horarioDespues ? (
          <span>
            {horarioAntes ? '→ ' : ''}Nuevo horario: {formatearRangoHorario(horarioDespues)}
          </span>
        ) : null}
        {boxDespues ? <span>· {nombreBoxLegible(boxDespues, boxes)}</span> : null}
        {estadoDespues ? <BadgeEstadoTurno estado={estadoDespues} /> : null}
      </div>
    );
  }

  if (reg.accion === 'cancelado') {
    return (
      <div
        className="prof-movimiento-detalle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        {estadoAntes ? (
          <>
            <span>Pasó de</span>
            <BadgeEstadoTurno estado={estadoAntes} />
            <span>a</span>
          </>
        ) : (
          <span>Estado:</span>
        )}
        <BadgeEstadoTurno estado="cancelado" />
        {motivo ? <span>· Motivo: {motivo}</span> : null}
      </div>
    );
  }

  if (estadoAntes && estadoDespues) {
    return (
      <div
        className="prof-movimiento-detalle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <span>Pasó de</span>
        <BadgeEstadoTurno estado={estadoAntes} />
        <span>a</span>
        <BadgeEstadoTurno estado={estadoDespues} />
      </div>
    );
  }

  if (estadoDespues) {
    return (
      <div
        className="prof-movimiento-detalle"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}
      >
        <span>Estado:</span>
        <BadgeEstadoTurno estado={estadoDespues} />
      </div>
    );
  }

  return <p style={{ margin: 0 }}>Movimiento registrado en el turno.</p>;
}

function ContenidoAgenda() {
  const hoy = fechaLocalADateIso(new Date());
  const [diaDesde, setDiaDesde] = useState<string>(hoy);
  const [diaHasta, setDiaHasta] = useState<string>(hoy);
  const [profesionalId, setProfesionalId] = useState<string>('');
  const [boxId, setBoxId] = useState<string>('');

  const [profesionales, setProfesionales] = useState<readonly ProfesionalApi[]>([]);
  const [boxes, setBoxes] = useState<readonly BoxApi[]>([]);
  const [turnos, setTurnos] = useState<readonly TurnoAgendaApi[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [recarga, setRecarga] = useState<number>(0);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  async function handleCambiarEstado(
    turnoId: string,
    estado: 'confirmado' | 'atendido' | 'ausente',
  ): Promise<void> {
    setCambiandoId(turnoId);
    setErrorApi(null);
    try {
      await cambiarEstadoTurnoProfesional(turnoId, estado);
      setRecarga((n) => n + 1);
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setCambiandoId(null);
    }
  }

  useEffect(() => {
    let activo = true;
    Promise.all([listarProfesionales(), listarBoxes()])
      .then(([listaProf, listaBoxes]) => {
        if (!activo) return;
        setProfesionales(listaProf);
        setBoxes(listaBoxes);
      })
      .catch(() => {
        // Los filtros opcionales pueden quedar vacíos sin bloquear la agenda.
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!diaDesde || !diaHasta || diaDesde > diaHasta) return;
    let activo = true;
    setCargando(true);
    setErrorApi(null);

    const rango = construirRangoFechasIso(diaDesde, diaHasta);
    listarAgenda({
      ...rango,
      ...(profesionalId ? { profesionalId } : {}),
      ...(boxId ? { boxId } : {}),
    })
      .then((lista) => {
        if (!activo) return;
        setTurnos(lista);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setTurnos([]);
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [diaDesde, diaHasta, profesionalId, boxId, recarga]);

  return (
    <AppLayout
      titulo="Agenda profesional"
      subtitulo="Consultá la agenda del consultorio, actualizá el estado de atención y revisá el historial de cada turno."
      itemsExtra={MENU_PROFESIONAL}
    >
      <div className="prof-stack">
        <section className="prof-card" aria-label="Filtros de agenda">
          <div className="prof-filtros">
            <Campo
              etiqueta="Desde"
              type="date"
              value={diaDesde}
              onChange={(e) => {
                const val = e.target.value;
                setDiaDesde(val);
                if (val > diaHasta) setDiaHasta(val);
              }}
            />
            <Campo
              etiqueta="Hasta"
              type="date"
              min={diaDesde}
              value={diaHasta}
              onChange={(e) => setDiaHasta(e.target.value)}
            />
            <div className="prof-field">
              <label htmlFor="filtro-prof-agenda" className="prof-field__label">
                Filtrar por profesional
              </label>
              <select
                id="filtro-prof-agenda"
                className="prof-select"
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
              >
                <option value="">Todos los profesionales</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="prof-field">
              <label htmlFor="filtro-box-agenda" className="prof-field__label">
                Filtrar por box
              </label>
              <select
                id="filtro-box-agenda"
                className="prof-select"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
              >
                <option value="">Todos los boxes</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {cargando ? <SkeletonTabla filas={4} /> : null}

        {!cargando && !errorApi ? (
          <section className="prof-card" aria-labelledby="titulo-turnos-agenda">
            <div className="prof-card__head">
              <h2 id="titulo-turnos-agenda" className="prof-card__titulo">
                Turnos del período ({turnos.length})
              </h2>
            </div>

            {turnos.length === 0 ? (
              <EstadoVacio
                titulo="Sin turnos en este rango"
                descripcion="No encontramos turnos con los filtros aplicados. Probá ampliar el rango de fechas."
              />
            ) : (
              <div className="prof-tabla-wrap">
                <table className="prof-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Horario</th>
                      <th scope="col">Box</th>
                      <th scope="col">Profesional</th>
                      <th scope="col">Prestación</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnos.map((t) => (
                      <tr key={t.id}>
                        <td data-label="Horario" className="prof-num">
                          {formatearFechaHora(t.inicio)} – {formatearHora(t.fin)}
                        </td>
                        <td data-label="Box">{t.box?.nombre ?? t.boxId}</td>
                        <td data-label="Profesional">{t.profesional?.nombre ?? t.profesionalId}</td>
                        <td data-label="Prestación">{t.prestacion?.nombre ?? t.prestacionId}</td>
                        <td data-label="Paciente">
                          {t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}` : t.pacienteId}
                        </td>
                        <td data-label="Estado">
                          <BadgeEstadoTurno estado={t.estado} />
                        </td>
                        <td data-label="Acciones">
                          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            {t.estado === 'reservado' ? (
                              <Boton
                                variante="primario"
                                disabled={cambiandoId === t.id}
                                onClick={() => {
                                  void handleCambiarEstado(t.id, 'confirmado');
                                }}
                              >
                                Confirmar
                              </Boton>
                            ) : null}
                            {t.estado === 'confirmado' ? (
                              <>
                                <Boton
                                  variante="primario"
                                  disabled={cambiandoId === t.id}
                                  onClick={() => {
                                    void handleCambiarEstado(t.id, 'atendido');
                                  }}
                                >
                                  Marcar atendido
                                </Boton>
                                <Boton
                                  variante="secundario"
                                  disabled={cambiandoId === t.id}
                                  onClick={() => {
                                    void handleCambiarEstado(t.id, 'ausente');
                                  }}
                                >
                                  Marcar ausente
                                </Boton>
                              </>
                            ) : null}
                            <Link
                              to={`/profesional/turnos/${encodeURIComponent(t.id)}/auditoria`}
                              className="wb-btn wb-btn--secundario"
                            >
                              Ver historial
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
}

function ContenidoAuditoria() {
  const { id } = useParams<{ id: string }>();
  const [registros, setRegistros] = useState<readonly AuditoriaTurnoApi[]>([]);
  const [profesionales, setProfesionales] = useState<readonly ProfesionalApi[]>([]);
  const [boxes, setBoxes] = useState<readonly BoxApi[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);

  useEffect(() => {
    if (!id) {
      setCargando(false);
      setErrorApi(new ErrorApi(404, 'NO_ENCONTRADO'));
      return;
    }

    let activo = true;
    setCargando(true);
    setErrorApi(null);

    Promise.all([
      listarAuditoriaTurno(id),
      listarProfesionales().catch((): ProfesionalApi[] => []),
      listarBoxes().catch((): BoxApi[] => []),
    ])
      .then(([lista, listaProf, listaBoxes]) => {
        if (!activo) return;
        setRegistros(lista);
        setProfesionales(Array.isArray(listaProf) ? listaProf : []);
        setBoxes(Array.isArray(listaBoxes) ? listaBoxes : []);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setRegistros([]);
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [id]);

  return (
    <AppLayout
      titulo="Historial del turno"
      subtitulo="Movimientos registrados del turno desde su reserva."
      itemsExtra={MENU_PROFESIONAL}
      acciones={
        <Link to="/profesional/agenda" className="wb-btn wb-btn--secundario">
          Volver a la agenda
        </Link>
      }
    >
      <div className="prof-stack">
        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {cargando ? <SkeletonTabla filas={3} /> : null}

        {!cargando && !errorApi ? (
          <section className="prof-card" aria-labelledby="titulo-auditoria">
            <div className="prof-card__head">
              <div>
                <h2 id="titulo-auditoria" className="prof-card__titulo">
                  Movimientos del turno
                </h2>
                <p className="prof-card__sub">
                  Registro de reserva, cambios de estado, reprogramaciones o cancelación.
                </p>
              </div>
            </div>

            {registros.length === 0 ? (
              <EstadoVacio
                titulo="Sin movimientos registrados"
                descripcion="Este turno todavía no tiene movimientos."
              />
            ) : (
              <div className="prof-timeline">
                {registros.map((reg) => (
                  <article key={reg.id} className="prof-entry">
                    <div className="prof-entry__meta">
                      <strong>{etiquetaAccionMovimiento(reg.accion, reg.detalle)}</strong>
                      <span>
                        Realizado por: {etiquetaActorMovimiento(reg.actor, profesionales)} ·{' '}
                        {formatearFechaHora(reg.fecha)}
                      </span>
                    </div>
                    {renderizarDetalleMovimiento(reg, boxes)}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function AgendaProfesionalPage() {
  return (
    <GuardiaProfesional titulo="Agenda profesional">
      <ContenidoAgenda />
    </GuardiaProfesional>
  );
}

export function AuditoriaTurnoPage() {
  return (
    <GuardiaProfesional titulo="Historial del turno">
      <ContenidoAuditoria />
    </GuardiaProfesional>
  );
}
