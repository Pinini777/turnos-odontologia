import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio } from '../../base/components';
import { useSesion } from '../../base/sesion';

export interface PropsGuardiaPaciente {
  readonly children: ReactNode;
}

/**
 * Protege todas las pantallas bajo `/paciente/*` para uso exclusivo del rol `paciente`.
 * Sin sesión redirige a `/login`; con otro rol muestra `SIN_PERMISO` sin ejecutar fetches.
 */
export function GuardiaPaciente({ children }: PropsGuardiaPaciente) {
  const { sesion } = useSesion();

  if (!sesion) {
    return <Navigate to="/login" replace />;
  }

  if (sesion.usuario.rol !== 'paciente') {
    return (
      <AppLayout
        titulo="Acceso restringido"
        subtitulo="Esta sección es exclusiva para pacientes registrados."
      >
        <div className="pa-bloqueo">
          <AlertaErrorNegocio
            code="SIN_PERMISO"
            mensaje="Esta sección está reservada para cuentas de paciente."
          />
          <Link to="/inicio" className="wb-btn wb-btn--secundario">
            Volver al inicio
          </Link>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
}
