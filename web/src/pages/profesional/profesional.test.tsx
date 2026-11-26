import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establecerSesion, limpiarSesion } from '../../base/sesion';
import { routes } from './routes';

const SESION_PROF = {
  token: 'jwt-prof-1',
  usuario: { id: 'u-prof-1', email: 'profesional@example.com', rol: 'profesional' as const, activo: true },
};

const PROFESIONALES_SEED = [
  { id: 'prof-1', nombre: 'Dra. Ana Pérez', matricula: 'MP-1001', activo: true, usuarioId: 'u-prof-1' },
  { id: 'prof-2', nombre: 'Dr. Bruno Gómez', matricula: 'MP-1002', activo: true, usuarioId: 'u-prof-2' },
];

const BOXES_SEED = [
  { id: 'box-1', nombre: 'Box 1', activo: true },
  { id: 'box-2', nombre: 'Box 2', activo: true },
];

const PRESTACIONES_SEED = [
  { id: 'prest-1', nombre: 'Consulta general', duracionMin: 30, precio: 15000, reservableOnline: true, activa: true },
  { id: 'prest-2', nombre: 'Limpieza dental', duracionMin: 45, precio: 25000, reservableOnline: true, activa: true },
];

function jsonResp(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  });
}

function leerUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function leerBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') return undefined;
  return JSON.parse(init.body) as unknown;
}

function AppPrueba() {
  return useRoutes([
    { path: '/login', element: <div data-testid="pagina-login">Login</div> },
    { path: '/inicio', element: <div data-testid="pagina-inicio">Inicio</div> },
    ...routes,
  ]);
}

function renderRutaProfesional(rutaInicial: string) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <AppPrueba />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.restoreAllMocks();
});

describe('Protección RBAC de rutas del módulo profesional', () => {
  it('Usuario sin sesión es redirigido a login', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderRutaProfesional('/profesional/catalogo');

    expect(screen.getByTestId('pagina-login')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Recepcionista recibe acceso denegado SIN_PERMISO sin llamadas a la API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    establecerSesion({
      token: 'jwt-recep',
      usuario: { id: 'u-recep', email: 'recepcion@example.com', rol: 'recepcionista', activo: true },
    });

    renderRutaProfesional('/profesional/ganancias');

    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('SIN_PERMISO');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Paciente recibe acceso denegado SIN_PERMISO sin llamadas a la API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    establecerSesion({
      token: 'jwt-pac',
      usuario: { id: 'u-pac', email: 'paciente1@example.com', rol: 'paciente', activo: true },
    });

    renderRutaProfesional('/profesional/clinica');

    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('SIN_PERMISO');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Catálogo de prestaciones, boxes y profesionales', () => {
  it('Listado inicial muestra prestaciones con precios ARS, boxes y profesionales', async () => {
    establecerSesion(SESION_PROF);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/prestaciones') return jsonResp(PRESTACIONES_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/catalogo');

    await waitFor(() => {
      expect(screen.getByText('Consulta general')).toBeTruthy();
    });
    expect(screen.getByText('$ 15.000,00')).toBeTruthy();
    expect(screen.getByText('$ 25.000,00')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /boxes/i }));
    await waitFor(() => {
      expect(screen.getByText('Box 1')).toBeTruthy();
      expect(screen.getByText('Box 2')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /profesionales/i }));
    await waitFor(() => {
      expect(screen.getByText('MP-1001')).toBeTruthy();
      expect(screen.getByText('Dr. Bruno Gómez')).toBeTruthy();
    });
    expect(container.textContent?.toLowerCase()).not.toContain('sillón');
  });

  it('Alta y edición de prestación actualiza el catálogo', async () => {
    establecerSesion(SESION_PROF);
    const prestaciones = [...PRESTACIONES_SEED];
    const llamadas: { method: string; url: string; body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      const body = leerBody(init);
      llamadas.push({ method, url, body });

      if (url === '/api/prestaciones' && method === 'GET') return jsonResp(prestaciones);
      if (url === '/api/boxes' && method === 'GET') return jsonResp(BOXES_SEED);
      if (url === '/api/profesionales' && method === 'GET') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/prestaciones' && method === 'POST') {
        const datos = body as { nombre: string; duracionMin: number; precio: number; reservableOnline: boolean };
        const nueva = { id: 'prest-3', ...datos, activa: true };
        prestaciones.push(nueva);
        return jsonResp(nueva, 201);
      }
      if (url === '/api/prestaciones/prest-3' && method === 'PATCH') {
        const datos = body as { precio?: number; nombre?: string; duracionMin?: number };
        const idx = prestaciones.findIndex((p) => p.id === 'prest-3');
        const actual = prestaciones[idx]!;
        const actualizada = { ...actual, ...datos };
        prestaciones[idx] = actualizada;
        return jsonResp(actualizada, 200);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/catalogo');

    await waitFor(() => {
      expect(screen.getByText('Consulta general')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/nombre de la prestación/i), {
      target: { value: 'Control ortodoncia' },
    });
    fireEvent.change(screen.getByLabelText(/duración/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/precio en ars/i), { target: { value: '18000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar prestación/i }));

    await waitFor(() => {
      expect(screen.getByText('Control ortodoncia')).toBeTruthy();
      expect(screen.getByText('$ 18.000,00')).toBeTruthy();
    });

    const filaNueva = screen.getByText('Control ortodoncia').closest('tr');
    expect(filaNueva).toBeTruthy();
    fireEvent.click(within(filaNueva!).getByRole('button', { name: /editar/i }));

    fireEvent.change(screen.getByLabelText(/precio en ars/i), { target: { value: '21500' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar prestación/i }));

    await waitFor(() => {
      expect(screen.getByText('$ 21.500,00')).toBeTruthy();
    });

    expect(llamadas.some((l) => l.method === 'POST' && l.url === '/api/prestaciones')).toBe(true);
    expect(llamadas.some((l) => l.method === 'PATCH' && l.url === '/api/prestaciones/prest-3')).toBe(true);
  });

  it('Selector de duración en múltiplos de 15 y alerta defensiva DURACION_INVALIDA', async () => {
    establecerSesion(SESION_PROF);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/prestaciones' && method === 'GET') return jsonResp(PRESTACIONES_SEED);
      if (url === '/api/boxes' && method === 'GET') return jsonResp(BOXES_SEED);
      if (url === '/api/profesionales' && method === 'GET') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/prestaciones' && method === 'POST') {
        return jsonResp({ code: 'DURACION_INVALIDA' }, 409);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/catalogo');

    await waitFor(() => {
      expect(screen.getByText('Consulta general')).toBeTruthy();
    });

    const selectDuracion = screen.getByLabelText(/duración/i) as HTMLSelectElement;
    expect(selectDuracion.tagName).toBe('SELECT');
    const valores = Array.from(selectDuracion.options).map((o) => Number(o.value));
    expect(valores).toEqual([15, 30, 45, 60, 75, 90, 105, 120, 150, 180]);

    fireEvent.change(screen.getByLabelText(/nombre de la prestación/i), {
      target: { value: 'Prueba duración' },
    });
    fireEvent.change(screen.getByLabelText(/precio en ars/i), { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar prestación/i }));

    await waitFor(() => {
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('DURACION_INVALIDA');
    });
  });

  it('Gestión de boxes y profesionales con errores 400 y 409 visibles', async () => {
    establecerSesion(SESION_PROF);
    const boxes = [...BOXES_SEED];
    let intentoBox = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      const body = leerBody(init);
      if (url === '/api/prestaciones' && method === 'GET') return jsonResp(PRESTACIONES_SEED);
      if (url === '/api/boxes' && method === 'GET') return jsonResp(boxes);
      if (url === '/api/profesionales' && method === 'GET') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/boxes' && method === 'POST') {
        intentoBox += 1;
        if (intentoBox === 1) {
          const nuevo = { id: 'box-3', nombre: (body as { nombre: string }).nombre, activo: true };
          boxes.push(nuevo);
          return jsonResp(nuevo, 201);
        }
        return jsonResp({ code: 'DUPLICADO' }, 409);
      }
      if (url === '/api/profesionales' && method === 'POST') {
        return jsonResp({ code: 'FORMATO_INVALIDO' }, 400);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/catalogo');

    await waitFor(() => {
      expect(screen.getByText('Consulta general')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /boxes/i }));
    fireEvent.change(screen.getByLabelText(/nombre del box/i), { target: { value: 'Box 3' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar box/i }));

    await waitFor(() => {
      expect(screen.getByText('Box 3')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/nombre del box/i), { target: { value: 'Box 3' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar box/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('DUPLICADO');
    });

    fireEvent.click(screen.getByRole('tab', { name: /profesionales/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dr. Prueba' } });
    fireEvent.change(screen.getByLabelText(/matrícula/i), { target: { value: 'MP-1001' } });
    fireEvent.change(screen.getByLabelText(/id de usuario/i), { target: { value: 'u-prof-3' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar profesional/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('FORMATO_INVALIDO');
    });
  });
});

describe('Horarios propios y bloqueos de agenda en grilla de 15 minutos', () => {
  const HORARIOS_SEED = [
    { id: 'h-1', profesionalId: 'prof-1', diaSemana: 1, desde: '09:00', hasta: '13:00' },
  ];
  const BLOQUEOS_SEED = [
    {
      id: 'bloq-1',
      profesionalId: 'prof-1',
      inicio: '2026-11-26T00:00:00-03:00',
      fin: '2026-11-27T00:00:00-03:00',
      motivo: 'Congreso odontológico',
    },
  ];

  it('Carga de horarios propios con selectores múltiplos de 15 minutos', async () => {
    establecerSesion(SESION_PROF);
    const urls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      urls.push(url);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/horarios');

    await waitFor(() => {
      expect(screen.getByText('Congreso odontológico')).toBeTruthy();
    });

    expect(urls).toContain('/api/profesionales/prof-1/horarios');
    expect(urls).toContain('/api/bloqueos');

    const selectDesde = screen.getByLabelText(/desde franja 1/i) as HTMLSelectElement;
    const opciones = Array.from(selectDesde.options).map((o) => o.value);
    expect(opciones.length).toBeGreaterThan(40);
    for (const op of opciones) {
      expect(op).toMatch(/^([01]\d|2[0-3]):(00|15|30|45)$/);
    }
  });

  it('Guardado de horarios propios vía POST /api/profesionales/:id/horarios', async () => {
    establecerSesion(SESION_PROF);
    let bodyPost: unknown = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'GET') return jsonResp(HORARIOS_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'POST') {
        bodyPost = leerBody(init);
        return jsonResp([{ id: 'h-1', profesionalId: 'prof-1', diaSemana: 1, desde: '09:00', hasta: '13:00' }]);
      }
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/horarios');

    await waitFor(() => {
      expect(screen.getByLabelText(/desde franja 1/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /guardar horarios/i }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/horarios guardados/i);
    });
    expect(bodyPost).toEqual({
      horarios: [{ diaSemana: 1, desde: '09:00', hasta: '13:00' }],
    });
  });

  it('Conflicto 409 FUERA_DE_GRILLA al guardar horarios se muestra en alerta', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'GET') return jsonResp(HORARIOS_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'POST') {
        return jsonResp({ code: 'FUERA_DE_GRILLA' }, 409);
      }
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/horarios');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guardar horarios/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /guardar horarios/i }));

    await waitFor(() => {
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('FUERA_DE_GRILLA');
      expect(alerta.textContent).toMatch(/15 minutos/i);
    });
  });

  it('Alta de bloqueo día completo y rango horario opcional respetando exclusión XOR', async () => {
    establecerSesion(SESION_PROF);
    const bloqueos = [...BLOQUEOS_SEED];
    const payloads: Record<string, unknown>[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos' && method === 'GET') return jsonResp(bloqueos);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/bloqueos' && method === 'POST') {
        const body = leerBody(init) as Record<string, unknown>;
        payloads.push(body);
        const creado = { id: `bloq-${payloads.length + 1}`, ...body };
        bloqueos.push(creado as (typeof BLOQUEOS_SEED)[number]);
        return jsonResp(creado, 201);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/horarios');

    await waitFor(() => {
      expect(screen.getByLabelText(/día desde/i)).toBeTruthy();
    });

    // 1. Bloqueo personal de varios días con "Bloquear día completo" activo por defecto
    const checkDiaCompleto = screen.getByLabelText(/bloquear día completo/i) as HTMLInputElement;
    expect(checkDiaCompleto.checked).toBe(true);

    fireEvent.change(screen.getByLabelText(/día desde/i), { target: { value: '2026-11-24' } });
    fireEvent.change(screen.getByLabelText(/día hasta/i), { target: { value: '2026-11-26' } });
    fireEvent.change(screen.getByLabelText(/motivo del bloqueo/i), { target: { value: 'Jornada de capacitación' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));

    await waitFor(() => {
      expect(payloads.length).toBe(1);
    });
    expect(payloads[0]).toEqual({
      profesionalId: 'prof-1',
      inicio: '2026-11-24T00:00:00-03:00',
      fin: '2026-11-27T00:00:00-03:00',
      motivo: 'Jornada de capacitación',
    });
    expect(payloads[0]).not.toHaveProperty('boxId');

    // 2. Cambio a "Un box del consultorio", desmarca día completo y elige 08:00 a 09:00
    fireEvent.click(screen.getByLabelText(/un box del consultorio/i));
    fireEvent.change(screen.getByLabelText(/box a bloquear/i), { target: { value: 'box-1' } });
    fireEvent.click(checkDiaCompleto);
    fireEvent.change(screen.getByLabelText(/día desde/i), { target: { value: '2026-11-28' } });
    fireEvent.change(screen.getByLabelText(/día hasta/i), { target: { value: '2026-11-28' } });
    fireEvent.change(screen.getByLabelText(/hora desde/i), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText(/hora hasta/i), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText(/motivo del bloqueo/i), { target: { value: 'Mantenimiento Box 1' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));

    await waitFor(() => {
      expect(payloads.length).toBe(2);
    });
    expect(payloads[1]).toEqual({
      boxId: 'box-1',
      inicio: '2026-11-28T08:00:00-03:00',
      fin: '2026-11-28T09:00:00-03:00',
      motivo: 'Mantenimiento Box 1',
    });
    expect(payloads[1]).not.toHaveProperty('profesionalId');
  });

  it('Eliminación de bloqueo existente vía DELETE 204', async () => {
    establecerSesion(SESION_PROF);
    let eliminadoUrl = '';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos' && method === 'GET') return jsonResp(BLOQUEOS_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/bloqueos/bloq-1' && method === 'DELETE') {
        eliminadoUrl = url;
        return jsonResp(null, 204);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/horarios');

    await waitFor(() => {
      expect(screen.getByText('Congreso odontológico')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));

    await waitFor(() => {
      expect(screen.queryByText('Congreso odontológico')).toBeNull();
    });
    expect(eliminadoUrl).toBe('/api/bloqueos/bloq-1');
  });
});

describe('Ganancias privadas exclusivas del profesional logueado', () => {
  const TURNOS_GANANCIAS = [
    {
      id: 't-1',
      profesionalId: 'prof-1',
      boxId: 'box-1',
      prestacionId: 'prest-1',
      pacienteId: 'pac-1',
      inicio: '2026-11-10T10:00:00-03:00',
      fin: '2026-11-10T10:30:00-03:00',
      estado: 'atendido',
      origen: 'online',
      precioAlReservar: 15000,
      creadoPor: 'u-pac-1',
      creadoEn: '2026-11-05T12:00:00-03:00',
      paciente: { id: 'pac-1', nombre: 'Paciente Ficticio', apellido: 'Uno' },
      profesional: { id: 'prof-1', nombre: 'Dra. Ana Pérez' },
      box: { id: 'box-1', nombre: 'Box 1' },
      prestacion: { id: 'prest-1', nombre: 'Consulta general', duracionMin: 30 },
    },
    {
      id: 't-2',
      profesionalId: 'prof-1',
      boxId: 'box-2',
      prestacionId: 'prest-2',
      pacienteId: 'pac-2',
      inicio: '2026-11-12T11:00:00-03:00',
      fin: '2026-11-12T11:45:00-03:00',
      estado: 'cancelado',
      origen: 'recepcion',
      precioAlReservar: 25000,
      creadoPor: 'u-recep',
      creadoEn: '2026-11-06T12:00:00-03:00',
      paciente: { id: 'pac-2', nombre: 'Paciente Ficticio', apellido: 'Dos' },
      profesional: { id: 'prof-1', nombre: 'Dra. Ana Pérez' },
      box: { id: 'box-2', nombre: 'Box 2' },
      prestacion: { id: 'prest-2', nombre: 'Limpieza dental', duracionMin: 45 },
    },
  ];

  it('Consulta exclusiva del profesional logueado con KPI ARS y desglose de atendidos', async () => {
    establecerSesion(SESION_PROF);
    const urls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      urls.push(url);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url.startsWith('/api/profesionales/prof-1/ganancias')) return jsonResp({ total: 15000 });
      if (url.startsWith('/api/agenda?')) return jsonResp(TURNOS_GANANCIAS);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/ganancias');

    await waitFor(() => {
      expect(screen.getByText('Paciente Ficticio Uno')).toBeTruthy();
    });

    // Consulta exclusiva del profesional logueado y sin selector de otros profesionales
    expect(urls.some((u) => u.startsWith('/api/profesionales/prof-1/ganancias'))).toBe(true);
    expect(urls.some((u) => u.startsWith('/api/agenda?') && u.includes('profesionalId=prof-1'))).toBe(true);
    expect(urls.some((u) => u.includes('prof-2'))).toBe(false);
    expect(container.querySelectorAll('select').length).toBe(0);
    expect(screen.queryByText('Dr. Bruno Gómez')).toBeNull();

    // KPI ARS y solo turnos atendidos con precioAlReservar congelado
    expect(screen.getAllByText('$ 15.000,00').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Paciente Ficticio Dos')).toBeNull();
  });

  it('Período sin turnos atendidos muestra total en cero y estado vacío', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url.startsWith('/api/profesionales/prof-1/ganancias')) return jsonResp({ total: 0 });
      if (url.startsWith('/api/agenda?')) return jsonResp([]);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/ganancias');

    await waitFor(() => {
      expect(screen.getAllByText('$ 0,00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/sin turnos atendidos en este período/i)).toBeTruthy();
    });
  });

  it('Respuesta 403 SIN_PERMISO al consultar ganancias se informa en alerta', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url.startsWith('/api/profesionales/prof-1/ganancias')) {
        return jsonResp({ code: 'SIN_PERMISO' }, 403);
      }
      if (url.startsWith('/api/agenda?')) return jsonResp(TURNOS_GANANCIAS);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/ganancias');

    await waitFor(() => {
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('SIN_PERMISO');
    });
    expect(screen.queryByText('$ 15.000,00')).toBeNull();
    expect(screen.queryByText('Paciente Ficticio Uno')).toBeNull();
  });
});

describe('Historia clínica append-only y odontograma SVG FDI interactivo', () => {
  const PACIENTES_SEED = [
    {
      id: 'pac-1',
      nombre: 'Paciente Ficticio',
      apellido: 'Uno',
      documento: '00000001',
      email: 'paciente1@example.com',
      obraSocial: 'OSDE',
      plan: '210',
    },
    {
      id: 'pac-2',
      nombre: 'Paciente Ficticio',
      apellido: 'Dos',
      documento: '00000002',
      email: 'paciente2@example.com',
    },
  ];

  const HISTORIA_SEED = [
    {
      id: 'hc-1',
      pacienteId: 'pac-1',
      profesionalId: 'prof-1',
      fecha: '2026-11-23T09:35:00-03:00',
      texto: 'Control inicial: caries oclusal en pieza 16.',
    },
  ];

  const ODONTOGRAMA_SEED = {
    odontogramaId: 'odo-1',
    pacienteId: 'pac-1',
    actualizadoEn: '2026-11-23T09:40:00-03:00',
    piezas: [
      {
        id: 'ep-1',
        odontogramaId: 'odo-1',
        pieza: 16,
        cara: 'oclusal',
        estado: 'caries',
        registradoPor: 'prof-1',
        fecha: '2026-11-23T09:40:00-03:00',
      },
    ],
    historial: [
      {
        id: 'ep-1',
        odontogramaId: 'odo-1',
        pieza: 16,
        cara: 'oclusal',
        estado: 'caries',
        registradoPor: 'prof-1',
        fecha: '2026-11-23T09:40:00-03:00',
      },
    ],
  };

  it('Carga de paciente e historia clínica append-only sin edición ni borrado', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp(HISTORIA_SEED);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/clinica');

    await waitFor(() => {
      expect(screen.getByText('Control inicial: caries oclusal en pieza 16.')).toBeTruthy();
    });

    // 32 piezas permanentes visibles
    expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);

    // Historia clínica append-only: sin botones de editar ni borrar
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).toBeNull();
  });

  it('Alta de nueva evolución y de corrección referenciando corrigeAId', async () => {
    establecerSesion(SESION_PROF);
    const historia = [...HISTORIA_SEED];
    const payloads: Record<string, unknown>[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia' && method === 'GET') return jsonResp(historia);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_SEED);
      if (url === '/api/pacientes/pac-1/historia' && method === 'POST') {
        const body = leerBody(init) as { texto: string; corrigeAId?: string };
        payloads.push(body);
        const nueva = {
          id: `hc-${historia.length + 1}`,
          pacienteId: 'pac-1',
          profesionalId: 'prof-1',
          fecha: '2026-11-23T10:15:00-03:00',
          ...body,
        };
        historia.push(nueva);
        return jsonResp(nueva, 201);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/clinica');

    await waitFor(() => {
      expect(screen.getByText('Control inicial: caries oclusal en pieza 16.')).toBeTruthy();
    });

    // 1. Evolución nueva sin corrigeAId
    fireEvent.change(screen.getByLabelText(/evolución clínica/i), {
      target: { value: 'Se indica profilaxis y control en 15 días.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar evolución/i }));

    await waitFor(() => {
      expect(screen.getByText('Se indica profilaxis y control en 15 días.')).toBeTruthy();
    });

    // 2. Corrección referenciando hc-1
    const botonesCorreccion = screen.getAllByRole('button', { name: /agregar corrección/i });
    fireEvent.click(botonesCorreccion[0]!);
    fireEvent.change(screen.getByLabelText(/corrección sobre entrada/i), {
      target: { value: 'Aclaración: pieza 16 presenta lesión incipiente.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /registrar corrección/i }));

    await waitFor(() => {
      expect(screen.getByText('Aclaración: pieza 16 presenta lesión incipiente.')).toBeTruthy();
    });

    expect(payloads[0]).toEqual({ texto: 'Se indica profilaxis y control en 15 días.' });
    expect(payloads[1]).toEqual({
      texto: 'Aclaración: pieza 16 presenta lesión incipiente.',
      corrigeAId: 'hc-1',
    });
    expect(screen.getByText('Control inicial: caries oclusal en pieza 16.')).toBeTruthy();
  });

  it('Selección de pieza y cara en odontograma FDI con orientación anatómica y toggle temporario', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp(HISTORIA_SEED);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/clinica');

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
    });

    // Cara mesial de pieza 16 es la zona derecha del glifo en cuadrante 1
    const caraMesial16 = container.querySelector('[data-pieza="16"][data-cara="mesial"]');
    expect(caraMesial16).toBeTruthy();
    expect(caraMesial16?.getAttribute('data-posicion')).toBe('right');
    fireEvent.click(caraMesial16!);

    expect(screen.getByTestId('editor-pieza-badge').textContent).toContain('Pieza 16');
    expect(screen.getByTestId('editor-pieza-badge').textContent?.toLowerCase()).toContain('mesial');

    // Toggle temporario suma 20 piezas (51–85) -> total 52
    fireEvent.click(screen.getByLabelText(/mostrar dentición temporaria/i));
    expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(52);
    const caraTemporaria = container.querySelector('[data-pieza="55"][data-cara="oclusal"]');
    expect(caraTemporaria?.getAttribute('aria-label')).toContain('Pieza 55');
  });

  it('Estados de pieza completa deshabilitan cara y actualizan odontograma vía PUT', async () => {
    establecerSesion(SESION_PROF);
    let bodyPut: unknown = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp(HISTORIA_SEED);
      if (url === '/api/pacientes/pac-1/odontograma' && method === 'GET') {
        return jsonResp(ODONTOGRAMA_SEED);
      }
      if (url === '/api/pacientes/pac-1/odontograma' && method === 'PUT') {
        bodyPut = leerBody(init);
        const nuevoReg = {
          id: 'ep-2',
          odontogramaId: 'odo-1',
          pieza: 26,
          estado: 'corona',
          registradoPor: 'prof-1',
          fecha: '2026-11-23T11:00:00-03:00',
        };
        return jsonResp({
          ...ODONTOGRAMA_SEED,
          actualizadoEn: '2026-11-23T11:00:00-03:00',
          piezas: [...ODONTOGRAMA_SEED.piezas, nuevoReg],
          historial: [...ODONTOGRAMA_SEED.historial, nuevoReg],
        });
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/clinica');

    await waitFor(() => {
      expect(container.querySelector('[data-pieza="26"][data-cara="oclusal"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-pieza="26"][data-cara="oclusal"]')!);

    const selectEstado = screen.getByLabelText(/estado clínico/i) as HTMLSelectElement;
    const selectCara = screen.getByLabelText(/cara anatómica/i) as HTMLSelectElement;
    expect(selectCara.disabled).toBe(false);

    fireEvent.change(selectEstado, { target: { value: 'corona' } });
    expect(selectCara.disabled).toBe(true);
    expect(selectCara.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /guardar en odontograma/i }));

    await waitFor(() => {
      expect(container.querySelector('[data-pieza="26"] [data-overlay="corona"]')).toBeTruthy();
    });

    expect(bodyPut).toEqual({
      piezas: [{ pieza: 26, estado: 'corona' }],
    });
    // Verifica que la tabla historial refleja la nueva entrada para pieza 26 Corona
    const tablaHistorial = screen.getByRole('table', { name: /historial del odontograma/i });
    expect(tablaHistorial.textContent).toContain('26');
    expect(tablaHistorial.textContent).toContain('Corona');
  });
});

describe('Agenda profesional y auditoría append-only de turnos', () => {
  const TURNOS_AGENDA = [
    {
      id: 'turno-1',
      profesionalId: 'prof-1',
      boxId: 'box-1',
      prestacionId: 'prest-1',
      pacienteId: 'pac-1',
      inicio: '2026-11-23T09:00:00-03:00',
      fin: '2026-11-23T09:30:00-03:00',
      estado: 'confirmado',
      origen: 'online',
      precioAlReservar: 15000,
      creadoPor: 'u-pac-1',
      creadoEn: '2026-11-20T12:00:00-03:00',
      paciente: { id: 'pac-1', nombre: 'Paciente Ficticio', apellido: 'Uno' },
      profesional: { id: 'prof-1', nombre: 'Dra. Ana Pérez' },
      box: { id: 'box-1', nombre: 'Box 1' },
      prestacion: { id: 'prest-1', nombre: 'Consulta general', duracionMin: 30 },
    },
  ];

  const AUDITORIA_SEED = [
    {
      id: 'aud-1',
      turnoId: 'turno-1',
      accion: 'creado',
      actor: 'paciente',
      fecha: '2026-11-20T12:00:00-03:00',
      detalle: {
        despues: {
          inicio: '2026-11-23T09:00:00-03:00',
          fin: '2026-11-23T09:30:00-03:00',
          boxId: 'box-1',
          estado: 'reservado',
        },
      },
    },
    {
      id: 'aud-2',
      turnoId: 'turno-1',
      accion: 'estado_cambiado',
      actor: 'u-recep',
      fecha: '2026-11-21T09:15:00-03:00',
      detalle: { antes: { estado: 'reservado' }, despues: { estado: 'confirmado' } },
    },
    {
      id: 'aud-3',
      turnoId: 'turno-1',
      accion: 'reprogramado',
      actor: 'u-prof-1',
      fecha: '2026-11-22T10:00:00-03:00',
      detalle: {
        antes: { inicio: '2026-11-23T09:00:00-03:00', fin: '2026-11-23T09:30:00-03:00', estado: 'confirmado' },
        despues: { inicio: '2026-11-23T10:00:00-03:00', fin: '2026-11-23T10:30:00-03:00', boxId: 'box-2', estado: 'reservado' },
      },
    },
  ];

  it('Listado de turnos en agenda profesional mediante GET /api/agenda', async () => {
    establecerSesion(SESION_PROF);
    const urlsAgenda: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url.startsWith('/api/agenda?')) {
        urlsAgenda.push(url);
        return jsonResp(TURNOS_AGENDA);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/agenda');

    await waitFor(() => {
      expect(screen.getByText('Paciente Ficticio Uno')).toBeTruthy();
    });

    expect(screen.getByText('Confirmado')).toBeTruthy();
    expect(screen.getByRole('link', { name: /ver historial/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/filtrar por profesional/i), { target: { value: 'prof-1' } });
    fireEvent.change(screen.getByLabelText(/filtrar por box/i), { target: { value: 'box-1' } });

    await waitFor(() => {
      expect(
        urlsAgenda.some((u) => u.includes('profesionalId=prof-1') && u.includes('boxId=box-1')),
      ).toBe(true);
    });
  });

  it('Panel de auditoría muestra cronología append-only de un turno', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/turnos/turno-1/auditoria') return jsonResp(AUDITORIA_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderRutaProfesional('/profesional/turnos/turno-1/auditoria');

    await waitFor(() => {
      expect(screen.getByText('Cambio de estado')).toBeTruthy();
    });

    expect(screen.getByText('Turno reservado')).toBeTruthy();
    expect(screen.getByText('Turno reprogramado')).toBeTruthy();
    expect(screen.getByText(/Paciente \(reserva online\)/i)).toBeTruthy();
    expect(screen.getByText(/Recepción/i)).toBeTruthy();
    expect(screen.getByText(/Nuevo horario:/i)).toBeTruthy();
    expect(screen.getAllByText('Reservado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Confirmado')).toBeTruthy();

    // Sin JSON crudo ni jerga técnica para el odontólogo
    const texto = container.textContent ?? '';
    expect(texto).not.toContain('{');
    expect(texto).not.toContain('estado_cambiado');
    expect(texto).not.toContain('append-only');

    // Historial solo lectura: sin botones de editar ni borrar
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).toBeNull();
  });

  it('Profesional confirma o marca atendido o ausente un turno desde su agenda', async () => {
    establecerSesion(SESION_PROF);
    const turnosMutables = [
      {
        ...TURNOS_AGENDA[0]!,
        id: 'turno-res-1',
        estado: 'reservado' as const,
      },
      {
        ...TURNOS_AGENDA[0]!,
        id: 'turno-conf-2',
        inicio: '2026-11-23T10:00:00-03:00',
        fin: '2026-11-23T10:30:00-03:00',
        estado: 'confirmado' as const,
        paciente: { id: 'pac-2', nombre: 'Paciente Ficticio', apellido: 'Dos' },
      },
    ];
    const llamadasEstado: { url: string; body: unknown }[] = [];
    let consultasAgenda = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url.startsWith('/api/agenda?') && method === 'GET') {
        consultasAgenda += 1;
        return jsonResp(turnosMutables);
      }
      if (url.startsWith('/api/turnos/') && url.endsWith('/estado') && method === 'POST') {
        const body = leerBody(init);
        llamadasEstado.push({ url, body });
        return jsonResp({ ok: true });
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderRutaProfesional('/profesional/agenda');

    await waitFor(() => {
      expect(screen.getByText('Paciente Ficticio Uno')).toBeTruthy();
      expect(screen.getByText('Paciente Ficticio Dos')).toBeTruthy();
    });

    const consultasAntes = consultasAgenda;
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => {
      expect(llamadasEstado).toContainEqual({
        url: '/api/turnos/turno-res-1/estado',
        body: { estado: 'confirmado' },
      });
      expect(consultasAgenda).toBeGreaterThan(consultasAntes);
    });

    const consultasIntermedias = consultasAgenda;
    fireEvent.click(screen.getByRole('button', { name: /marcar atendido/i }));

    await waitFor(() => {
      expect(llamadasEstado).toContainEqual({
        url: '/api/turnos/turno-conf-2/estado',
        body: { estado: 'atendido' },
      });
      expect(consultasAgenda).toBeGreaterThan(consultasIntermedias);
    });
  });
});

describe('Datos ficticios, terminología box y layout sin scroll horizontal', () => {
  it('Interfaz y textos visibles cumplen RN-DA-01, usan box y evitan scroll horizontal', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/prestaciones') return jsonResp(PRESTACIONES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp([]);
      if (url === '/api/bloqueos') return jsonResp([]);
      if (url.startsWith('/api/profesionales/prof-1/ganancias')) return jsonResp({ total: 0 });
      if (url.startsWith('/api/agenda?')) return jsonResp([]);
      if (url === '/api/pacientes') {
        return jsonResp([
          {
            id: 'pac-1',
            nombre: 'Paciente Ficticio',
            apellido: 'Uno',
            documento: '00000001',
            email: 'paciente1@example.com',
          },
        ]);
      }
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma') {
        return jsonResp({
          odontogramaId: null,
          pacienteId: 'pac-1',
          actualizadoEn: null,
          piezas: [],
          historial: [],
        });
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const rutas = [
      '/profesional/catalogo',
      '/profesional/horarios',
      '/profesional/ganancias',
      '/profesional/clinica',
      '/profesional/agenda',
    ];

    for (const ruta of rutas) {
      const { container } = renderRutaProfesional(ruta);
      await waitFor(() => {
        expect(container.querySelector('main')).toBeTruthy();
      });
      const texto = container.textContent ?? '';
      expect(texto.toLowerCase()).not.toContain('sillón');
      expect(texto.toLowerCase()).not.toContain('sillon');
      expect(texto).not.toMatch(/\b[1-9]\d\.\d{3}\.\d{3}\b/);
      cleanup();
    }

    // Verifica en profesional.css la ausencia de overflow-x horizontal y el uso de grilla fluida
    const css = readFileSync(resolve(__dirname, 'profesional.css'), 'utf-8');
    expect(css).not.toMatch(/overflow-x\s*:\s*(auto|scroll)/i);
    expect(css).toContain('repeat(8, minmax(0, 1fr))');
    expect(css).toContain('aspect-ratio: 1');
  });
});
