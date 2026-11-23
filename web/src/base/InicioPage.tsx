import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import {
  BadgeEstadoTurno,
  Boton,
  EstadoVacio,
  SkeletonTarjetas,
  Tabla,
  type ColumnaTabla,
  type EstadoTurnoUi,
} from './components';
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

const DESCRIPCION_VISTA: Readonly<Record<string, { titulo: string; subtitulo: string; detalle: string }>> = {
  agenda: {
    titulo: 'Agenda por profesional y box',
    subtitulo: 'Vista previa de navegación — se integrará con la agenda interactiva en C-13 / C-15.',
    detalle: 'Acá se listan los bloques de 15 minutos con validación anti-solapamientos.',
  },
  pacientes: {
    titulo: 'Padrón de pacientes',
    subtitulo: 'Vista previa de navegación — conectará con GET/POST/PATCH /api/pacientes de C-04.',
    detalle: 'Permite dar de alta y actualizar pacientes de contacto sin precios ni borrado físico.',
  },
  catalogo: {
    titulo: 'Catálogo y prestaciones',
    subtitulo: 'Vista previa de navegación — conectará con C-03 (profesionales, boxes y prestaciones).',
    detalle: 'Solo el profesional administra prestaciones con duración múltiplo de 15 y precio.',
  },
  horarios: {
    titulo: 'Mis horarios y bloqueos',
    subtitulo: 'Vista previa de navegación — conectará con C-03 (horarios por día y bloqueos).',
    detalle: 'Cada profesional gestiona sus propias franjas y bloqueos de box o agenda.',
  },
  ganancias: {
    titulo: 'Mis ganancias',
    subtitulo: 'Vista previa exclusiva del profesional — conectará con C-08.',
    detalle: 'Calcula en vivo la suma de precioAlReservar de turnos atendidos en el período.',
  },
  clinica: {
    titulo: 'Historia clínica y odontograma',
    subtitulo: 'Vista previa exclusiva del profesional — conectará con C-09.',
    detalle: 'Entradas append-only y odontograma en notación FDI con datos 100 % ficticios.',
  },
  reservar: {
    titulo: 'Reservar turno online',
    subtitulo: 'Vista previa de paciente — se implementará en C-14 sobre C-11.',
    detalle: 'Elegí prestación, consultá huecos libres y confirmá con email + Google Calendar.',
  },
  turnos: {
    titulo: 'Mis turnos',
    subtitulo: 'Vista previa de paciente — se implementará en C-14 sobre C-11.',
    detalle: 'Consultá tus turnos, descargá el .ics o cancelá/reprogramá hasta 24 h antes.',
  },
  datos: {
    titulo: 'Mis datos personales',
    subtitulo: 'Vista previa de paciente — conectará con GET/PATCH /api/paciente/datos de C-04.',
    detalle: 'Actualizá teléfono y obra social informativa manteniendo intactos DNI y correo.',
  },
};

export function InicioPage() {
  const { sesion } = useSesion();
  const [searchParams] = useSearchParams();
  const [cargandoEstado, setCargandoEstado] = useState(false);

  const vista = searchParams.get('vista') ?? '';

  useEffect(() => {
    if (!cargandoEstado) return;
    const timer = window.setTimeout(() => setCargandoEstado(false), 260);
    return () => window.clearTimeout(timer);
  }, [cargandoEstado]);

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  const rol = sesion.usuario.rol;
  const infoVista = vista ? DESCRIPCION_VISTA[vista] : undefined;

  function simularRecarga(): void {
    setCargandoEstado(true);
  }

  return (
    <AppLayout
      titulo={infoVista ? infoVista.titulo : `Panel de ${ETIQUETA_ROL[rol].toLowerCase()}`}
      subtitulo={
        infoVista
          ? infoVista.subtitulo
          : 'Maqueta base de C-12 conectada a la autenticación de C-04. El menú lateral se adapta a tu rol.'
      }
      claveVista={vista || 'inicio'}
      acciones={
        <Boton
          variante="secundario"
          cargando={cargandoEstado}
          textoCargando="Actualizando…"
          onClick={simularRecarga}
        >
          Actualizar vista
        </Boton>
      }
    >
      {infoVista ? (
        cargandoEstado ? (
          <SkeletonTablaWrapper />
        ) : (
          <EstadoVacio
            titulo={infoVista.titulo}
            descripcion={infoVista.detalle}
            accion={
              <Boton variante="secundario" onClick={simularRecarga}>
                Probar estado de carga
              </Boton>
            }
          />
        )
      ) : (
        <>
          {cargandoEstado ? (
            <SkeletonTarjetas cantidad={3} />
          ) : (
            <div className="wb-cards-grid">
              <div className="wb-card">
                <h2 className="wb-card__titulo">Sesión verificada (C-04)</h2>
                <p className="wb-card__texto">
                  Ingresaste como <strong>{sesion.usuario.email}</strong> con rol{' '}
                  <strong>{ETIQUETA_ROL[rol]}</strong>. El token Bearer se adjunta automáticamente en
                  cada consulta.
                </p>
              </div>

              <div className="wb-card">
                <h2 className="wb-card__titulo">Agenda sin superposiciones</h2>
                <p className="wb-card__texto">
                  Todos los turnos se validan en bloques de 15 minutos con intervalos [inicio, fin)
                  por profesional y por box, sin sobreturnos.
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
          )}

          <section aria-labelledby="titulo-muestra-agenda">
            <h2
              id="titulo-muestra-agenda"
              style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}
            >
              Vista previa de componentes base (datos ficticios)
            </h2>
            <Tabla
              columnas={COLUMNAS_AGENDA}
              filas={TURNOS_MAQUETA}
              claveFila={(t) => t.id}
              cargando={cargandoEstado}
              filasSkeleton={3}
            />
          </section>
        </>
      )}
    </AppLayout>
  );
}

function SkeletonTablaWrapper() {
  return <Tabla columnas={COLUMNAS_AGENDA} filas={[]} claveFila={(t) => t.id} cargando filasSkeleton={4} />;
}
