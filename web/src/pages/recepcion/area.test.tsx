import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { CATALOGOS, renderizarEn, servidorFalso } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

describe('Requirement: Área de recepción en el menú', () => {
  it('La recepcionista ve la agenda en el menú', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [] });
    renderizarEn('/recepcion/agenda?fecha=2026-11-24');
    const menu = await screen.findByRole('navigation', { name: /menú/i });
    const agenda = await waitFor(() => {
      const link = menu.querySelector('a[href="/recepcion/agenda"]');
      expect(link).not.toBeNull();
      return link;
    });
    expect(agenda?.textContent).toContain('Agenda del día');
    const pacientes = menu.querySelector('a[href="/recepcion/pacientes"]');
    expect(pacientes?.textContent).toContain('Pacientes');
    expect(menu.querySelector('a[href*="vista="]')).toBeNull();
  });

  it('Un paciente entra a una ruta de recepción', async () => {
    const { llamadas } = servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [] });
    renderizarEn('/recepcion/agenda?fecha=2026-11-24', 'paciente');
    expect(await screen.findByText(/acceso no permitido/i)).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta === '/api/agenda')).toEqual([]);
  });

  it('sin sesión, una ruta de recepción redirige al login', async () => {
    servidorFalso({});
    renderizarEn('/recepcion/agenda', null);
    expect(await screen.findByText('Pantalla de login')).toBeTruthy();
  });
});
