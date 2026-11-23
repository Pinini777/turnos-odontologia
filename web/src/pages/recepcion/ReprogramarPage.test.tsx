import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { CATALOGOS, hueco, renderizarEn, servidorFalso, turno, ubicacionActual } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

const RUTA = '/recepcion/turnos/t-1/reprogramar?fecha=2026-11-24';
const TURNO = turno('t-1', '10:00', '10:30', { estado: 'confirmado' });
const HUECOS = [hueco('11:00', '11:30'), hueco('11:30', '12:00', ['box-2'])];

describe('Requirement: Reprogramar eligiendo un hueco libre', () => {
  it('Mover un turno a otro hueco', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': HUECOS, 'PATCH /api/turnos/t-1/reprogramar': {} });
    renderizarEn(RUTA, 'recepcionista', { turno: TURNO });

    expect(screen.getByText('Mar 24/11 · 10:00')).toBeTruthy();
    expect(screen.getByText(/el turno vuelve a/i).textContent).toContain('Reservado');
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar a las 11:00' }));

    await waitFor(() => expect(de('PATCH', '/api/turnos/t-1/reprogramar')).toHaveLength(1));
    expect(de('PATCH', '/api/turnos/t-1/reprogramar')[0]?.cuerpo).toEqual({ inicio: hueco('11:00', '11:30').inicio });
    await waitFor(() => expect(ubicacionActual()).toBe('/recepcion/agenda?fecha=2026-11-24'));
    const pedido = de('GET', '/api/recepcion/disponibilidad')[0];
    expect(pedido?.query.get('prestacionId')).toBe('consulta');
    expect(pedido?.query.get('profesionalId')).toBe('pro-perez');
  });

  it('Reprogramar falla por solapamiento', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/recepcion/disponibilidad': HUECOS,
      'PATCH /api/turnos/t-1/reprogramar': () => ({ status: 409, body: { code: 'SOLAPAMIENTO_PROFESIONAL' } }),
    });
    renderizarEn(RUTA, 'recepcionista', { turno: TURNO });
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar a las 11:00' }));

    expect(await screen.findByText('El profesional ya tiene un turno reservado en ese horario. Elegí otro bloque disponible.')).toBeTruthy();
    await waitFor(() => expect(de('GET', '/api/recepcion/disponibilidad')).toHaveLength(2));
    expect(ubicacionActual()).toBe(RUTA);
  });

  it('con box automático, si el box actual no está libre en el hueco manda el primero libre', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': HUECOS, 'PATCH /api/turnos/t-1/reprogramar': {} });
    renderizarEn(RUTA, 'recepcionista', { turno: TURNO });
    fireEvent.click(await screen.findByRole('button', { name: '11:30' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar a las 11:30' }));
    await waitFor(() => expect(de('PATCH', '/api/turnos/t-1/reprogramar')).toHaveLength(1));
    expect(de('PATCH', '/api/turnos/t-1/reprogramar')[0]?.cuerpo).toEqual({ inicio: hueco('11:30', '12:00').inicio, boxId: 'box-2' });
  });

  it('sin el turno en la navegación, lo busca en la agenda de ese día', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [TURNO], 'GET /api/recepcion/disponibilidad': HUECOS });
    renderizarEn(RUTA);
    expect(await screen.findByText('Mar 24/11 · 10:00')).toBeTruthy();
    expect(de('GET', '/api/agenda')[0]?.query.get('desde')).toBe('2026-11-24T00:00:00-03:00');
  });
});
