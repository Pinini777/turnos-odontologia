import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Hueco } from './api';
import { SelectorHuecos } from './SelectorHuecos';
import { hueco, servidorFalso } from './test-utils';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** El selector con su estado, como lo usan las páginas. */
function Envoltorio({ profesionalId = 'pro-perez', inicial = '2026-11-24' }: { readonly profesionalId?: string; readonly inicial?: string }) {
  const [fecha, setFecha] = useState(inicial);
  const [elegido, setElegido] = useState<Hueco | null>(null);
  const [box, setBox] = useState<string | null>(null);
  return (
    <>
      <output data-testid="fecha">{fecha}</output>
      <output data-testid="box">{box ?? 'auto'}</output>
      <SelectorHuecos
        prestacionId="consulta"
        profesionalId={profesionalId}
        fecha={fecha}
        onCambiarFecha={setFecha}
        recarga={0}
        elegido={elegido}
        onElegir={setElegido}
        boxElegido={box}
        onElegirBox={setBox}
        nombresBox={new Map([['box-1', 'Box 1'], ['box-2', 'Box 2']])}
        nombresProfesional={new Map([['pro-perez', 'Dra. Ana Pérez'], ['pro-gomez', 'Dr. Bruno Gómez']])}
      />
    </>
  );
}

describe('SelectorHuecos', () => {
  it('pide la disponibilidad del día y agrupa los huecos en mañana y tarde', async () => {
    const { de } = servidorFalso({
      'GET /api/recepcion/disponibilidad': [hueco('10:00', '10:30'), hueco('15:00', '15:30')],
    });
    render(<Envoltorio />);
    const manana = await screen.findByRole('group', { name: 'Huecos de la mañana' });
    expect(within(manana).getByRole('button', { name: '10:00' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Huecos de la tarde' })).getByRole('button', { name: '15:00' })).toBeTruthy();
    const pedido = de('GET', '/api/recepcion/disponibilidad')[0];
    expect(Object.fromEntries(pedido?.query ?? [])).toEqual({
      prestacionId: 'consulta', desde: '2026-11-24T00:00:00-03:00', hasta: '2026-11-25T00:00:00-03:00', profesionalId: 'pro-perez',
    });
  });

  it('marca el hueco elegido y ofrece Automático más los boxes libres de ese hueco', async () => {
    servidorFalso({ 'GET /api/recepcion/disponibilidad': [hueco('10:30', '11:00', ['box-1', 'box-2'])] });
    render(<Envoltorio />);
    const boton = await screen.findByRole('button', { name: '10:30' });
    expect(boton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    const boxes = screen.getByRole('group', { name: 'Box' });
    expect(within(boxes).getAllByRole('button').map((b) => b.textContent)).toEqual(['Automático', 'Box 1', 'Box 2']);
    expect(within(boxes).getByRole('button', { name: 'Automático' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('con cualquier profesional, cada hueco dice de quién es', async () => {
    servidorFalso({ 'GET /api/recepcion/disponibilidad': [hueco('10:00', '10:30', ['box-1'], 'pro-gomez')] });
    render(<Envoltorio profesionalId="" />);
    expect(await screen.findByRole('button', { name: '10:00 · Dr. Bruno Gómez' })).toBeTruthy();
  });

  it('sin huecos ofrece probar el día siguiente', async () => {
    const { de } = servidorFalso({ 'GET /api/recepcion/disponibilidad': [] });
    render(<Envoltorio />);
    fireEvent.click(await screen.findByRole('button', { name: 'Probar el día siguiente' }));
    expect(screen.getByTestId('fecha').textContent).toBe('2026-11-25');
    await waitFor(() => expect(de('GET', '/api/recepcion/disponibilidad')).toHaveLength(2));
  });
});
