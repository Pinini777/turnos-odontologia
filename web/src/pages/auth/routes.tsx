import { Navigate, type RouteObject } from 'react-router-dom';
import { InicioPage } from '../../base/InicioPage';
import { LoginPage } from '../../base/LoginPage';
import { RegistroPage } from '../../base/RegistroPage';

/**
 * Monta las rutas base de autenticación e inicio (C-12) mediante el autoload
 * de web/src/main.tsx sin editar ningún archivo congelado tras C-01.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegistroPage /> },
  { path: '/inicio', element: <InicioPage /> },
];
