import { Navigate, type RouteObject } from 'react-router-dom';
import { MisDatosPage } from './MisDatosPage';
import { MisTurnosPage } from './MisTurnosPage';
import { ReprogramarTurnoPage } from './ReprogramarTurnoPage';
import { ReservarPage } from './ReservarPage';

/**
 * Rutas del área paciente (C-14), descubiertas automáticamente por `web/src/main.tsx`.
 */
export const routes: RouteObject[] = [
  { path: '/paciente', element: <Navigate to="/paciente/reservar" replace /> },
  { path: '/paciente/reservar', element: <ReservarPage /> },
  { path: '/paciente/turnos', element: <MisTurnosPage /> },
  { path: '/paciente/turnos/:id/reprogramar', element: <ReprogramarTurnoPage /> },
  { path: '/paciente/datos', element: <MisDatosPage /> },
];
