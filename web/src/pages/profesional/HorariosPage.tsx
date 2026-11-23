import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, Campo, EstadoVacio, SkeletonTabla } from '../../base/components';
import {
  crearBloqueo,
  eliminarBloqueo,
  guardarHorariosProfesional,
  listarBloqueos,
  listarBoxes,
  listarHorariosProfesional,
  type BloqueoAgendaApi,
  type BoxApi,
  type FranjaHorarioInput,
} from './apiProfesional';
import {
  construirRangoBloqueo,
  DIAS_SEMANA,
  fechaLocalADateIso,
  formatearFechaHora,
  OPCIONES_HORA_15,
  type DiaSemana,
} from './formatos';
import { GuardiaProfesional } from './GuardiaProfesional';
import { MENU_PROFESIONAL } from './menuProfesional';
import { useProfesionalActual } from './useProfesionalActual';

interface FranjaEditable {
  readonly clave: string;
  readonly diaSemana: DiaSemana;
  readonly desde: string;
  readonly hasta: string;
}

type AlcanceBloqueo = 'profesional' | 'box';

function ContenidoHorarios() {
  const { profesional, cargando: cargandoProf, error: errorProf } = useProfesionalActual();
  const [franjas, setFranjas] = useState<readonly FranjaEditable[]>([]);
  const [bloqueos, setBloqueos] = useState<readonly BloqueoAgendaApi[]>([]);
  const [boxes, setBoxes] = useState<readonly BoxApi[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState<boolean>(false);
  const [guardandoHorarios, setGuardandoHorarios] = useState<boolean>(false);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState<boolean>(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const hoyIso = fechaLocalADateIso(new Date());
  const [alcance, setAlcance] = useState<AlcanceBloqueo>('profesional');
  const [boxId, setBoxId] = useState<string>('');
  const [diaDesde, setDiaDesde] = useState<string>(hoyIso);
  const [diaHasta, setDiaHasta] = useState<string>(hoyIso);
  const [diaCompleto, setDiaCompleto] = useState<boolean>(true);
  const [horaDesde, setHoraDesde] = useState<string>('08:00');
  const [horaHasta, setHoraHasta] = useState<string>('09:00');
  const [motivo, setMotivo] = useState<string>('');

  useEffect(() => {
    if (!profesional) return;
    let activo = true;
    setCargandoDatos(true);
    setErrorApi(null);

    Promise.all([
      listarHorariosProfesional(profesional.id),
      listarBloqueos(),
      listarBoxes(),
    ])
      .then(([listaHorarios, listaBloqueos, listaBoxes]) => {
        if (!activo) return;
        setFranjas(
          listaHorarios.map((h, idx) => ({
            clave: h.id || `franja-${idx}`,
            diaSemana: h.diaSemana,
            desde: h.desde,
            hasta: h.hasta,
          })),
        );
        setBloqueos(listaBloqueos);
        setBoxes(listaBoxes);
        if (listaBoxes[0]) {
          setBoxId((prev) => prev || listaBoxes[0]!.id);
        }
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargandoDatos(false);
      });

    return () => {
      activo = false;
    };
  }, [profesional]);

  function agregarFranja(): void {
    setFranjas((prev) => [
      ...prev,
      {
        clave: `nueva-${Date.now()}-${prev.length}`,
        diaSemana: 1,
        desde: '09:00',
        hasta: '13:00',
      },
    ]);
  }

  function actualizarFranja(clave: string, cambios: Partial<Omit<FranjaEditable, 'clave'>>): void {
    setFranjas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function quitarFranja(clave: string): void {
    setFranjas((prev) => prev.filter((f) => f.clave !== clave));
  }

  async function handleGuardarHorarios(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!profesional) return;
    setErrorApi(null);
    setExito(null);
    setGuardandoHorarios(true);

    const payload: FranjaHorarioInput[] = franjas.map((f) => ({
      diaSemana: f.diaSemana,
      desde: f.desde,
      hasta: f.hasta,
    }));

    try {
      const guardados = await guardarHorariosProfesional(profesional.id, payload);
      setFranjas(
        guardados.map((h, idx) => ({
          clave: h.id || `guardada-${idx}`,
          diaSemana: h.diaSemana,
          desde: h.desde,
          hasta: h.hasta,
        })),
      );
      setExito('Horarios guardados correctamente.');
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardandoHorarios(false);
    }
  }

  async function handleCrearBloqueo(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!profesional) return;
    setErrorApi(null);
    setExito(null);

    if (!motivo.trim() || !diaDesde || !diaHasta) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }
    if (alcance === 'box' && !boxId) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }

    const rango = construirRangoBloqueo({
      diaDesde,
      diaHasta,
      diaCompleto,
      horaDesde,
      horaHasta,
    });

    const payload =
      alcance === 'profesional'
        ? {
            profesionalId: profesional.id,
            inicio: rango.inicio,
            fin: rango.fin,
            motivo: motivo.trim(),
          }
        : {
            boxId,
            inicio: rango.inicio,
            fin: rango.fin,
            motivo: motivo.trim(),
          };

    setGuardandoBloqueo(true);
    try {
      const creado = await crearBloqueo(payload);
      setBloqueos((prev) => [...prev, creado]);
      setMotivo('');
      setExito('Bloqueo registrado correctamente.');
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardandoBloqueo(false);
    }
  }

  async function handleEliminarBloqueo(id: string): Promise<void> {
    setErrorApi(null);
    setExito(null);
    try {
      await eliminarBloqueo(id);
      setBloqueos((prev) => prev.filter((b) => b.id !== id));
      setExito('Bloqueo eliminado.');
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    }
  }

  function nombreAlcance(b: BloqueoAgendaApi): string {
    if (b.boxId) {
      const box = boxes.find((item) => item.id === b.boxId);
      return box ? box.nombre : `Box (${b.boxId})`;
    }
    if (profesional && b.profesionalId === profesional.id) {
      return `Mi agenda (${profesional.nombre})`;
    }
    return b.profesionalId ? `Profesional (${b.profesionalId})` : 'Agenda';
  }

  const cargando = cargandoProf || cargandoDatos;
  const errorActivo = errorApi ?? errorProf;

  return (
    <AppLayout
      titulo="Mis horarios y bloqueos"
      subtitulo="Configurá tus franjas semanales en bloques de 15 minutos y registrá bloqueos propios o de un box."
      itemsExtra={MENU_PROFESIONAL}
    >
      <div className="prof-stack">
        {errorActivo ? (
          <AlertaErrorNegocio code={errorActivo.code} detalles={errorActivo.detalles} />
        ) : null}

        {exito ? (
          <div className="prof-banner-exito" role="status" aria-live="polite">
            {exito}
          </div>
        ) : null}

        {cargando ? <SkeletonTabla filas={4} /> : null}

        {!cargando && profesional ? (
          <div className="prof-grid-2">
            {/* HORARIOS SEMANALES */}
            <section className="prof-card" aria-labelledby="titulo-horarios">
              <div className="prof-card__head">
                <div>
                  <h2 id="titulo-horarios" className="prof-card__titulo">
                    Mis horarios semanales
                  </h2>
                  <p className="prof-card__sub">
                    Grilla estricta de 15 minutos (:00, :15, :30 y :45) para {profesional.nombre}.
                  </p>
                </div>
                <Boton variante="secundario" onClick={agregarFranja}>
                  + Agregar franja
                </Boton>
              </div>

              <form className="prof-form" onSubmit={(e) => void handleGuardarHorarios(e)}>
                {franjas.length === 0 ? (
                  <EstadoVacio
                    titulo="Sin franjas horarias cargadas"
                    descripcion="Agregá al menos una franja semanal para habilitar turnos en tu agenda."
                  />
                ) : (
                  franjas.map((franja, idx) => (
                    <div key={franja.clave} className="prof-franja-row">
                      <div className="prof-field">
                        <label htmlFor={`dia-${franja.clave}`} className="prof-field__label">
                          Día franja {idx + 1}
                        </label>
                        <select
                          id={`dia-${franja.clave}`}
                          className="prof-select"
                          value={franja.diaSemana}
                          onChange={(e) =>
                            actualizarFranja(franja.clave, {
                              diaSemana: Number(e.target.value) as DiaSemana,
                            })
                          }
                        >
                          {DIAS_SEMANA.map((d) => (
                            <option key={d.valor} value={d.valor}>
                              {d.etiqueta}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="prof-field">
                        <label htmlFor={`desde-${franja.clave}`} className="prof-field__label">
                          Desde franja {idx + 1}
                        </label>
                        <select
                          id={`desde-${franja.clave}`}
                          className="prof-select"
                          value={franja.desde}
                          onChange={(e) =>
                            actualizarFranja(franja.clave, { desde: e.target.value })
                          }
                        >
                          {OPCIONES_HORA_15.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="prof-field">
                        <label htmlFor={`hasta-${franja.clave}`} className="prof-field__label">
                          Hasta franja {idx + 1}
                        </label>
                        <select
                          id={`hasta-${franja.clave}`}
                          className="prof-select"
                          value={franja.hasta}
                          onChange={(e) =>
                            actualizarFranja(franja.clave, { hasta: e.target.value })
                          }
                        >
                          {OPCIONES_HORA_15.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Boton variante="fantasma" onClick={() => quitarFranja(franja.clave)}>
                        Quitar
                      </Boton>
                    </div>
                  ))
                )}

                <div className="prof-acciones">
                  <Boton type="submit" cargando={guardandoHorarios}>
                    Guardar horarios
                  </Boton>
                </div>
              </form>
            </section>

            {/* BLOQUEOS DE AGENDA */}
            <aside className="prof-card" aria-labelledby="titulo-bloqueos">
              <div className="prof-card__head">
                <div>
                  <h2 id="titulo-bloqueos" className="prof-card__titulo">
                    Nuevo bloqueo de agenda
                  </h2>
                  <p className="prof-card__sub">
                    Bloqueá tu agenda personal o un box del consultorio (exclusión mutua).
                  </p>
                </div>
              </div>

              <form className="prof-form" onSubmit={(e) => void handleCrearBloqueo(e)}>
                <div className="prof-radio-group" role="radiogroup" aria-label="Alcance del bloqueo">
                  <label
                    className={`prof-radio-card ${alcance === 'profesional' ? 'prof-radio-card--activo' : ''}`}
                  >
                    <input
                      type="radio"
                      name="alcance-bloqueo"
                      value="profesional"
                      checked={alcance === 'profesional'}
                      onChange={() => setAlcance('profesional')}
                    />
                    <span>Mi agenda (profesional)</span>
                  </label>

                  <label
                    className={`prof-radio-card ${alcance === 'box' ? 'prof-radio-card--activo' : ''}`}
                  >
                    <input
                      type="radio"
                      name="alcance-bloqueo"
                      value="box"
                      checked={alcance === 'box'}
                      onChange={() => setAlcance('box')}
                    />
                    <span>Un box del consultorio</span>
                  </label>
                </div>

                {alcance === 'box' ? (
                  <div className="prof-field">
                    <label htmlFor="bloqueo-box" className="prof-field__label">
                      Box a bloquear
                    </label>
                    <select
                      id="bloqueo-box"
                      className="prof-select"
                      value={boxId}
                      onChange={(e) => setBoxId(e.target.value)}
                    >
                      {boxes.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="prof-form-row">
                  <Campo
                    etiqueta="Día desde"
                    type="date"
                    value={diaDesde}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDiaDesde(val);
                      if (val > diaHasta) setDiaHasta(val);
                    }}
                    required
                  />
                  <Campo
                    etiqueta="Día hasta"
                    type="date"
                    min={diaDesde}
                    value={diaHasta}
                    onChange={(e) => setDiaHasta(e.target.value)}
                    required
                  />
                </div>

                <label className="prof-check">
                  <input
                    type="checkbox"
                    checked={diaCompleto}
                    onChange={(e) => setDiaCompleto(e.target.checked)}
                  />
                  <span>Bloquear día completo</span>
                </label>

                {!diaCompleto ? (
                  <div className="prof-form-row">
                    <div className="prof-field">
                      <label htmlFor="bloqueo-hora-desde" className="prof-field__label">
                        Hora desde
                      </label>
                      <select
                        id="bloqueo-hora-desde"
                        className="prof-select"
                        value={horaDesde}
                        onChange={(e) => setHoraDesde(e.target.value)}
                      >
                        {OPCIONES_HORA_15.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="prof-field">
                      <label htmlFor="bloqueo-hora-hasta" className="prof-field__label">
                        Hora hasta
                      </label>
                      <select
                        id="bloqueo-hora-hasta"
                        className="prof-select"
                        value={horaHasta}
                        onChange={(e) => setHoraHasta(e.target.value)}
                      >
                        {OPCIONES_HORA_15.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <Campo
                  etiqueta="Motivo del bloqueo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Congreso odontológico o mantenimiento de box"
                  required
                />

                <Boton type="submit" cargando={guardandoBloqueo}>
                  Registrar bloqueo
                </Boton>
              </form>
            </aside>
          </div>
        ) : null}

        {!cargando && profesional ? (
          <section className="prof-card" aria-labelledby="titulo-lista-bloqueos">
            <div className="prof-card__head">
              <h2 id="titulo-lista-bloqueos" className="prof-card__titulo">
                Bloqueos vigentes ({bloqueos.length})
              </h2>
            </div>

            {bloqueos.length === 0 ? (
              <EstadoVacio
                titulo="No hay bloqueos activos"
                descripcion="Los feriados, ausencias o mantenimientos de box aparecerán en este listado."
              />
            ) : (
              <div className="prof-tabla-wrap">
                <table className="prof-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Alcance</th>
                      <th scope="col">Inicio</th>
                      <th scope="col">Fin</th>
                      <th scope="col">Motivo</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloqueos.map((b) => (
                      <tr key={b.id}>
                        <td data-label="Alcance">{nombreAlcance(b)}</td>
                        <td data-label="Inicio" className="prof-num">
                          {formatearFechaHora(b.inicio)}
                        </td>
                        <td data-label="Fin" className="prof-num">
                          {formatearFechaHora(b.fin)}
                        </td>
                        <td data-label="Motivo">{b.motivo}</td>
                        <td data-label="Acciones">
                          <Boton variante="peligro" onClick={() => void handleEliminarBloqueo(b.id)}>
                            Eliminar
                          </Boton>
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

export function HorariosPage() {
  return (
    <GuardiaProfesional titulo="Mis horarios y bloqueos">
      <ContenidoHorarios />
    </GuardiaProfesional>
  );
}
