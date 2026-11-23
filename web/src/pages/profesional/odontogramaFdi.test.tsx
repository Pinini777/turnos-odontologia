import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoPiezaApi } from './apiProfesional';
import { OdontogramaFdi } from './OdontogramaFdiSvg';

afterEach(() => {
  cleanup();
});

describe('OdontogramaFdiSvg — Overlays WCAG y navegación por teclado', () => {
  it('renderiza overlays diferenciados para ausente, a_extraer, corona y endodoncia', () => {
    const piezas: EstadoPiezaApi[] = [
      { id: '1', odontogramaId: 'o1', pieza: 11, estado: 'corona', registradoPor: 'p1', fecha: '2026-11-23T10:00:00Z' },
      { id: '2', odontogramaId: 'o1', pieza: 24, estado: 'endodoncia', registradoPor: 'p1', fecha: '2026-11-23T10:00:00Z' },
      { id: '3', odontogramaId: 'o1', pieza: 36, estado: 'ausente', registradoPor: 'p1', fecha: '2026-11-23T10:00:00Z' },
      { id: '4', odontogramaId: 'o1', pieza: 48, estado: 'a_extraer', registradoPor: 'p1', fecha: '2026-11-23T10:00:00Z' },
    ];

    const { container } = render(
      <OdontogramaFdi
        piezas={piezas}
        piezaSeleccionada={16}
        caraSeleccionada="oclusal"
        mostrarTemporaria={false}
        onToggleTemporaria={vi.fn()}
        onSeleccionar={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-pieza="11"] [data-overlay="corona"]')).toBeTruthy();
    expect(container.querySelector('[data-pieza="24"] [data-overlay="endodoncia"]')).toBeTruthy();
    expect(container.querySelector('[data-pieza="36"] [data-overlay="ausente"]')).toBeTruthy();
    expect(container.querySelector('[data-pieza="48"] [data-overlay="a_extraer"]')).toBeTruthy();
  });

  it('soporta activación con Enter/Space y desplazamiento de foco con flechas', () => {
    const onSeleccionar = vi.fn();
    const { container } = render(
      <OdontogramaFdi
        piezas={[]}
        piezaSeleccionada={16}
        caraSeleccionada="oclusal"
        mostrarTemporaria={false}
        onToggleTemporaria={vi.fn()}
        onSeleccionar={onSeleccionar}
      />,
    );

    const zona1 = container.querySelector<SVGElement>('[data-pieza="18"][data-cara="vestibular"]');
    expect(zona1).toBeTruthy();
    zona1!.focus();
    fireEvent.keyDown(zona1!, { key: 'Enter' });
    expect(onSeleccionar).toHaveBeenCalledWith(18, 'vestibular');

    fireEvent.keyDown(zona1!, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(zona1);
    fireEvent.keyDown(document.activeElement!, { key: ' ' });
    expect(onSeleccionar).toHaveBeenCalledTimes(2);
  });
});
