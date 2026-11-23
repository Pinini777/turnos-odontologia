import { useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { CLINICA } from './clinica';
import {
  BadgeEstadoTurno,
  Boton,
  EstadoVacio,
  SkeletonTarjetas,
  Tabla,
  type ColumnaTabla,
  type EstadoTurnoUi,
} from './components';
import { useSesion } from './sesion';

interface TurnoAgenda {
  readonly id: string;
  readonly horario: string;
  readonly box: string;
  readonly profesional: string;
  readonly prestacion: string;
  readonly paciente: string;
  readonly estado: EstadoTurnoUi;
}

const AGENDA_PROFESIONAL: readonly TurnoAgenda[] = [
  {
    id: 'p-1',
    horario: '09:00 – 09:30',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Consulta odontológica (30 min)',
    paciente: 'Lucía Fernández',
    estado: 'atendido',
  },
  {
    id: 'p-2',
    horario: '09:30 – 10:15',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Limpieza dental (45 min)',
    paciente: 'Martín Quiroga',
    estado: 'confirmado',
  },
  {
    id: 'p-3',
    horario: '10:15 – 10:45',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Control de ortodoncia (30 min)',
    paciente: 'Sofía Morales',
    estado: 'confirmado',
  },
  {
    id: 'p-4',
    horario: '11:00 – 12:00',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Endodoncia (60 min)',
    paciente: 'Tomás Benítez',
    estado: 'reservado',
  },
];

const AGENDA_RECEPCION: readonly TurnoAgenda[] = [
  {
    id: 'r-1',
    horario: '09:00 – 09:30',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Consulta odontológica (30 min)',
    paciente: 'Lucía Fernández',
    estado: 'confirmado',
  },
  {
    id: 'r-2',
    horario: '09:30 – 10:15',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Limpieza dental (45 min)',
    paciente: 'Martín Quiroga',
    estado: 'reservado',
  },
  {
    id: 'r-3',
    horario: '10:00 – 10:15',
    box: 'Box 2',
    profesional: 'Dr. Bruno Gómez',
    prestacion: 'Control post-tratamiento (15 min)',
    paciente: 'Sofía Morales',
    estado: 'confirmado',
  },
  {
    id: 'r-4',
    horario: '10:15 – 10:45',
    box: 'Box 2',
    profesional: 'Dr. Bruno Gómez',
    prestacion: 'Consulta odontológica (30 min)',
    paciente: 'Valentina Arias',
    estado: 'reservado',
  },
];

const COLUMNAS_AGENDA: readonly ColumnaTabla<TurnoAgenda>[] = [
  { encabezado: 'Horario', render: (t) => t.horario },
  { encabezado: 'Box', render: (t) => t.box },
  { encabezado: 'Profesional', render: (t) => t.profesional },
  { encabezado: 'Prestación', render: (t) => t.prestacion },
  { encabezado: 'Paciente', render: (t) => t.paciente },
  { encabezado: 'Estado', render: (t) => <BadgeEstadoTurno estado={t.estado} /> },
];

const SECCIONES_SECUNDARIAS: Readonly<
  Record<string, { titulo: string; subtitulo: string; descripcion: string }>
> = {
  agenda: {
    titulo: 'Agenda diaria y semanal',
    subtitulo: `${CLINICA.nombre} · Organización por profesional y por box`,
    descripcion: 'Visualizá los turnos por bloque de 15 minutos, filtrá por box o profesional y registrá nuevos turnos sin superposiciones.',
  },
  pacientes: {
    titulo: 'Pacientes',
    subtitulo: `${CLINICA.nombre} · Padrón de contacto y obra social`,
    descripcion: 'Buscá pacientes registrados, cargá nuevas fichas para atención telefónica o presencial y actualizá sus datos de contacto.',
  },
  catalogo: {
    titulo: 'Catálogo y prestaciones',
    subtitulo: 'Profesionales, boxes y prestaciones de la clínica',
    descripcion: 'Administrá prestaciones con su duración en múltiplos de 15 minutos, disponibilidad online y valores actualizados.',
  },
  horarios: {
    titulo: 'Mis horarios y bloqueos',
    subtitulo: 'Franjas de atención semanal y bloqueos de agenda',
    descripcion: 'Definí tus días y horarios de atención y registrá feriados, ausencias o mantenimiento de box.',
  },
  ganancias: {
    titulo: 'Mis ganancias',
    subtitulo: 'Resumen confidencial de tus turnos atendidos por período',
    descripcion: 'Consultá el total facturado según el valor vigente al momento de cada reserva, visible exclusivamente para tu cuenta.',
  },
  clinica: {
    titulo: 'Historia clínica y odontograma',
    subtitulo: 'Evoluciones clínicas y registro de piezas dentales',
    descripcion: 'Consultá el historial de cada paciente y registrá nuevas evoluciones y estados por pieza dental.',
  },
  reservar: {
    titulo: 'Reservar turno online',
    subtitulo: `${CLINICA.nombre} · ${CLINICA.horario}`,
    descripcion: 'Elegí la prestación, seleccioná el horario disponible que prefieras y recibí la confirmación por correo con enlace a Google Calendar.',
  },
  turnos: {
    titulo: 'Mis turnos',
    subtitulo: 'Historial y próximas visitas programadas',
    descripcion: 'Consultá tus próximos turnos confirmados, descargá el recordatorio de calendario o reprogramá hasta 24 horas antes.',
  },
  datos: {
    titulo: 'Mis datos personales',
    subtitulo: 'Información de contacto y cobertura médica',
    descripcion: 'Mantené actualizados tu teléfono y tu obra social para agilizar la atención en recepción.',
  },
};

function saludoProfesional(email: string): string {
  if (email.toLowerCase().includes('profesional2')) return 'Buen día, Dr. Bruno Gómez';
  return 'Buen día, Dra. Ana Pérez';
}

function boxProfesional(email: string): string {
  if (email.toLowerCase().includes('profesional2')) return 'Box 2';
  return 'Box 1';
}

export function InicioPage() {
  const { sesion } = useSesion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [aviso, setAviso] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState(false);

  const vista = searchParams.get('vista') ?? '';

  useEffect(() => {
    setAviso(null);
  }, [vista]);

  useEffect(() => {
    if (!actualizando) return;
    const timer = window.setTimeout(() => setActualizando(false), 260);
    return () => window.clearTimeout(timer);
  }, [actualizando]);

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  const rol = sesion.usuario.rol;
  const seccion = vista ? SECCIONES_SECUNDARIAS[vista] : undefined;

  if (seccion) {
    return (
      <AppLayout
        titulo={seccion.titulo}
        subtitulo={seccion.subtitulo}
        claveVista={vista}
      >
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
    const boxAsignado = boxProfesional(sesion.usuario.email);
    return (
      <AppLayout
        titulo={saludoProfesional(sesion.usuario.email)}
        subtitulo={`Lunes 23 de noviembre · ${CLINICA.nombre}`}
        claveVista="inicio-profesional"
        acciones={
          <Boton
            variante="secundario"
            cargando={actualizando}
            textoCargando="Actualizando…"
            onClick={() => setActualizando(true)}
          >
            Actualizar agenda
          </Boton>
        }
      >
        {actualizando ? (
          <SkeletonTarjetas cantidad={3} />
        ) : (
          <div className="wb-cards-grid">
            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 0 } as CSSProperties}>
              <p className="wb-card__etiqueta">Turnos de hoy</p>
              <p className="wb-card__valor">8</p>
              <p className="wb-card__texto">5 confirmados · 2 por confirmar · 1 atendido</p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 1 } as CSSProperties}>
              <p className="wb-card__etiqueta">Próximo paciente</p>
              <p className="wb-card__valor">09:30</p>
              <p className="wb-card__texto">Martín Quiroga · Limpieza dental (45 min)</p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 2 } as CSSProperties}>
              <p className="wb-card__etiqueta">Box asignado</p>
              <p className="wb-card__valor">{boxAsignado}</p>
              <p className="wb-card__texto">Turno mañana · 09:00 a 13:00</p>
            </div>
          </div>
        )}

        <section aria-labelledby="titulo-agenda-profesional">
          <h2
            id="titulo-agenda-profesional"
            style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}
          >
            Tu agenda de hoy
          </h2>
          <Tabla
            columnas={COLUMNAS_AGENDA}
            filas={AGENDA_PROFESIONAL}
            claveFila={(t) => t.id}
            cargando={actualizando}
            filasSkeleton={4}
          />
        </section>
      </AppLayout>
    );
  }

  if (rol === 'recepcionista') {
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
              onClick={() => setActualizando(true)}
            >
              Actualizar
            </Boton>
            <Boton
              variante="primario"
              onClick={() =>
                setAviso('Seleccioná profesional, box y horario libre en la agenda para agendar el nuevo turno.')
              }
            >
              + Nuevo turno
            </Boton>
          </div>
        }
      >
        {aviso ? (
          <div className="wb-banner-info" role="status" aria-live="polite">
            <span>{aviso}</span>
            <Boton variante="fantasma" onClick={() => setAviso(null)}>
              Cerrar
            </Boton>
          </div>
        ) : null}

        {actualizando ? (
          <SkeletonTarjetas cantidad={3} />
        ) : (
          <div className="wb-cards-grid">
            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 0 } as CSSProperties}>
              <p className="wb-card__etiqueta">Estado · Box 1</p>
              <div className="wb-estado-box wb-estado-box--ocupado">
                <BadgeEstadoTurno estado="confirmado" />
                <span>Ocupado</span>
              </div>
              <p className="wb-card__texto">Dra. Ana Pérez · Lucía Fernández (09:00 – 09:30)</p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 1 } as CSSProperties}>
              <p className="wb-card__etiqueta">Estado · Box 2</p>
              <div className="wb-estado-box wb-estado-box--libre">
                <span>Libre ahora</span>
              </div>
              <p className="wb-card__texto">Disponible hasta las 10:00 · Dr. Bruno Gómez</p>
            </div>

            <div className="wb-card wb-stagger-card" style={{ '--stagger-i': 2 } as CSSProperties}>
              <p className="wb-card__etiqueta">Pendientes de confirmar</p>
              <p className="wb-card__valor">3 turnos</p>
              <p className="wb-card__texto">2 por la mañana · 1 por la tarde</p>
            </div>
          </div>
        )}

        <section aria-labelledby="titulo-agenda-recepcion">
          <h2
            id="titulo-agenda-recepcion"
            style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}
          >
            Turnos de hoy por box
          </h2>
          <Tabla
            columnas={COLUMNAS_AGENDA}
            filas={AGENDA_RECEPCION}
            claveFila={(t) => t.id}
            cargando={actualizando}
            filasSkeleton={4}
          />
        </section>
      </AppLayout>
    );
  }

  // Vista exclusiva de Paciente: solo SU próximo turno + información útil de la clínica.
  return (
    <AppLayout
      titulo="Tu espacio de turnos"
      subtitulo={`${CLINICA.nombre} · Reservá, consultá o modificá tus visitas`}
      claveVista="inicio-paciente"
      acciones={
        <Boton
          variante="primario"
          onClick={() => void navigate('/inicio?vista=reservar')}
        >
          Reservar nuevo turno
        </Boton>
      }
    >
      {aviso ? (
        <div className="wb-banner-info" role="status" aria-live="polite">
          <span>{aviso}</span>
          <Boton variante="fantasma" onClick={() => setAviso(null)}>
            Cerrar
          </Boton>
        </div>
      ) : null}

      <div className="wb-paciente-grid">
        <section
          className="wb-turno-destacado wb-stagger-card"
          style={{ '--stagger-i': 0 } as CSSProperties}
          aria-labelledby="titulo-proximo-turno"
        >
          <div className="wb-turno-destacado__top">
            <div>
              <p className="wb-card__etiqueta" id="titulo-proximo-turno">
                Tu próximo turno
              </p>
              <h2 className="wb-turno-destacado__prestacion">Consulta odontológica (30 min)</h2>
              <p className="wb-turno-destacado__fecha">Lunes 23 de noviembre · 09:00 a 09:30</p>
            </div>
            <BadgeEstadoTurno estado="confirmado" />
          </div>

          <dl className="wb-turno-destacado__detalles">
            <div>
              <dt>Profesional</dt>
              <dd>Dra. Ana Pérez</dd>
            </div>
            <div>
              <dt>Consultorio / Box</dt>
              <dd>Box 1</dd>
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
                setAviso('Podés elegir un nuevo horario disponible para reprogramar este turno desde Mis turnos.')
              }
            >
              Reprogramar turno
            </Boton>
            <Boton
              variante="secundario"
              onClick={() =>
                setAviso('La cancelación libera tu horario inmediatamente (disponible hasta 24 horas antes del inicio).')
              }
            >
              Cancelar turno
            </Boton>
          </div>

          <p className="wb-card__texto" style={{ fontSize: 'var(--text-xs)' }}>
            Recordá que podés reprogramar o cancelar online hasta 24 horas antes del horario del
            turno.
          </p>
        </section>

        <aside
          className="wb-clinica-card wb-stagger-card"
          style={{ '--stagger-i': 1 } as CSSProperties}
          aria-labelledby="titulo-info-clinica"
        >
          <h2 id="titulo-info-clinica" className="wb-card__titulo" style={{ marginBottom: 0 }}>
            Información de la clínica
          </h2>

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
