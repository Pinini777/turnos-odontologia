import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../../base/AppLayout';
import { EstadoVacio } from '../../base/components';
import { useSesion } from '../../base/sesion';
import './recepcion.css';

/** Guarda de rol del área: sin sesión va al login; otro rol ve un aviso y no se pide nada a la API. */
export function SoloRecepcion({ children }: { readonly children: ReactNode }) {
  const { sesion } = useSesion();
  if (!sesion) return <Navigate to="/login" replace />;
  if (sesion.usuario.rol !== 'recepcionista') {
    return (
      <AppLayout titulo="Sin acceso">
        <EstadoVacio titulo="Acceso no permitido" descripcion="Esta sección es solo para recepción." />
      </AppLayout>
    );
  }
  return children;
}
