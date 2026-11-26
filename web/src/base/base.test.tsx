import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearClienteHttp, ErrorApi } from './api';
import {
  AlertaErrorNegocio,
  AvatarIniciales,
  BadgeEstadoTurno,
  Boton,
  EstadoVacio,
  obtenerIniciales,
  Tabla,
} from './components';
import { AppLayout } from './AppLayout';
import { InicioPage } from './InicioPage';
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

  it('BadgeEstadoTurno activa pulso solo en turnos activos (reservado/confirmado) y EstadoVacio renderiza texto', () => {
    const { container } = render(
      <div>
        <BadgeEstadoTurno estado="confirmado" />
        <BadgeEstadoTurno estado="atendido" />
        <EstadoVacio titulo="Sin turnos hoy" descripcion="Elegí un horario libre para empezar." />
      </div>,
    );
    expect(screen.getByText('Confirmado')).toBeTruthy();
    expect(screen.getByText('Atendido')).toBeTruthy();
    expect(screen.getByText('Sin turnos hoy')).toBeTruthy();

    const badges = container.querySelectorAll('[data-estado-activo]');
    expect(badges[0]?.getAttribute('data-estado-activo')).toBe('true');
    expect(badges[1]?.getAttribute('data-estado-activo')).toBe('false');
  });

  it('Tabla en estado cargando muestra skeleton loader accesible y Boton cargando muestra spinner', () => {
    render(
      <div>
        <Boton cargando textoCargando="Guardando…">
          Guardar
        </Boton>
        <Tabla
          columnas={[{ encabezado: 'Horario', render: (x: { id: string }) => x.id }]}
          filas={[]}
          claveFila={(x) => x.id}
          cargando
        />
      </div>,
    );

    const boton = screen.getByRole('button', { name: /guardando/i });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');

    const skeleton = screen.getByRole('status');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
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

  it('AppLayout renderiza el menú del rol y el indicador activo deslizante del sidebar', () => {
    establecerSesion({
      token: 'jwt-recep',
      usuario: { id: 'u-1', email: 'recepcion@example.com', rol: 'recepcionista', activo: true },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/inicio']}>
        <AppLayout titulo="Panel principal">
          <p>Contenido de prueba</p>
        </AppLayout>
      </MemoryRouter>,
    );

    expect(screen.getByText('Recepcionista')).toBeTruthy();
    expect(screen.getByText('Agenda del día')).toBeTruthy();
    expect(screen.queryByText('Mis ganancias')).toBeNull();
    expect(container.querySelector('[data-indicador-activo="true"]')).toBeTruthy();
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

describe('Inicio diferenciado por rol y limpieza de interfaz', () => {
  const TURNOS_HOY_API = [
    {
      id: 't-hoy-1',
      profesionalId: 'prof-1',
      boxId: 'box-1',
      prestacionId: 'prest-1',
      pacienteId: 'pac-1',
      inicio: '2026-11-23T09:00:00-03:00',
      fin: '2026-11-23T09:30:00-03:00',
      estado: 'confirmado' as const,
      origen: 'recepcion' as const,
      creadoPor: 'u-r',
      creadoEn: '2026-11-20T08:00:00-03:00',
      paciente: { id: 'pac-1', nombre: 'Emilio', apellido: 'Ravenna' },
      profesional: { id: 'prof-1', nombre: 'Dra. Ana Pérez' },
      box: { id: 'box-1', nombre: 'Box 1' },
      prestacion: { id: 'prest-1', nombre: 'Consulta', duracionMin: 30 },
    },
    {
      id: 't-hoy-2',
      profesionalId: 'prof-1',
      boxId: 'box-1',
      prestacionId: 'prest-2',
      pacienteId: 'pac-2',
      inicio: '2026-11-23T10:30:00-03:00',
      fin: '2026-11-23T10:45:00-03:00',
      estado: 'reservado' as const,
      origen: 'recepcion' as const,
      creadoPor: 'u-r',
      creadoEn: '2026-11-20T08:00:00-03:00',
      paciente: { id: 'pac-2', nombre: 'Mafalda', apellido: 'de Quino' },
      profesional: { id: 'prof-1', nombre: 'Dra. Ana Pérez' },
      box: { id: 'box-1', nombre: 'Box 1' },
      prestacion: { id: 'prest-2', nombre: 'Control', duracionMin: 15 },
    },
  ];

  function jsonResp(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('Profesional ve métricas del día y su agenda sin jerga técnica', async () => {
    establecerSesion({
      token: 'jwt-prof',
      usuario: { id: 'u-p', email: 'profesional@example.com', rol: 'profesional', activo: true },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/profesionales')) {
        return jsonResp([{ id: 'prof-1', nombre: 'Dra. Ana Pérez', matricula: 'MP-1001', activo: true, usuarioId: 'u-p' }]);
      }
      if (url.includes('/api/agenda')) {
        return jsonResp(TURNOS_HOY_API);
      }
      return jsonResp([]);
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/inicio']}>
        <InicioPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Emilio Ravenna')).toBeTruthy();
    });

    expect(screen.getByText(/turnos de hoy/i)).toBeTruthy();
    expect(screen.getByText(/próximo paciente/i)).toBeTruthy();
    expect(screen.getByText(/box asignado/i)).toBeTruthy();
    expect(screen.getByText(/tu agenda de hoy/i)).toBeTruthy();
    expect(screen.queryByText('Datos de ejemplo')).toBeNull();
    expect(container.textContent).not.toContain('Lucía Fernández');
    expect(container.textContent).not.toMatch(/C-04|C-12|token Bearer|Maqueta base|datos ficticios/i);
  });

  it('Recepcionista ve boxes, pendientes, botón + Nuevo turno y actualiza estados en vivo', async () => {
    establecerSesion({
      token: 'jwt-recep',
      usuario: { id: 'u-r', email: 'recepcion@example.com', rol: 'recepcionista', activo: true },
    });

    const turnosMutables = TURNOS_HOY_API.map((t) => ({ ...t }));
    const llamadasEstado: { url: string; body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/api/agenda') && method === 'GET') {
        return jsonResp(turnosMutables);
      }
      if (url.includes('/api/turnos/') && url.endsWith('/estado') && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { estado: 'confirmado' | 'atendido' };
        llamadasEstado.push({ url, body });
        const id = url.split('/api/turnos/')[1]?.split('/estado')[0];
        const idx = turnosMutables.findIndex((t) => t.id === id);
        if (idx >= 0 && turnosMutables[idx]) {
          turnosMutables[idx] = { ...turnosMutables[idx], estado: body.estado } as (typeof turnosMutables)[number];
        }
        return jsonResp(turnosMutables[idx] ?? {});
      }
      return jsonResp([]);
    });

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <InicioPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Emilio Ravenna')).toBeTruthy();
    });

    expect(screen.getByText(/estado · box 1/i)).toBeTruthy();
    expect(screen.getByText(/estado · box 2/i)).toBeTruthy();
    expect(screen.getByText(/pendientes de confirmar/i)).toBeTruthy();
    expect(screen.queryByText('Datos de ejemplo')).toBeNull();
    expect(screen.getByRole('button', { name: /\+ nuevo turno/i })).toBeTruthy();
    expect(screen.queryByText(/mis ganancias/i)).toBeNull();
    expect(screen.getByText('1 turno')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByText('0 turnos')).toBeTruthy();
    });
    expect(llamadasEstado[0]).toEqual({
      url: '/api/turnos/t-hoy-2/estado',
      body: { estado: 'confirmado' },
    });

    const botonesAtendido = screen.getAllByRole('button', { name: /marcar atendido/i });
    fireEvent.click(botonesAtendido[0]!);

    await waitFor(() => {
      expect(screen.getByText('Atendido')).toBeTruthy();
    });
    expect(llamadasEstado[1]).toEqual({
      url: '/api/turnos/t-hoy-1/estado',
      body: { estado: 'atendido' },
    });
  });

  it('Paciente ve solo su próximo turno con bloque calendario y nunca turnos ajenos', async () => {
    establecerSesion({
      token: 'jwt-pac',
      usuario: { id: 'u-pac', email: 'santos@example.com', rol: 'paciente', activo: true },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/paciente/datos')) {
        return jsonResp({
          id: 'pac-santos',
          nombre: 'Mario',
          apellido: 'Santos',
          documento: '00000101',
          email: 'santos@example.com',
        });
      }
      if (url.includes('/api/public/prestaciones')) {
        return jsonResp([
          { id: '00000000-0000-4000-8000-000000000304', nombre: 'Control', duracionMin: 15, reservableOnline: true, activa: true },
        ]);
      }
      if (url.includes('/api/paciente/turnos')) {
        return jsonResp([
          {
            id: 't-santos-1',
            profesionalId: '00000000-0000-4000-8000-000000000101',
            boxId: '00000000-0000-4000-8000-000000000201',
            pacienteId: 'pac-santos',
            prestacionId: '00000000-0000-4000-8000-000000000304',
            inicio: '2099-11-30T09:45:00-03:00',
            fin: '2099-11-30T10:00:00-03:00',
            estado: 'confirmado',
            origen: 'online',
          },
        ]);
      }
      return jsonResp([]);
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/inicio']}>
        <InicioPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Control \(15 min\)/i)).toBeTruthy();
    });

    expect(screen.getByText(/tu próximo turno/i)).toBeTruthy();
    expect(screen.queryByText('Datos de ejemplo')).toBeNull();
    expect(screen.getByText('NOV')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText(/información de la clínica/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reprogramar turno/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancelar turno/i })).toBeTruthy();
    expect(container.textContent).not.toContain('Lucía Fernández');
    expect(container.textContent).not.toContain('Martín Quiroga');
    expect(container.textContent).not.toContain('Sofía Morales');
    expect(container.textContent).not.toContain('Tomás Benítez');
    expect(container.textContent).not.toMatch(/C-04|C-12|token Bearer|Maqueta base/i);
  });

  it('Barra lateral muestra el nombre real del paciente desde la API y traduce nuevos códigos 409', async () => {
    establecerSesion({
      token: 'jwt-pac',
      usuario: { id: 'u-santos', email: 'santos@example.com', rol: 'paciente', activo: true },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/paciente/datos')) {
        return jsonResp({
          id: 'pac-santos',
          nombre: 'Mario',
          apellido: 'Santos',
          documento: '00000101',
          email: 'santos@example.com',
        });
      }
      return jsonResp([]);
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/inicio']}>
        <AppLayout titulo="Panel paciente">
          <p>Contenido</p>
        </AppLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Mario Santos')).toBeTruthy();
    });
    expect(container.textContent).toContain('MS');
    expect(container.textContent).not.toContain('Lucía Fernández');

    const errSolapamiento = new ErrorApi(409, 'SOLAPAMIENTO_PACIENTE');
    const errPendiente = new ErrorApi(409, 'TURNO_PENDIENTE_EXISTENTE');
    expect(errSolapamiento.mensajeLegible.toLowerCase()).toContain('paciente');
    expect(errPendiente.mensajeLegible.toLowerCase()).toContain('pendiente');
  });

  it('AvatarIniciales ignora títulos profesionales y genera iniciales consistentes', () => {
    expect(obtenerIniciales('Dra. Ana Pérez')).toBe('AP');
    expect(obtenerIniciales('Dr. Bruno Gómez')).toBe('BG');
    expect(obtenerIniciales('Mario Santos')).toBe('MS');

    const { container } = render(<AvatarIniciales nombre="Mario Santos" />);
    expect(container.textContent).toBe('MS');
  });
});
