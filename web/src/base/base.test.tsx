import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearClienteHttp, ErrorApi } from './api';
import { AlertaErrorNegocio, BadgeEstadoTurno, EstadoVacio } from './components';
import { AppLayout } from './AppLayout';
import { LoginPage } from './LoginPage';
import { RegistroPage } from './RegistroPage';
import { obtenerMenuPorRol } from './menu';
import { limpiarSesion, establecerSesion } from './sesion';

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.restoreAllMocks();
});

describe('Cliente HTTP de C-12', () => {
  it('adjunta Authorization: Bearer <token> en las peticiones autenticadas', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const api = crearClienteHttp({
      obtenerToken: () => 'jwt-ficticio-123',
      fetchImpl: fetchMock,
    });

    const data = await api.get<{ ok: boolean }>('/api/paciente/datos');
    expect(data).toEqual({ ok: true });

    const primeraLlamada = fetchMock.mock.calls[0];
    expect(primeraLlamada).toBeDefined();
    const headers = new Headers(primeraLlamada?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer jwt-ficticio-123');
  });

  it('traduce un 409 con código de negocio a ErrorApi legible', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'SOLAPAMIENTO_BOX' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const api = crearClienteHttp({ obtenerToken: () => 'tok', fetchImpl: fetchMock });

    await expect(api.post('/api/turnos', {})).rejects.toMatchObject({
      status: 409,
      code: 'SOLAPAMIENTO_BOX',
    });

    try {
      await api.post('/api/turnos', {});
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ErrorApi);
      const apiErr = err as ErrorApi;
      expect(apiErr.mensajeLegible.toLowerCase()).toContain('box');
    }
  });

  it('invoca onUnauthorized cuando la API responde 401 NO_AUTENTICADO', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'NO_AUTENTICADO' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const api = crearClienteHttp({
      obtenerToken: () => 'tok-vencido',
      onUnauthorized,
      fetchImpl: fetchMock,
    });

    await expect(api.get('/api/pacientes')).rejects.toMatchObject({
      status: 401,
      code: 'NO_AUTENTICADO',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('Componentes base y errores de negocio', () => {
  it('AlertaErrorNegocio muestra el código 409 y su explicación legible', () => {
    render(<AlertaErrorNegocio code="DUPLICADO" />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('DUPLICADO');
    expect(alerta.textContent?.toLowerCase()).toContain('documento');
  });

  it('BadgeEstadoTurno y EstadoVacio renderizan texto explícito accesible', () => {
    render(
      <div>
        <BadgeEstadoTurno estado="confirmado" />
        <EstadoVacio titulo="Sin turnos hoy" descripcion="Elegí un horario libre para empezar." />
      </div>,
    );
    expect(screen.getByText('Confirmado')).toBeTruthy();
    expect(screen.getByText('Sin turnos hoy')).toBeTruthy();
  });
});

describe('Menú y Layout dinámico por rol', () => {
  it('cambia las opciones del menú según rol y nunca muestra ganancias a recepcionista ni paciente', () => {
    const menuProf = obtenerMenuPorRol('profesional').map((i) => i.etiqueta);
    const menuRecep = obtenerMenuPorRol('recepcionista').map((i) => i.etiqueta);
    const menuPac = obtenerMenuPorRol('paciente').map((i) => i.etiqueta);

    expect(menuProf).toContain('Mis ganancias');
    expect(menuProf).toContain('Historia clínica');

    expect(menuRecep).toContain('Agenda del día');
    expect(menuRecep).toContain('Pacientes');
    expect(menuRecep).not.toContain('Mis ganancias');
    expect(menuRecep).not.toContain('Historia clínica');

    expect(menuPac).toContain('Reservar turno');
    expect(menuPac).toContain('Mis turnos');
    expect(menuPac).not.toContain('Mis ganancias');
  });

  it('AppLayout renderiza el menú correspondiente al rol autenticado', () => {
    establecerSesion({
      token: 'jwt-recep',
      usuario: { id: 'u-1', email: 'recepcion@example.com', rol: 'recepcionista', activo: true },
    });

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <AppLayout titulo="Panel principal">
          <p>Contenido de prueba</p>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText('Recepcionista')).toBeTruthy();
    expect(screen.getByText('Agenda del día')).toBeTruthy();
    expect(screen.queryByText('Mis ganancias')).toBeNull();
  });
});

describe('Pantallas de Login y Registro contra C-04', () => {
  it('LoginPage muestra error claro cuando C-04 responde 401 NO_AUTENTICADO', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'NO_AUTENTICADO' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'paciente1@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: 'clave-incorrecta' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^ingresar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('NO_AUTENTICADO');
    });
  });

  it('RegistroPage valida contraseña menor a 8 caracteres antes de llamar a la API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter initialEntries={['/registro']}>
        <RegistroPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Paciente' } });
    fireEvent.change(screen.getByLabelText(/^apellido/i), { target: { value: 'Ficticio Tres' } });
    fireEvent.change(screen.getByLabelText(/documento/i), { target: { value: '00000003' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
      target: { value: 'paciente3@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^contraseña/i), { target: { value: '1234567' } });

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/al menos 8 caracteres/i);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
