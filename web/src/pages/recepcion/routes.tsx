import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AgendaPage } from './AgendaPage';
import { NuevoTurnoPage } from './NuevoTurnoPage';
import { PacientesPage } from './PacientesPage';
import { ReprogramarPage } from './ReprogramarPage';
import { SoloRecepcion } from './SoloRecepcion';

const soloRecepcion = (pagina: ReactNode) => <SoloRecepcion>{pagina}</SoloRecepcion>;

/** Área de la recepcionista (C-13). La monta el autoload de web/src/main.tsx. */
export const routes: RouteObject[] = [
  { path: '/recepcion', element: <Navigate to="/recepcion/agenda" replace /> },
  { path: '/recepcion/agenda', element: soloRecepcion(<AgendaPage />) },
  { path: '/recepcion/turnos/nuevo', element: soloRecepcion(<NuevoTurnoPage />) },
  { path: '/recepcion/turnos/:id/reprogramar', element: soloRecepcion(<ReprogramarPage />) },
  { path: '/recepcion/pacientes', element: soloRecepcion(<PacientesPage />) },
];
