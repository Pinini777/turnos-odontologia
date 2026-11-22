import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '../../design-system/tokens.css';
import { recolectarRutas, type ModuloDeRutas } from './rutas';

// Cada área agrega su web/src/pages/<area>/routes.tsx; nadie edita este archivo (congelado tras C-01).
const areas = import.meta.glob<ModuloDeRutas>('./pages/*/routes.tsx', { eager: true });

const router = createBrowserRouter([...recolectarRutas(areas), { path: '*', element: <main /> }]);

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta #root en index.html');

createRoot(raiz).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
