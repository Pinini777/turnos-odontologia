import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio } from '../../base/components';
import { useSesion } from '../../base/sesion';
import './profesional.css';

export interface PropsGuardiaProfesional {
  readonly titulo?: string;
  readonly children: ReactNode;
}

export function GuardiaProfesional({
  titulo = 'Área profesional',
  children,
}: PropsGuardiaProfesional) {
  const { sesion } = useSesion();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (sesion.usuario.rol !== 'profesional') {
    return (
      <AppLayout
        titulo={titulo}
        subtitulo="Esta sección es exclusiva para profesionales odontólogos de la clínica."
      >
        <section className="prof-guardia">
          <AlertaErrorNegocio
            code="SIN_PERMISO"
            mensaje="Esta pantalla es exclusiva del rol profesional. No tenés permiso para ver precios, ganancias, historia clínica ni configuración."
          />
          <div>
            <Link to="/inicio" className="wb-btn wb-btn--secundario">
              Volver al inicio
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
