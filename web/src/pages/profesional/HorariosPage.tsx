import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  esBloqueoDiaCompleto,
  fechaLocalADateIso,
  formatearFechaCortaIso,
  formatearFechaHora,
  obtenerAtajosFechaBloqueo,
  OPCIONES_HORA_15,
  sumarMinutosEnGrilla,
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
type FiltroBloqueo = 'todos' | 'profesional' | 'box';

const MOTIVOS_PROFESIONAL: readonly string[] = [
  'Ausencia personal',
  'Capacitación',
  'Feriado',
  'Vacaciones',
];

const MOTIVOS_BOX: readonly string[] = [
  'Mantenimiento de box',
  'Limpieza y desinfección',
  'Falla de equipamiento',
];

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

  const atajosFecha = useMemo(() => obtenerAtajosFechaBloqueo(), []);
  const hoyIso = useMemo(() => fechaLocalADateIso(new Date()), []);
  const [alcance, setAlcance] = useState<AlcanceBloqueo>('profesional');
  const [boxId, setBoxId] = useState<string>('');
  const [diaDesde, setDiaDesde] = useState<string>(hoyIso);
  const [diaHasta, setDiaHasta] = useState<string>(hoyIso);
  const [diaCompleto, setDiaCompleto] = useState<boolean>(true);
  const [horaDesde, setHoraDesde] = useState<string>('08:00');
  const [horaHasta, setHoraHasta] = useState<string>('09:00');
  const [motivo, setMotivo] = useState<string>('');
  const [filtroBloqueos, setFiltroBloqueos] = useState<FiltroBloqueo>('todos');

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
        const primeroActivo = listaBoxes.find((b) => b.activo) ?? listaBoxes[0];
        if (primeroActivo) {
          setBoxId((prev) => prev || primeroActivo.id);
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

  function agregarFranja(diaInicial: DiaSemana = 1): void {
    setFranjas((prev) => [
      ...prev,
      {
        clave: `nueva-${Date.now()}-${prev.length}`,
        diaSemana: diaInicial,
        desde: '09:00',
        hasta: '13:00',
      },
    ]);
  }

  function handleClickDiaSemana(dia: DiaSemana): void {
    const existente = franjas.find((f) => f.diaSemana === dia);
    if (!existente) {
      agregarFranja(dia);
      return;
    }
    const campo = document.getElementById(`desde-${existente.clave}`);
    if (campo instanceof HTMLElement) {
      campo.focus();
    }
  }

  function actualizarFranja(clave: string, cambios: Partial<Omit<FranjaEditable, 'clave'>>): void {
    setFranjas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  function quitarFranja(clave: string): void {
    setFranjas((prev) => prev.filter((f) => f.clave !== clave));
  }

  function handleCambioHoraDesde(nuevaHora: string): void {
    setHoraDesde(nuevaHora);
    if (diaDesde === diaHasta && nuevaHora >= horaHasta) {
      setHoraHasta(sumarMinutosEnGrilla(nuevaHora, 60));
    }
  }

  const rangoDiasInvalido = Boolean(diaDesde && diaHasta && diaHasta < diaDesde);
  const rangoHorarioInvalido = !diaCompleto && diaDesde === diaHasta && horaHasta <= horaDesde;

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

    if (rangoDiasInvalido || rangoHorarioInvalido) {
      return;
    }

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

  const boxesActivos = useMemo(() => boxes.filter((b) => b.activo), [boxes]);
  const boxSeleccionado = boxes.find((b) => b.id === boxId);
  const motivosSugeridos = alcance === 'box' ? MOTIVOS_BOX : MOTIVOS_PROFESIONAL;

  const objetivoResumen =
    alcance === 'box' ? (boxSeleccionado ? boxSeleccionado.nombre : 'Box seleccionado') : 'Mi agenda';
  const fechasResumen =
    diaDesde === diaHasta
      ? formatearFechaCortaIso(diaDesde)
      : `del ${formatearFechaCortaIso(diaDesde)} al ${formatearFechaCortaIso(diaHasta)}`;

  const totalBloqueosPropios = bloqueos.filter((b) => !b.boxId).length;
  const totalBloqueosBox = bloqueos.filter((b) => Boolean(b.boxId)).length;
  const bloqueosFiltrados = bloqueos.filter((b) => {
    if (filtroBloqueos === 'box') return Boolean(b.boxId);
    if (filtroBloqueos === 'profesional') return !b.boxId;
    return true;
  });

  const opcionesAtajoFecha: readonly {
    readonly id: string;
    readonly etiqueta: string;
    readonly desde: string;
    readonly hasta: string;
  }[] = [
    { id: 'hoy', etiqueta: 'Hoy', ...atajosFecha.hoy },
    { id: 'manana', etiqueta: 'Mañana', ...atajosFecha.manana },
    { id: 'esta-semana', etiqueta: 'Esta semana', ...atajosFecha.estaSemana },
    { id: 'proxima-semana', etiqueta: 'Próxima semana', ...atajosFecha.proximaSemana },
  ];

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
                <Boton variante="secundario" onClick={() => agregarFranja(1)}>
                  + Agregar franja
                </Boton>
              </div>

              <div className="prof-semana-strip" role="group" aria-label="Resumen semanal de días">
                {DIAS_SEMANA.map((dia) => {
                  const cantidad = franjas.filter((f) => f.diaSemana === dia.valor).length;
                  const activo = cantidad > 0;
                  return (
                    <button
                      key={dia.valor}
                      type="button"
                      className={`prof-semana-dia ${activo ? 'prof-semana-dia--activo' : ''}`}
                      aria-pressed={activo}
                      title={
                        activo
                          ? `${dia.etiqueta}: ${cantidad} ${cantidad === 1 ? 'franja configurada' : 'franjas configuradas'}`
                          : `Agregar franja 09:00–13:00 para ${dia.etiqueta}`
                      }
                      onClick={() => handleClickDiaSemana(dia.valor)}
                    >
                      <span className="prof-semana-dia__nombre">{dia.corta}</span>
                      <span className="prof-semana-dia__estado">
                        {activo ? `${cantidad} ${cantidad === 1 ? 'franja' : 'franjas'}` : 'Libre'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form className="prof-form" onSubmit={(e) => void handleGuardarHorarios(e)}>
                {franjas.length === 0 ? (
                  <EstadoVacio
                    titulo="Sin franjas horarias cargadas"
                    descripcion="Tocá un día en la barra superior o agregá una franja semanal para habilitar turnos en tu agenda."
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
                    Elegí si el bloqueo aplica a tu agenda personal o a un box del consultorio.
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
                    <span className="prof-radio-card__contenido">
                      <span className="prof-radio-card__titulo">Mi agenda (profesional)</span>
                      <span className="prof-radio-card__desc">
                        Ausencias, vacaciones o feriados propios
                      </span>
                    </span>
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
                    <span className="prof-radio-card__contenido">
                      <span className="prof-radio-card__titulo">Un box del consultorio</span>
                      <span className="prof-radio-card__desc">
                        Mantenimiento, limpieza o falla de un box
                      </span>
                    </span>
                  </label>
                </div>

                {alcance === 'box' ? (
                  <div className="prof-field">
                    <label htmlFor="bloqueo-box" className="prof-field__label">
                      Box a bloquear
                    </label>
                    {boxesActivos.length > 0 ? (
                      <div className="prof-chip-row" role="group" aria-label="Boxes activos">
                        {boxesActivos.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={`prof-chip ${boxId === b.id ? 'prof-chip--activo' : ''}`}
                            aria-pressed={boxId === b.id}
                            onClick={() => setBoxId(b.id)}
                          >
                            {b.nombre}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <select
                      id="bloqueo-box"
                      aria-label="Box a bloquear"
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

                <div className="prof-bloqueo-grupo">
                  <span className="prof-bloqueo-grupo__eyebrow">Atajos de fecha</span>
                  <div className="prof-chip-row" role="group" aria-label="Atajos de fecha">
                    {opcionesAtajoFecha.map((atajo) => {
                      const seleccionado = diaDesde === atajo.desde && diaHasta === atajo.hasta;
                      return (
                        <button
                          key={atajo.id}
                          type="button"
                          className={`prof-chip ${seleccionado ? 'prof-chip--activo' : ''}`}
                          aria-pressed={seleccionado}
                          onClick={() => {
                            setDiaDesde(atajo.desde);
                            setDiaHasta(atajo.hasta);
                          }}
                        >
                          {atajo.etiqueta}
                        </button>
                      );
                    })}
                  </div>

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
                  {rangoDiasInvalido ? (
                    <p className="prof-inline-error" aria-live="polite">
                      El día hasta debe ser igual o posterior al día desde.
                    </p>
                  ) : null}
                </div>

                <div className="prof-bloqueo-modo">
                  <label
                    className={`prof-check prof-bloqueo-modo__check ${
                      diaCompleto ? 'prof-bloqueo-modo__check--activo' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={diaCompleto}
                      onChange={(e) => setDiaCompleto(e.target.checked)}
                    />
                    <span>Bloquear día completo</span>
                  </label>
                  <button
                    type="button"
                    className={`prof-bloqueo-modo__btn ${
                      !diaCompleto ? 'prof-bloqueo-modo__btn--activo' : ''
                    }`}
                    aria-pressed={!diaCompleto}
                    onClick={() => setDiaCompleto(false)}
                  >
                    Elegir franja horaria
                  </button>
                </div>

                {!diaCompleto ? (
                  <div className="prof-bloqueo-horas">
                    <div className="prof-chip-row" role="group" aria-label="Presets de horario">
                      <button
                        type="button"
                        className={`prof-chip ${
                          horaDesde === '08:00' && horaHasta === '13:00' ? 'prof-chip--activo' : ''
                        }`}
                        onClick={() => {
                          setHoraDesde('08:00');
                          setHoraHasta('13:00');
                        }}
                      >
                        Mañana 08:00–13:00
                      </button>
                      <button
                        type="button"
                        className={`prof-chip ${
                          horaDesde === '14:00' && horaHasta === '20:00' ? 'prof-chip--activo' : ''
                        }`}
                        onClick={() => {
                          setHoraDesde('14:00');
                          setHoraHasta('20:00');
                        }}
                      >
                        Tarde 14:00–20:00
                      </button>
                      <button
                        type="button"
                        className="prof-chip"
                        onClick={() => setHoraHasta(sumarMinutosEnGrilla(horaDesde, 60))}
                      >
                        +1 h
                      </button>
                      <button
                        type="button"
                        className="prof-chip"
                        onClick={() => setHoraHasta(sumarMinutosEnGrilla(horaDesde, 120))}
                      >
                        +2 h
                      </button>
                    </div>

                    <div className="prof-form-row">
                      <div className="prof-field">
                        <label htmlFor="bloqueo-hora-desde" className="prof-field__label">
                          Hora desde
                        </label>
                        <select
                          id="bloqueo-hora-desde"
                          className="prof-select"
                          value={horaDesde}
                          onChange={(e) => handleCambioHoraDesde(e.target.value)}
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

                    {rangoHorarioInvalido ? (
                      <p className="prof-inline-error" aria-live="polite">
                        La hora de fin debe ser posterior a la hora de inicio.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="prof-bloqueo-grupo">
                  <Campo
                    etiqueta="Motivo del bloqueo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej. Congreso odontológico o mantenimiento de box"
                    required
                  />
                  <div className="prof-chip-row" role="group" aria-label="Motivos frecuentes">
                    {motivosSugeridos.map((sugerencia) => (
                      <button
                        key={sugerencia}
                        type="button"
                        className={`prof-chip ${motivo === sugerencia ? 'prof-chip--activo' : ''}`}
                        aria-pressed={motivo === sugerencia}
                        onClick={() => setMotivo(sugerencia)}
                      >
                        {sugerencia}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="prof-bloqueo-preview" data-testid="bloqueo-preview" aria-live="polite">
                  <span className="prof-bloqueo-preview__eyebrow">Vista previa del bloqueo</span>
                  <p className="prof-bloqueo-preview__texto">
                    Vas a bloquear <strong>{objetivoResumen}</strong> ·{' '}
                    <strong>{fechasResumen}</strong>
                    {diaCompleto ? (
                      ' (día completo)'
                    ) : (
                      <>
                        {' '}
                        de <strong>{horaDesde} a {horaHasta}</strong>
                      </>
                    )}
                    {motivo.trim() ? ` — ${motivo.trim()}` : null}
                  </p>
                </div>

                <Boton
                  type="submit"
                  cargando={guardandoBloqueo}
                  disabled={rangoDiasInvalido || rangoHorarioInvalido}
                >
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

              {bloqueos.length > 0 ? (
                <div
                  className="prof-chip-row"
                  role="group"
                  aria-label="Filtrar bloqueos por alcance"
                >
                  <button
                    type="button"
                    className={`prof-chip ${filtroBloqueos === 'todos' ? 'prof-chip--activo' : ''}`}
                    aria-pressed={filtroBloqueos === 'todos'}
                    onClick={() => setFiltroBloqueos('todos')}
                  >
                    Todos ({bloqueos.length})
                  </button>
                  <button
                    type="button"
                    className={`prof-chip ${filtroBloqueos === 'profesional' ? 'prof-chip--activo' : ''}`}
                    aria-pressed={filtroBloqueos === 'profesional'}
                    onClick={() => setFiltroBloqueos('profesional')}
                  >
                    Mi agenda ({totalBloqueosPropios})
                  </button>
                  <button
                    type="button"
                    className={`prof-chip ${filtroBloqueos === 'box' ? 'prof-chip--activo' : ''}`}
                    aria-pressed={filtroBloqueos === 'box'}
                    onClick={() => setFiltroBloqueos('box')}
                  >
                    Boxes ({totalBloqueosBox})
                  </button>
                </div>
              ) : null}
            </div>

            {bloqueos.length === 0 ? (
              <EstadoVacio
                titulo="No hay bloqueos activos"
                descripcion="Los feriados, ausencias o mantenimientos de box aparecerán en este listado."
              />
            ) : bloqueosFiltrados.length === 0 ? (
              <EstadoVacio
                titulo="Sin bloqueos en esta categoría"
                descripcion="Probá seleccionar otro filtro para ver el resto de los bloqueos vigentes."
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
                    {bloqueosFiltrados.map((b) => {
                      const esBox = Boolean(b.boxId);
                      const completo = esBloqueoDiaCompleto(b.inicio, b.fin);
                      return (
                        <tr key={b.id}>
                          <td data-label="Alcance">
                            <div className="prof-bloqueo-alcance-cell">
                              <span
                                className={`prof-badge-alcance ${
                                  esBox ? 'prof-badge-alcance--box' : 'prof-badge-alcance--propio'
                                }`}
                              >
                                {esBox ? 'Box' : 'Mi agenda'}
                              </span>
                              <span>{nombreAlcance(b)}</span>
                              {completo ? (
                                <span className="prof-badge-dia-completo">Día completo</span>
                              ) : null}
                            </div>
                          </td>
                          <td data-label="Inicio" className="prof-num">
                            {formatearFechaHora(b.inicio)}
                          </td>
                          <td data-label="Fin" className="prof-num">
                            {formatearFechaHora(b.fin)}
                          </td>
                          <td data-label="Motivo">{b.motivo}</td>
                          <td data-label="Acciones">
                            <Boton
                              variante="peligro"
                              onClick={() => void handleEliminarBloqueo(b.id)}
                            >
                              Eliminar
                            </Boton>
                          </td>
                        </tr>
                      );
                    })}
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
