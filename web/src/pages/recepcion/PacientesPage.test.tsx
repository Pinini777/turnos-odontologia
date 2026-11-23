import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { PACIENTES, renderizarEn, servidorFalso } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

const NUEVO = { nombre: 'Paciente', apellido: 'Ficticio Tres', documento: '00000003', email: 'paciente3@example.com' };

function completarAlta() {
  fireEvent.click(screen.getByRole('button', { name: '+ Nuevo paciente' }));
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: NUEVO.nombre } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: NUEVO.apellido } });
  fireEvent.change(screen.getByLabelText('Documento'), { target: { value: NUEVO.documento } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: NUEVO.email } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }));
}

describe('Requirement: Pacientes', () => {
  it('Buscar un paciente', async () => {
    servidorFalso({ 'GET /api/pacientes': PACIENTES });
    renderizarEn('/recepcion/pacientes');
    expect(await screen.findByText('Paciente Ficticio Uno')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'Dos' } });
    expect(screen.getByText('Paciente Ficticio Dos')).toBeTruthy();
    expect(screen.queryByText('Paciente Ficticio Uno')).toBeNull();
  });

  it('el alta llama a POST /api/pacientes y vuelve a pedir la lista', async () => {
    const { de } = servidorFalso({ 'GET /api/pacientes': PACIENTES, 'POST /api/pacientes': () => ({ status: 201, body: { id: 'pac-3', ...NUEVO } }) });
    renderizarEn('/recepcion/pacientes');
    await screen.findByText('Paciente Ficticio Uno');
    completarAlta();
    await waitFor(() => expect(de('POST', '/api/pacientes')).toHaveLength(1));
    expect(de('POST', '/api/pacientes')[0]?.cuerpo).toEqual(NUEVO);
    await waitFor(() => expect(de('GET', '/api/pacientes')).toHaveLength(2));
  });

  it('Alta con documento repetido', async () => {
    servidorFalso({ 'GET /api/pacientes': PACIENTES, 'POST /api/pacientes': () => ({ status: 409, body: { code: 'DUPLICADO' } }) });
    renderizarEn('/recepcion/pacientes');
    await screen.findByText('Paciente Ficticio Uno');
    completarAlta();
    expect(await screen.findByText('Ya existe un registro con ese correo electrónico o documento.')).toBeTruthy();
    expect((screen.getByLabelText('Documento') as HTMLInputElement).value).toBe('00000003');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('paciente3@example.com');
  });
});
