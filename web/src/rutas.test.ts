import { describe, expect, it } from 'vitest';
import { recolectarRutas } from './rutas';

describe('recolectarRutas', () => {
  it('combina las rutas de varias áreas en orden de archivo', () => {
    const rutas = recolectarRutas({
      './pages/recepcion/routes.tsx': { routes: [{ path: '/recepcion' }] },
      './pages/agenda/routes.tsx': { routes: [{ path: '/agenda' }, { path: '/agenda/semana' }] },
    });
    expect(rutas.map((r) => r.path)).toEqual(['/agenda', '/agenda/semana', '/recepcion']);
  });

  it('sin áreas devuelve una lista vacía', () => {
    expect(recolectarRutas({})).toEqual([]);
  });
});
