import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limpiarSesion } from '../../base/sesion';
import { CATALOGOS, hueco, renderizarEn, servidorFalso, ubicacionActual } from './test-utils';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.unstubAllGlobals();
});

const NUEVO_MARTES = '/recepcion/turnos/nuevo?fecha=2026-11-24';
const HUECOS = [hueco('10:00', '10:30'), hueco('10:30', '11:00', ['box-1', 'box-2']), hueco('11:00', '11:30')];

/** Elige a la Dra. Pérez (la prestación por defecto es Consulta, la primera activa). */
async function elegirProfesional() {
  await screen.findByRole('option', { name: 'Dra. Ana Pérez' });
  fireEvent.change(screen.getByLabelText('Profesional'), { target: { value: 'pro-perez' } });
}

async function elegirPacienteUno() {
  fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'Uno' } });
  fireEvent.click(await screen.findByRole('button', { name: /Paciente Ficticio Uno · DNI/ }));
}

const confirmar = () => fireEvent.click(screen.getByRole('button', { name: /Confirmar turno de las/ }));

describe('Requirement: Nuevo turno en un hueco libre', () => {
  it('Elegir un hueco libre y crear el turno', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': HUECOS, 'POST /api/recepcion/turnos': () => ({ status: 201, body: {} }) });
    renderizarEn(NUEVO_MARTES);

    expect((screen.getByLabelText('Día') as HTMLInputElement).value).toBe('2026-11-24');
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '10:30' }));
    await elegirPacienteUno();
    confirmar();

    await waitFor(() => expect(de('POST', '/api/recepcion/turnos')).toHaveLength(1));
    expect(de('POST', '/api/recepcion/turnos')[0]?.cuerpo).toEqual({
      pacienteId: 'pac-1',
      profesionalId: 'pro-perez',
      prestacionId: 'consulta',
      inicio: hueco('10:30', '11:00').inicio,
    });
    await waitFor(() => expect(ubicacionActual()).toBe('/recepcion/agenda?fecha=2026-11-24'));
  });

  it('Sin huecos libres', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': [] });
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    expect(await screen.findByText('No hay huecos libres para ese día.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Probar el día siguiente' })).toBeTruthy();
  });

  it('Elegir un box del hueco', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': HUECOS, 'POST /api/recepcion/turnos': () => ({ status: 201, body: {} }) });
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '10:30' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Box' })).getByRole('button', { name: 'Box 2' }));
    await elegirPacienteUno();
    confirmar();

    await waitFor(() => expect(de('POST', '/api/recepcion/turnos')).toHaveLength(1));
    expect(de('POST', '/api/recepcion/turnos')[0]?.cuerpo).toMatchObject({ boxId: 'box-2' });
  });

  it('ofrece todas las prestaciones activas, también las que no se reservan online', async () => {
    servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': [] });
    renderizarEn(NUEVO_MARTES);
    const select = screen.getByLabelText('Prestación');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Consulta · 30 min', 'Extracción simple · 60 min']);
  });
});

describe('Requirement: Paciente existente o nuevo en el mismo formulario', () => {
  it('Dar turno a un paciente nuevo', async () => {
    const { de } = servidorFalso({ ...CATALOGOS, 'GET /api/recepcion/disponibilidad': HUECOS, 'POST /api/recepcion/turnos': () => ({ status: 201, body: {} }) });
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '11:00' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Paciente nuevo' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Paciente' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Ficticio Tres' } });
    fireEvent.change(screen.getByLabelText('Documento'), { target: { value: '00000003' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'paciente3@example.com' } });
    confirmar();

    await waitFor(() => expect(de('POST', '/api/recepcion/turnos')).toHaveLength(1));
    const cuerpo = de('POST', '/api/recepcion/turnos')[0]?.cuerpo;
    expect(cuerpo).toMatchObject({
      paciente: { nombre: 'Paciente', apellido: 'Ficticio Tres', documento: '00000003', email: 'paciente3@example.com' },
    });
    expect(cuerpo).not.toHaveProperty('pacienteId');
  });
});

describe('Requirement: Errores de negocio legibles', () => {
  /** El alta choca con el código dado; los pedidos de disponibilidad quedan registrados. */
  function servidorQueChoca(code: string) {
    return servidorFalso({
      ...CATALOGOS,
      'GET /api/recepcion/disponibilidad': HUECOS,
      'POST /api/recepcion/turnos': () => ({ status: 409, body: { code } }),
    });
  }

  it('El hueco se ocupó mientras se cargaba el turno', async () => {
    const { de } = servidorQueChoca('SOLAPAMIENTO_PROFESIONAL');
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '10:30' }));
    await elegirPacienteUno();
    const pedidosAntes = de('GET', '/api/recepcion/disponibilidad').length;
    confirmar();

    expect(await screen.findByText('El profesional ya tiene un turno reservado en ese horario. Elegí otro bloque disponible.')).toBeTruthy();
    const seccionPaciente = screen.getByRole('region', { name: /Paciente$/ });
    expect(within(seccionPaciente).getByText('Paciente Ficticio Uno')).toBeTruthy();
    expect(within(seccionPaciente).getByRole('button', { name: 'Cambiar' })).toBeTruthy();
    await waitFor(() => expect(de('GET', '/api/recepcion/disponibilidad').length).toBe(pedidosAntes + 1));
    expect((await screen.findByRole('button', { name: '10:30' })).getAttribute('aria-pressed')).toBe('false');
  });

  it('El box ya está ocupado', async () => {
    servidorQueChoca('SOLAPAMIENTO_BOX');
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '10:30' }));
    await elegirPacienteUno();
    confirmar();
    expect(await screen.findByText('El box elegido ya está ocupado en ese horario. Elegí otro box o un turno contiguo libre.')).toBeTruthy();
  });

  it('El paciente ya tiene otro turno superpuesto al agendar desde recepción', async () => {
    const { de } = servidorQueChoca('SOLAPAMIENTO_PACIENTE');
    renderizarEn(NUEVO_MARTES);
    await elegirProfesional();
    fireEvent.click(await screen.findByRole('button', { name: '10:30' }));
    await elegirPacienteUno();
    const pedidosAntes = de('GET', '/api/recepcion/disponibilidad').length;
    confirmar();

    expect(
      await screen.findByText(
        'El paciente ya tiene otro turno reservado en ese horario. Elegí otro bloque disponible.',
      ),
    ).toBeTruthy();
    const seccionPaciente = screen.getByRole('region', { name: /Paciente$/ });
    expect(within(seccionPaciente).getByText('Paciente Ficticio Uno')).toBeTruthy();
    await waitFor(() => expect(de('GET', '/api/recepcion/disponibilidad').length).toBe(pedidosAntes + 1));
  });
});
