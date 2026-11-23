import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi } from '../../base/api';
import {
  AlertaErrorNegocio,
  BadgeEstadoTurno,
  Campo,
  EstadoVacio,
  SkeletonTabla,
} from '../../base/components';
import {
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
  }, [diaDesde, diaHasta, profesionalId, boxId]);

  return (
    <AppLayout
      titulo="Agenda profesional"
      subtitulo="Consultá la agenda del consultorio y accedé al historial de auditoría inmutable de cada turno."
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
                      <th scope="col">Auditoría</th>
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
                        <td data-label="Auditoría">
                          <Link
                            to={`/profesional/turnos/${encodeURIComponent(t.id)}/auditoria`}
                            className="wb-btn wb-btn--secundario"
                          >
                            Ver auditoría
                          </Link>
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

    listarAuditoriaTurno(id)
      .then((lista) => {
        if (!activo) return;
        setRegistros(lista);
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
      titulo="Auditoría del turno"
      subtitulo={id ? `Cronología inmutable de eventos del turno #${id}.` : 'Cronología inmutable de eventos.'}
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
                  Historial de auditoría (solo lectura)
                </h2>
                <p className="prof-card__sub">
                  Registro append-only: conserva cada creación, reprogramación, cambio de estado o cancelación.
                </p>
              </div>
            </div>

            {registros.length === 0 ? (
              <EstadoVacio
                titulo="Sin registros de auditoría"
                descripcion="Este turno todavía no tiene eventos registrados."
              />
            ) : (
              <div className="prof-timeline">
                {registros.map((reg) => (
                  <article key={reg.id} className="prof-entry">
                    <div className="prof-entry__meta">
                      <strong>Acción: {reg.accion}</strong>
                      <span>
                        Actor: {reg.actor} · {formatearFechaHora(reg.fecha)}
                      </span>
                    </div>
                    <pre className="prof-auditoria-detalle">
                      {JSON.stringify(reg.detalle, null, 2)}
                    </pre>
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
    <GuardiaProfesional titulo="Auditoría del turno">
      <ContenidoAuditoria />
    </GuardiaProfesional>
  );
}
