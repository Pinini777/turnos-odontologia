import type { RouteObject } from 'react-router-dom';
import { AgendaProfesionalPage, AuditoriaTurnoPage } from './AgendaAuditoriaPage';
import { CatalogoPage } from './CatalogoPage';
import { ClinicaPage } from './ClinicaPage';
import { GananciasPage } from './GananciasPage';
import { HorariosPage } from './HorariosPage';

export const routes: RouteObject[] = [
  { path: '/profesional/catalogo', element: <CatalogoPage /> },
  { path: '/profesional/horarios', element: <HorariosPage /> },
  { path: '/profesional/ganancias', element: <GananciasPage /> },
  { path: '/profesional/clinica', element: <ClinicaPage /> },
  { path: '/profesional/agenda', element: <AgendaProfesionalPage /> },
  { path: '/profesional/turnos/:id/auditoria', element: <AuditoriaTurnoPage /> },
];
