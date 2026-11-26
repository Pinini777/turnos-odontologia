import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ErrorApi } from './api';
import { CLINICA } from './clinica';
import {
  AlertaErrorNegocio,
  AvatarIniciales,
  BadgeEstadoTurno,
  Boton,
  EstadoVacio,
  SkeletonTarjetas,
  Tabla,
  type ColumnaTabla,
  type EstadoTurnoUi,
} from './components';
import { Icono } from './iconos';
import { apiConsultorio, useSesion } from './sesion';

const ZONA_CONSULTORIO = 'America/Argentina/Mendoza';

const PROFESIONALES_POR_ID: Readonly<Record<string, string>> = {
  '00000000-0000-4000-8000-000000000101': 'Dra. Ana Pérez',
  '00000000-0000-4000-8000-000000000102': 'Dr. Bruno Gómez',
};

const BOXES_POR_ID: Readonly<Record<string, string>> = {
  '00000000-0000-4000-8000-000000000201': 'Box 1',
  '00000000-0000-4000-8000-000000000202': 'Box 2',
};

const fmtHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const fmtFechaYmd = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CONSULTORIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fmtFechaSubtitulo = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const fmtMesCorto = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  month: 'short',
});

const fmtDiaNumero = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  day: '2-digit',
});

const fmtDiaSemanaCorto = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_CONSULTORIO,
  weekday: 'short',
});

function capitalizar(texto: string): string {
  return texto.length > 0 ? `${texto[0]?.toUpperCase() ?? ''}${texto.slice(1)}` : texto;
}

function horaEnConsultorio(iso: string): string {
  return fmtHora.format(new Date(iso));
}

function fechaLargaEnConsultorio(iso: string): string {
  return capitalizar(fmtFechaSubtitulo.format(new Date(iso)));
}

function sumarUnDiaYmd(fechaYmd: string): string {
  const [yStr, mStr, dStr] = fechaYmd.split('-');
  const utc = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr) + 1));
  const y = String(utc.getUTCFullYear()).padStart(4, '0');
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rangoHoyConsultorio(ahora: Date): { desde: string; hasta: string } {
  const hoy = fmtFechaYmd.format(ahora);
  const manana = sumarUnDiaYmd(hoy);
  return {
    desde: `${hoy}T00:00:00-03:00`,
    hasta: `${manana}T00:00:00-03:00`,
  };
}

interface TurnoAgendaApi {
  readonly id: string;
  readonly profesionalId: string;
  readonly boxId: string;
  readonly prestacionId: string;
  readonly pacienteId: string;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoTurnoUi;
  readonly paciente: { readonly id: string; readonly nombre: string; readonly apellido: string } | null;
  readonly profesional: { readonly id: string; readonly nombre: string } | null;
  readonly box: { readonly id: string; readonly nombre: string } | null;
  readonly prestacion: { readonly id: string; readonly nombre: string; readonly duracionMin: number } | null;
}

interface TurnoPacienteApi {
  readonly id: string;
  readonly profesionalId: string;
  readonly boxId: string;
  readonly pacienteId: string;
  readonly prestacionId: string;
  readonly inicio: string;
  readonly fin: string;
  readonly estado: EstadoTurnoUi;
}

interface PrestacionPublicaApi {
  readonly id: string;
  readonly nombre: string;
  readonly duracionMin: number;
}

interface ProfesionalApi {
  readonly id: string;
  readonly nombre: string;
  readonly usuarioId: string;
}

interface TurnoAgendaFila {
  readonly id: string;
  readonly horario: string;
  readonly box: string;
  readonly profesional: string;
  readonly prestacion: string;
  readonly paciente: string;
  readonly estado: EstadoTurnoUi;
}

function aFilaAgenda(t: TurnoAgendaApi): TurnoAgendaFila {
  const horario = `${horaEnConsultorio(t.inicio)} – ${horaEnConsultorio(t.fin)}`;
  const box = t.box?.nombre ?? BOXES_POR_ID[t.boxId] ?? t.boxId;
  const profesional = t.profesional?.nombre ?? PROFESIONALES_POR_ID[t.profesionalId] ?? t.profesionalId;
  const prestacion = t.prestacion
    ? `${t.prestacion.nombre} (${t.prestacion.duracionMin} min)`
    : t.prestacionId;
  const paciente = t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}` : t.pacienteId;
  return {
    id: t.id,
    horario,
    box,
    profesional,
    prestacion,
    paciente,
    estado: t.estado,
  };
}

const SECCIONES_SECUNDARIAS: Readonly<
  Record<string, { titulo: string; subtitulo: string; descripcion: string }>
> = {
  agenda: {
    titulo: 'Agenda diaria y semanal',
    subtitulo: `${CLINICA.nombre} · Organización por profesional y por box`,
    descripcion:
      'Visualizá los turnos por bloque de 15 minutos, filtrá por box o profesional y registrá nuevos turnos sin superposiciones.',
  },
  pacientes: {
    titulo: 'Pacientes',
    subtitulo: `${CLINICA.nombre} · Padrón de contacto y obra social`,
    descripcion:
      'Buscá pacientes registrados, cargá nuevas fichas para atención telefónica o presencial y actualizá sus datos de contacto.',
  },
  catalogo: {
    titulo: 'Catálogo y prestaciones',
    subtitulo: 'Profesionales, boxes y prestaciones de la clínica',
    descripcion:
      'Administrá prestaciones con su duración en múltiplos de 15 minutos, disponibilidad online y valores actualizados.',
  },
  horarios: {
    titulo: 'Mis horarios y bloqueos',
    subtitulo: 'Franjas de atención semanal y bloqueos de agenda',
    descripcion:
      'Definí tus días y horarios de atención y registrá feriados, ausencias o mantenimiento de box.',
  },
  ganancias: {
    titulo: 'Mis ganancias',
    subtitulo: 'Resumen confidencial de tus turnos atendidos por período',
    descripcion:
      'Consultá el total facturado según el valor vigente al momento de cada reserva, visible exclusivamente para tu cuenta.',
  },
  clinica: {
    titulo: 'Historia clínica y odontograma',
    subtitulo: 'Evoluciones clínicas y registro de piezas dentales',
    descripcion:
      'Consultá el historial de cada paciente y registrá nuevas evoluciones y estados por pieza dental.',
  },
  reservar: {
    titulo: 'Reservar turno online',
    subtitulo: `${CLINICA.nombre} · ${CLINICA.horario}`,
    descripcion:
      'Elegí la prestación, seleccioná el horario disponible que prefieras y recibí la confirmación por correo con enlace a Google Calendar.',
  },
  turnos: {
    titulo: 'Mis turnos',
    subtitulo: 'Historial y próximas visitas programadas',
    descripcion:
      'Consultá tus próximos turnos confirmados, descargá el recordatorio de calendario o reprogramá hasta 24 horas antes.',
  },
  datos: {
    titulo: 'Mis datos personales',
    subtitulo: 'Información de contacto y cobertura médica',
    descripcion:
      'Mantené actualizados tu teléfono y tu obra social para agilizar la atención en recepción.',
  },
};

function construirColumnasConAcciones(
  onCambiarEstado: (id: string, nuevoEstado: 'confirmado' | 'atendido') => void,
): ColumnaTabla<TurnoAgendaFila>[] {
  return [
    { encabezado: 'Horario', render: (t) => t.horario },
    { encabezado: 'Box', render: (t) => t.box },
    { encabezado: 'Profesional', render: (t) => t.profesional },
    { encabezado: 'Prestación', render: (t) => t.prestacion },
    {
      encabezado: 'Paciente',
      render: (t) => (
        <span className="wb-persona-celda">
          <AvatarIniciales nombre={t.paciente} tamano="sm" />
          <span>{t.paciente}</span>
        </span>
      ),
    },
    { encabezado: 'Estado', render: (t) => <BadgeEstadoTurno estado={t.estado} /> },
    {
      encabezado: 'Acción rápida',
      render: (t) => {
        if (t.estado === 'reservado') {
          return (
            <button
              type="button"
              className="wb-accion-fila"
              onClick={() => onCambiarEstado(t.id, 'confirmado')}
            >
              <Icono nombre="check" tamano={14} />
              <span>Confirmar</span>
            </button>
          );
        }
        if (t.estado === 'confirmado') {
          return (
            <button
              type="button"
              className="wb-accion-fila"
              onClick={() => onCambiarEstado(t.id, 'atendido')}
            >
              <Icono nombre="check" tamano={14} />
              <span>Marcar atendido</span>
            </button>
          );
        }
        return (
          <span className="wb-accion-completada">
            <Icono nombre="check" tamano={14} />
            <span>Completado</span>
          </span>
        );
      },
    },
  ];
}

export function InicioPage() {
  const { sesion } = useSesion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [actualizando, setActualizando] = useState(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);

  const [turnosHoy, setTurnosHoy] = useState<readonly TurnoAgendaFila[]>([]);
  const [nombreProfesional, setNombreProfesional] = useState<string>('');
  const [proximoTurnoPaciente, setProximoTurnoPaciente] = useState<TurnoPacienteApi | null>(null);
  const [prestacionesMap, setPrestacionesMap] = useState<ReadonlyMap<string, PrestacionPublicaApi>>(
    () => new Map(),
  );

  const vista = searchParams.get('vista') ?? '';

  const cargarDatos = useCallback(async () => {
    if (!sesion) return;
    setActualizando(true);
    setErrorApi(null);

    try {
      const rolActual = sesion.usuario.rol;
      if (rolActual === 'profesional') {
        const { desde, hasta } = rangoHoyConsultorio(new Date());
        const listaProfs = await apiConsultorio
          .get<ProfesionalApi[]>('/api/profesionales')
          .catch((): ProfesionalApi[] => []);
        const miProf = Array.isArray(listaProfs)
          ? listaProfs.find((p) => p.usuarioId === sesion.usuario.id)
          : undefined;
        if (miProf?.nombre) {
          setNombreProfesional(miProf.nombre);
        }
        const qs = new URLSearchParams({ desde, hasta });
        if (miProf?.id) {
          qs.set('profesionalId', miProf.id);
        }
        const agenda = await apiConsultorio.get<TurnoAgendaApi[]>(`/api/agenda?${qs.toString()}`);
        setTurnosHoy(Array.isArray(agenda) ? agenda.map(aFilaAgenda) : []);
      } else if (rolActual === 'recepcionista') {
        const { desde, hasta } = rangoHoyConsultorio(new Date());
        const qs = new URLSearchParams({ desde, hasta });
        const agenda = await apiConsultorio.get<TurnoAgendaApi[]>(`/api/agenda?${qs.toString()}`);
        setTurnosHoy(Array.isArray(agenda) ? agenda.map(aFilaAgenda) : []);
      } else if (rolActual === 'paciente') {
        const [misTurnos, prestaciones] = await Promise.all([
          apiConsultorio.get<TurnoPacienteApi[]>('/api/paciente/turnos'),
          apiConsultorio
            .get<PrestacionPublicaApi[]>('/api/public/prestaciones')
            .catch((): PrestacionPublicaApi[] => []),
        ]);
        const mapa = new Map<string, PrestacionPublicaApi>();
        if (Array.isArray(prestaciones)) {
          for (const p of prestaciones) mapa.set(p.id, p);
        }
        setPrestacionesMap(mapa);

        const ahoraMs = Date.now();
        const lista = Array.isArray(misTurnos) ? misTurnos : [];
        const activosFuturos = lista.filter(
          (t) =>
            (t.estado === 'reservado' || t.estado === 'confirmado') &&
            Date.parse(t.inicio) > ahoraMs,
        );
        const candidato =
          activosFuturos[0] ??
          lista.find((t) => t.estado === 'reservado' || t.estado === 'confirmado') ??
          null;
        setProximoTurnoPaciente(candidato);
      }
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setActualizando(false);
    }
  }, [sesion]);

  useEffect(() => {
    if (!sesion || vista) return;
    void cargarDatos();
  }, [sesion, vista, cargarDatos]);

  const handleCambiarEstado = useCallback(
    async (id: string, nuevoEstado: 'confirmado' | 'atendido') => {
      setErrorApi(null);
      try {
        await apiConsultorio.post(`/api/turnos/${encodeURIComponent(id)}/estado`, {
          estado: nuevoEstado,
        });
        await cargarDatos();
      } catch (err: unknown) {
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      }
    },
    [cargarDatos],
  );

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  const rol = sesion.usuario.rol;
  const seccion = vista ? SECCIONES_SECUNDARIAS[vista] : undefined;

  if (seccion) {
    return (
      <AppLayout titulo={seccion.titulo} subtitulo={seccion.subtitulo} claveVista={vista}>
        <EstadoVacio
          titulo={seccion.titulo}
          descripcion={seccion.descripcion}
          accion={
            <Boton variante="secundario" onClick={() => void navigate('/inicio')}>
              Volver al resumen
            </Boton>
          }
        />
      </AppLayout>
    );
  }

  if (rol === 'profesional') {
    const confirmados = turnosHoy.filter((t) => t.estado === 'confirmado').length;
    const reservados = turnosHoy.filter((t) => t.estado === 'reservado').length;
    const atendidos = turnosHoy.filter((t) => t.estado === 'atendido').length;
    const proximo = turnosHoy.find(
      (t) => t.estado === 'confirmado' || t.estado === 'reservado',
    );
    const boxAsignado = turnosHoy[0]?.box ?? 'Box 1';
    const saludo = nombreProfesional ? `Buen día, ${nombreProfesional}` : 'Panel del profesional';
    const subtituloHoy = `${fechaLargaEnConsultorio(new Date().toISOString())} · ${CLINICA.nombre}`;
    const columnasProfesional = construirColumnasConAcciones((id, nuevoEstado) => {
      void handleCambiarEstado(id, nuevoEstado);
    });

    return (
      <AppLayout
        titulo={saludo}
        subtitulo={subtituloHoy}
        claveVista="inicio-profesional"
        acciones={
          <Boton
            variante="secundario"
            cargando={actualizando}
            textoCargando="Actualizando…"
            onClick={() => void cargarDatos()}
          >
            Actualizar agenda
          </Boton>
        }
      >
        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {actualizando && turnosHoy.length === 0 ? (
          <SkeletonTarjetas cantidad={3} />
        ) : (
          <div className="wb-cards-grid">
            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 0 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Turnos de hoy</p>
                <span className="wb-card__icono">
                  <Icono nombre="agenda" tamano={18} />
                </span>
              </div>
              <p className="wb-card__valor">{turnosHoy.length}</p>
              <p className="wb-card__texto">
                {confirmados} confirmados · {reservados} por confirmar · {atendidos} atendidos
              </p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 1 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Próximo paciente</p>
                <span className="wb-card__icono wb-card__icono--esmeralda">
                  <Icono nombre="horarios" tamano={18} />
                </span>
              </div>
              <p className="wb-card__valor">
                {proximo ? proximo.horario.split(' ')[0] : 'Sin pendientes'}
              </p>
              <p className="wb-card__texto">
                {proximo
                  ? `${proximo.paciente} · ${proximo.prestacion}`
                  : 'Todos los turnos de hoy fueron atendidos'}
              </p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 2 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Box asignado</p>
                <span className="wb-card__icono">
                  <Icono nombre="box" tamano={18} />
                </span>
              </div>
              <p className="wb-card__valor">{boxAsignado}</p>
              <p className="wb-card__texto">{CLINICA.horario}</p>
            </div>
          </div>
        )}

        <section aria-labelledby="titulo-agenda-profesional">
          <div className="wb-seccion-cab">
            <h2
              id="titulo-agenda-profesional"
              style={{ fontSize: 'var(--text-lg)', margin: 0 }}
            >
              Tu agenda de hoy
            </h2>
          </div>
          <Tabla
            columnas={columnasProfesional}
            filas={turnosHoy}
            claveFila={(t) => t.id}
            cargando={actualizando && turnosHoy.length === 0}
            filasSkeleton={4}
          />
        </section>
      </AppLayout>
    );
  }

  if (rol === 'recepcionista') {
    const pendientesConfirmar = turnosHoy.filter((t) => t.estado === 'reservado').length;
    const turnoBox1 = turnosHoy.find(
      (t) => t.box === 'Box 1' && (t.estado === 'confirmado' || t.estado === 'reservado'),
    );
    const turnoBox2 = turnosHoy.find(
      (t) => t.box === 'Box 2' && (t.estado === 'confirmado' || t.estado === 'reservado'),
    );
    const columnasRecepcion = construirColumnasConAcciones((id, nuevoEstado) => {
      void handleCambiarEstado(id, nuevoEstado);
    });

    return (
      <AppLayout
        titulo={`Recepción · ${CLINICA.nombre}`}
        subtitulo="Estado de los boxes en tiempo real y turnos del día"
        claveVista="inicio-recepcion"
        acciones={
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Boton
              variante="secundario"
              cargando={actualizando}
              textoCargando="Actualizando…"
              onClick={() => void cargarDatos()}
            >
              Actualizar
            </Boton>
            <Boton
              variante="primario"
              onClick={() => void navigate('/recepcion/turnos/nuevo')}
            >
              <Icono nombre="plus" tamano={16} />
              <span>+ Nuevo turno</span>
            </Boton>
          </div>
        }
      >
        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {actualizando && turnosHoy.length === 0 ? (
          <SkeletonTarjetas cantidad={3} />
        ) : (
          <div className="wb-cards-grid">
            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 0 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Estado · Box 1</p>
                <span className="wb-card__icono">
                  <Icono nombre="box" tamano={18} />
                </span>
              </div>
              {turnoBox1 ? (
                <>
                  <div className="wb-estado-box wb-estado-box--ocupado">
                    <BadgeEstadoTurno estado={turnoBox1.estado} />
                    <span>Con turnos hoy</span>
                  </div>
                  <p className="wb-card__texto">
                    {`${turnoBox1.profesional} · ${turnoBox1.paciente} (${turnoBox1.horario})`}
                  </p>
                </>
              ) : (
                <>
                  <div className="wb-estado-box wb-estado-box--libre">
                    <span>Libre ahora</span>
                  </div>
                  <p className="wb-card__texto">Sin turnos pendientes en Box 1</p>
                </>
              )}
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 1 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Estado · Box 2</p>
                <span className="wb-card__icono wb-card__icono--esmeralda">
                  <Icono nombre="check" tamano={18} />
                </span>
              </div>
              {turnoBox2 ? (
                <>
                  <div className="wb-estado-box wb-estado-box--ocupado">
                    <BadgeEstadoTurno estado={turnoBox2.estado} />
                    <span>Con turnos hoy</span>
                  </div>
                  <p className="wb-card__texto">
                    {`${turnoBox2.profesional} · ${turnoBox2.paciente} (${turnoBox2.horario})`}
                  </p>
                </>
              ) : (
                <>
                  <div className="wb-estado-box wb-estado-box--libre">
                    <span>Libre ahora</span>
                  </div>
                  <p className="wb-card__texto">Sin turnos pendientes en Box 2</p>
                </>
              )}
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 2 } as CSSProperties}>
              <div className="wb-card__cab">
                <p className="wb-card__etiqueta">Pendientes de confirmar</p>
                <span className="wb-card__icono wb-card__icono--ambar">
                  <Icono nombre="pendientes" tamano={18} />
                </span>
              </div>
              <p className="wb-card__valor">
                {pendientesConfirmar} {pendientesConfirmar === 1 ? 'turno' : 'turnos'}
              </p>
              <p className="wb-card__texto">
                {pendientesConfirmar === 0
                  ? 'Todos los turnos de hoy están confirmados'
                  : 'Confirmalos con un clic desde la lista de hoy'}
              </p>
            </div>
          </div>
        )}

        <section aria-labelledby="titulo-agenda-recepcion">
          <div className="wb-seccion-cab">
            <h2
              id="titulo-agenda-recepcion"
              style={{ fontSize: 'var(--text-lg)', margin: 0 }}
            >
              Turnos de hoy por box
            </h2>
          </div>
          <Tabla
            columnas={columnasRecepcion}
            filas={turnosHoy}
            claveFila={(t) => t.id}
            cargando={actualizando && turnosHoy.length === 0}
            filasSkeleton={4}
          />
        </section>
      </AppLayout>
    );
  }

  // Vista exclusiva de Paciente conectada a GET /api/paciente/turnos
  const prestacionPaciente = proximoTurnoPaciente
    ? prestacionesMap.get(proximoTurnoPaciente.prestacionId)
    : undefined;
  const tituloPrestacion = prestacionPaciente
    ? `${prestacionPaciente.nombre} (${prestacionPaciente.duracionMin} min)`
    : 'Turno odontológico';
  const nombreProfPaciente = proximoTurnoPaciente
    ? PROFESIONALES_POR_ID[proximoTurnoPaciente.profesionalId] ?? 'Profesional asignado'
    : '';
  const nombreBoxPaciente = proximoTurnoPaciente
    ? BOXES_POR_ID[proximoTurnoPaciente.boxId] ?? 'Box asignado'
    : '';
  const fechaInicioDate = proximoTurnoPaciente ? new Date(proximoTurnoPaciente.inicio) : null;
  const mesCorto = fechaInicioDate
    ? fmtMesCorto.format(fechaInicioDate).replace(/\.$/, '').toUpperCase()
    : '';
  const diaNum = fechaInicioDate ? fmtDiaNumero.format(fechaInicioDate) : '';
  const diaSemCorto = fechaInicioDate
    ? capitalizar(fmtDiaSemanaCorto.format(fechaInicioDate).replace(/\.$/, ''))
    : '';
  const fechaHorarioTexto = proximoTurnoPaciente
    ? `${fechaLargaEnConsultorio(proximoTurnoPaciente.inicio)} · ${horaEnConsultorio(proximoTurnoPaciente.inicio)} a ${horaEnConsultorio(proximoTurnoPaciente.fin)}`
    : '';

  return (
    <AppLayout
      titulo="Tu espacio de turnos"
      subtitulo={`${CLINICA.nombre} · Reservá, consultá o modificá tus visitas`}
      claveVista="inicio-paciente"
      acciones={
        <Boton variante="primario" onClick={() => void navigate('/paciente/reservar')}>
          <Icono nombre="reservar" tamano={16} />
          <span>Reservar nuevo turno</span>
        </Boton>
      }
    >
      {errorApi ? (
        <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
      ) : null}

      <div className="wb-paciente-grid">
        <section
          className="wb-turno-destacado wb-stagger-card"
          style={{ '--stagger-i': 0 } as CSSProperties}
          aria-labelledby="titulo-proximo-turno"
        >
          {proximoTurnoPaciente ? (
            <>
              <div className="wb-turno-destacado__top">
                <div className="wb-turno-cab-izq">
                  <div
                    className="wb-fecha-cal"
                    aria-label={fechaLargaEnConsultorio(proximoTurnoPaciente.inicio)}
                  >
                    <span className="wb-fecha-cal__mes">{mesCorto}</span>
                    <span className="wb-fecha-cal__dia">{diaNum}</span>
                    <span className="wb-fecha-cal__semana">{diaSemCorto}</span>
                  </div>
                  <div>
                    <p className="wb-card__etiqueta" id="titulo-proximo-turno">
                      Tu próximo turno
                    </p>
                    <h2 className="wb-turno-destacado__prestacion">{tituloPrestacion}</h2>
                    <p className="wb-turno-destacado__fecha">{fechaHorarioTexto}</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <BadgeEstadoTurno estado={proximoTurnoPaciente.estado} />
                </div>
              </div>

              <dl className="wb-turno-destacado__detalles">
                <div>
                  <dt>Profesional</dt>
                  <dd>
                    <span className="wb-persona-celda">
                      <AvatarIniciales nombre={nombreProfPaciente} tamano="sm" />
                      <span>{nombreProfPaciente}</span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Consultorio / Box</dt>
                  <dd>{nombreBoxPaciente}</dd>
                </div>
                <div>
                  <dt>Dirección</dt>
                  <dd>{CLINICA.direccion}</dd>
                </div>
              </dl>

              <div className="wb-turno-destacado__acciones">
                <Boton
                  variante="primario"
                  onClick={() =>
                    void navigate(
                      `/paciente/turnos/${encodeURIComponent(proximoTurnoPaciente.id)}/reprogramar`,
                    )
                  }
                >
                  Reprogramar turno
                </Boton>
                <Boton variante="secundario" onClick={() => void navigate('/paciente/turnos')}>
                  Cancelar turno
                </Boton>
              </div>

              <p className="wb-card__texto" style={{ fontSize: 'var(--text-xs)' }}>
                Recordá que podés reprogramar o cancelar online hasta 24 horas antes del horario del
                turno.
              </p>
            </>
          ) : (
            <div>
              <p className="wb-card__etiqueta" id="titulo-proximo-turno">
                Tu próximo turno
              </p>
              <EstadoVacio
                titulo="No tenés turnos pendientes"
                descripcion="Reservá un turno online eligiendo la prestación y el horario disponible que prefieras."
                accion={
                  <Boton variante="primario" onClick={() => void navigate('/paciente/reservar')}>
                    Reservar turno
                  </Boton>
                }
              />
            </div>
          )}
        </section>

        <aside
          className="wb-clinica-card wb-stagger-card"
          style={{ '--stagger-i': 1 } as CSSProperties}
          aria-labelledby="titulo-info-clinica"
        >
          <div className="wb-card__cab" style={{ marginBottom: 0 }}>
            <h2 id="titulo-info-clinica" className="wb-card__titulo" style={{ marginBottom: 0 }}>
              Información de la clínica
            </h2>
            <span className="wb-card__icono">
              <Icono nombre="box" tamano={18} />
            </span>
          </div>

          <ul className="wb-clinica-card__lista">
            <li>
              <span className="wb-clinica-card__clave">Dirección</span>
              <span>{CLINICA.direccion}</span>
            </li>
            <li>
              <span className="wb-clinica-card__clave">Horarios de atención</span>
              <span>{CLINICA.horario}</span>
            </li>
            <li>
              <span className="wb-clinica-card__clave">Teléfono de recepción</span>
              <span>{CLINICA.telefono}</span>
            </li>
            <li>
              <span className="wb-clinica-card__clave">Especialidades</span>
              <div className="wb-chips" style={{ marginTop: '4px' }}>
                {CLINICA.especialidades.map((esp) => (
                  <span key={esp} className="wb-chip-claro">
                    {esp}
                  </span>
                ))}
              </div>
            </li>
            <li>
              <span className="wb-clinica-card__clave">Obras sociales aceptadas</span>
              <div className="wb-chips" style={{ marginTop: '4px' }}>
                {CLINICA.obrasSociales.map((os) => (
                  <span key={os} className="wb-chip-claro">
                    {os}
                  </span>
                ))}
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </AppLayout>
  );
}
