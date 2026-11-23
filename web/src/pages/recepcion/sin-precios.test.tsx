import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { CATALOGOS, renderizarEn, servidorFalso, turno } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

describe('Requirement: Sin precios en ninguna pantalla', () => {
  it('Una respuesta con precio no se muestra', async () => {
    const base = turno('t-1', '10:00', '10:30');
    const conPrecio = { ...base, precioAlReservar: 15000, prestacion: { ...base.prestacion, precio: 15000 } };
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [conPrecio] });
    renderizarEn('/recepcion/agenda?fecha=2026-11-24');

    fireEvent.click(await screen.findByRole('button', { name: /turno de las 10:00/i }));
    expect(screen.getByRole('menu')).toBeTruthy();
    const texto = document.body.textContent ?? '';
    expect(texto).not.toContain('15000');
    expect(texto).not.toContain('15.000');
    expect(texto).not.toContain('$');
  });
});
