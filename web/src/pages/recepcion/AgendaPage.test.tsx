import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { CATALOGOS, renderizarEn, servidorFalso, turno, ubicacionActual } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

const AGENDA_MARTES = '/recepcion/agenda?fecha=2026-11-24';

/** La tarjeta (botón o bloque) de un turno, por su paciente. */
const tarjetaDe = async (paciente: string) => {
  const nombre = await screen.findByText(paciente);
  const tarjeta = nombre.closest('[data-turno-id]');
  if (!(tarjeta instanceof HTMLElement)) throw new Error(`No hay tarjeta para ${paciente}`);
  return tarjeta;
};

describe('Requirement: Agenda por día y por semana', () => {
  it('Vista del día con turnos', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [
        turno('t-11', '11:00', '11:30', {
          paciente: { id: 'pac-2', nombre: 'Paciente', apellido: 'Ficticio Dos' },
          profesional: { id: 'pro-gomez', nombre: 'Dr. Bruno Gómez' },
          box: { id: 'box-2', nombre: 'Box 2' },
          estado: 'confirmado',
        }),
        turno('t-10', '10:00', '10:30'),
      ],
    });
    renderizarEn(AGENDA_MARTES);

    const uno = await tarjetaDe('Paciente Ficticio Uno');
    const dos = await tarjetaDe('Paciente Ficticio Dos');
    expect(uno.compareDocumentPosition(dos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(uno).getByText('10:00–10:30')).toBeTruthy();
    expect(within(uno).getByText('Consulta · Dra. Ana Pérez · Box 1')).toBeTruthy();
    expect(within(uno).getByText('Reservado')).toBeTruthy();
    expect(within(dos).getByText('Consulta · Dr. Bruno Gómez · Box 2')).toBeTruthy();
    expect(within(dos).getByText('Confirmado')).toBeTruthy();

    const [pedido] = de('GET', '/api/agenda');
    expect(pedido?.query.get('desde')).toBe('2026-11-24T00:00:00-03:00');
    expect(pedido?.query.get('hasta')).toBe('2026-11-25T00:00:00-03:00');
  });

  it('Cambiar a la vista semanal', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [turno('t-mar', '10:00', '10:30'), turno('t-jue', '09:00', '09:30', { dia: '2026-11-26' })],
    });
    renderizarEn(AGENDA_MARTES);
    await screen.findAllByText('Paciente Ficticio Uno');

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));

    await waitFor(() => expect(de('GET', '/api/agenda')).toHaveLength(2));
    const semanal = de('GET', '/api/agenda')[1];
    expect(semanal?.query.get('desde')).toBe('2026-11-23T00:00:00-03:00');
    expect(semanal?.query.get('hasta')).toBe('2026-11-30T00:00:00-03:00');

    const martes = await screen.findByRole('region', { name: 'Mar 24/11' });
    const jueves = screen.getByRole('region', { name: 'Jue 26/11' });
    expect(within(martes).getByText('10:00–10:30')).toBeTruthy();
    expect(within(jueves).getByText('09:00–09:30')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Lun 23/11' })).getByText('Sin turnos')).toBeTruthy();
  });

  it('Día sin turnos', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [] });
    renderizarEn(AGENDA_MARTES);
    expect(await screen.findByText('No hay turnos para este día')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo turno' }));
    expect(ubicacionActual()).toBe('/recepcion/turnos/nuevo?fecha=2026-11-24');
  });
});

describe('Requirement: Filtro por profesional o por box', () => {
  it('Filtrar por box', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': ({ query }) => ({
        body: query.get('boxId') === 'box-1'
          ? [turno('t-1', '10:00', '10:30')]
          : [turno('t-1', '10:00', '10:30'), turno('t-2', '10:00', '10:30', {
            box: { id: 'box-2', nombre: 'Box 2' },
            paciente: { id: 'pac-2', nombre: 'Paciente', apellido: 'Ficticio Dos' },
          })],
      }),
    });
    renderizarEn(AGENDA_MARTES);
    await screen.findByText('Paciente Ficticio Dos');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Box 1' })).toBeTruthy());

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtro' }), { target: { value: 'b:box-1' } });

    await waitFor(() => expect(screen.queryByText('Paciente Ficticio Dos')).toBeNull());
    expect(screen.getByText('Paciente Ficticio Uno')).toBeTruthy();
    expect(de('GET', '/api/agenda').at(-1)?.query.get('boxId')).toBe('box-1');
  });
});

describe('Requirement: Turnos contiguos sin conflicto', () => {
  it('Turno contiguo se muestra como válido', async () => {
    servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [
        turno('t-10', '10:00', '10:30'),
        turno('t-1030', '10:30', '11:00', { paciente: { id: 'pac-3', nombre: 'Paciente', apellido: 'Ficticio Tres' } }),
      ],
    });
    renderizarEn(AGENDA_MARTES);
    const primero = await tarjetaDe('Paciente Ficticio Uno');
    const segundo = await tarjetaDe('Paciente Ficticio Tres');

    expect(primero.style.gridRow).toBe('6 / 8');
    expect(segundo.style.gridRow).toBe('8 / 10');
    expect(primero.style.gridColumn).toBe(segundo.style.gridColumn);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/conflicto|solapa|superpuest/i)).toBeNull();
  });
});

describe('Requirement: Acciones según el estado del turno', () => {
  it('Acciones de un turno reservado', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [turno('t-1', '11:30', '12:30')] });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 11:30/i }));

    const menu = screen.getByRole('menu');
    const acciones = within(menu).getAllByRole('menuitem').map((b) => b.textContent);
    expect(acciones).toEqual(['Confirmar', 'Reprogramar', 'Cancelar turno']);
    expect(within(menu).queryByText(/atendido|ausente/i)).toBeNull();
  });

  it('Un turno cancelado no tiene acciones', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [turno('t-1', '10:15', '10:45', { estado: 'cancelado' })] });
    renderizarEn(AGENDA_MARTES);
    const tarjeta = await tarjetaDe('Paciente Ficticio Uno');
    expect(within(tarjeta).queryByRole('button')).toBeNull();
    expect(within(tarjeta).getByText('Cancelado')).toBeTruthy();
  });

  it('Confirmar un turno', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [turno('t-1', '10:00', '10:30')],
      'POST /api/turnos/t-1/estado': {},
    });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 10:00/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Confirmar' }));

    await waitFor(() => expect(de('GET', '/api/agenda')).toHaveLength(2));
    expect(de('POST', '/api/turnos/t-1/estado')[0]?.cuerpo).toEqual({ estado: 'confirmado' });
  });

  it('un 409 TRANSICION_INVALIDA al marcar atendido muestra su mensaje legible', async () => {
    servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [turno('t-1', '10:00', '10:30', { estado: 'confirmado' })],
      'POST /api/turnos/t-1/estado': () => ({ status: 409, body: { code: 'TRANSICION_INVALIDA' } }),
    });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 10:00/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar atendido' }));
    expect(await screen.findByText('No es posible realizar ese cambio de estado para el turno actual.')).toBeTruthy();
  });

  it('Reprogramar lleva a la pantalla de reprogramación del turno', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [turno('t-1', '10:00', '10:30')], 'GET /api/recepcion/disponibilidad': [] });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 10:00/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reprogramar' }));
    expect(ubicacionActual()).toBe('/recepcion/turnos/t-1/reprogramar?fecha=2026-11-24');
  });
});

describe('Requirement: Cancelar con confirmación', () => {
  it('Cancelar un turno', async () => {
    const { de } = servidorFalso({
      ...CATALOGOS,
      'GET /api/agenda': [turno('t-1', '11:30', '12:30')],
      'POST /api/turnos/t-1/cancelar': {},
    });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 11:30/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar turno' }));
    expect(de('POST', '/api/turnos/t-1/cancelar')).toHaveLength(0);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sí, cancelar turno' }));

    await waitFor(() => expect(de('POST', '/api/turnos/t-1/cancelar')).toHaveLength(1));
    await waitFor(() => expect(de('GET', '/api/agenda')).toHaveLength(2));
  });

  it('Desistir de cancelar', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/agenda': [turno('t-1', '11:30', '12:30')] });
    renderizarEn(AGENDA_MARTES);
    fireEvent.click(await screen.findByRole('button', { name: /turno de las 11:30/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancelar turno' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Volver' }));

    expect(de('POST', '/api/turnos/t-1/cancelar')).toHaveLength(0);
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Confirmar', 'Reprogramar', 'Cancelar turno']);
  });
});
