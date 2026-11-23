import { Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { BadgeEstadoTurno, Tabla, type ColumnaTabla, type EstadoTurnoUi } from './components';
import { ETIQUETA_ROL } from './menu';
import { useSesion } from './sesion';

interface TurnoMuestra {
  readonly id: string;
  readonly horario: string;
  readonly box: string;
  readonly profesional: string;
  readonly prestacion: string;
  readonly paciente: string;
  readonly estado: EstadoTurnoUi;
}

const TURNOS_MAQUETA: readonly TurnoMuestra[] = [
  {
    id: 'm-1',
    horario: '09:00 – 09:30',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Consulta (30 min)',
    paciente: 'Paciente Ficticio Uno',
    estado: 'confirmado',
  },
  {
    id: 'm-2',
    horario: '09:30 – 10:15',
    box: 'Box 1',
    profesional: 'Dra. Ana Pérez',
    prestacion: 'Limpieza (45 min)',
    paciente: 'Paciente Ficticio Dos',
    estado: 'reservado',
  },
  {
    id: 'm-3',
    horario: '10:00 – 10:15',
    box: 'Box 2',
    profesional: 'Dr. Bruno Gómez',
    prestacion: 'Control (15 min)',
    paciente: 'Paciente Ficticio Uno',
    estado: 'atendido',
  },
];

const COLUMNAS_AGENDA: readonly ColumnaTabla<TurnoMuestra>[] = [
  { encabezado: 'Horario', render: (t) => t.horario },
  { encabezado: 'Box', render: (t) => t.box },
  { encabezado: 'Profesional', render: (t) => t.profesional },
  { encabezado: 'Prestación', render: (t) => t.prestacion },
  { encabezado: 'Paciente', render: (t) => t.paciente },
  { encabezado: 'Estado', render: (t) => <BadgeEstadoTurno estado={t.estado} /> },
];

export function InicioPage() {
  const { sesion } = useSesion();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  const rol = sesion.usuario.rol;

  return (
    <AppLayout
      titulo={`Panel de ${ETIQUETA_ROL[rol].toLowerCase()}`}
      subtitulo="Maqueta base de C-12 conectada a la autenticación de C-04. El menú lateral se adapta a tu rol."
    >
      <div className="wb-cards-grid">
        <div className="wb-card">
          <h2 className="wb-card__titulo">Sesión verificada (C-04)</h2>
          <p className="wb-card__texto">
            Ingresaste como <strong>{sesion.usuario.email}</strong> con rol{' '}
            <strong>{ETIQUETA_ROL[rol]}</strong>. El token Bearer se adjunta automáticamente en cada
            consulta.
          </p>
        </div>

        <div className="wb-card">
          <h2 className="wb-card__titulo">Agenda sin superposiciones</h2>
          <p className="wb-card__texto">
            Todos los turnos se validan en bloques de 15 minutos con intervalos [inicio, fin) por
            profesional y por box, sin sobreturnos.
          </p>
        </div>

        <div className="wb-card">
          <h2 className="wb-card__titulo">Privacidad por rol</h2>
          <p className="wb-card__texto">
            {rol === 'profesional'
              ? 'Como profesional tenés acceso a catálogo con precios, tus ganancias, historia clínica y auditoría.'
              : rol === 'recepcionista'
                ? 'Vista de recepción: gestión completa de turnos y pacientes sin exposición de precios ni ganancias.'
                : 'Vista de paciente: reservá huecos libres online, descargá tu .ics y gestioná tus turnos hasta 24 h antes.'}
          </p>
        </div>
      </div>

      <section aria-labelledby="titulo-muestra-agenda">
        <h2 id="titulo-muestra-agenda" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>
          Vista previa de componentes base (datos ficticios)
        </h2>
        <Tabla
          columnas={COLUMNAS_AGENDA}
          filas={TURNOS_MAQUETA}
          claveFila={(t) => t.id}
        />
      </section>
    </AppLayout>
  );
}
