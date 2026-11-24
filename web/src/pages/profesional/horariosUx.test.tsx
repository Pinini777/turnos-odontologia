import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establecerSesion, limpiarSesion } from '../../base/sesion';
import {
  diaSiguienteIso,
  esBloqueoDiaCompleto,
  fechaLocalADateIso,
  formatearFechaCortaIso,
  obtenerAtajosFechaBloqueo,
  sumarMinutosEnGrilla,
} from './formatos';
import { routes } from './routes';

const SESION_PROF = {
  token: 'jwt-prof-horarios',
  usuario: {
    id: 'u-prof-1',
    email: 'profesional@example.com',
    rol: 'profesional' as const,
    activo: true,
  },
};

const PROFESIONALES_SEED = [
  { id: 'prof-1', nombre: 'Dra. Ana Pérez', matricula: 'MP-1001', activo: true, usuarioId: 'u-prof-1' },
];

const BOXES_SEED = [
  { id: 'box-1', nombre: 'Box 1', activo: true },
  { id: 'box-2', nombre: 'Box 2', activo: true },
  { id: 'box-3', nombre: 'Box 3 (Inactivo)', activo: false },
];

const HORARIOS_SEED = [
  { id: 'h-1', profesionalId: 'prof-1', diaSemana: 1 as const, desde: '09:00', hasta: '13:00' },
];

const BLOQUEOS_MIX_SEED = [
  {
    id: 'bloq-prof',
    profesionalId: 'prof-1',
    inicio: '2026-11-26T00:00:00-03:00',
    fin: '2026-11-27T00:00:00-03:00',
    motivo: 'Congreso odontológico',
  },
  {
    id: 'bloq-box',
    boxId: 'box-1',
    inicio: '2026-11-28T08:00:00-03:00',
    fin: '2026-11-28T09:00:00-03:00',
    motivo: 'Mantenimiento de box',
  },
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

function renderHorarios() {
  return render(
    <MemoryRouter initialEntries={['/profesional/horarios']}>
      <AppPrueba />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.restoreAllMocks();
});

describe('Helpers puros de horarios y bloqueos intuitivos', () => {
  it('calcula atajos de fecha para día hábil y fin de semana', () => {
    // Martes 2026-11-24
    const martes = obtenerAtajosFechaBloqueo(new Date(2026, 10, 24));
    expect(martes.hoy).toEqual({ desde: '2026-11-24', hasta: '2026-11-24' });
    expect(martes.manana).toEqual({ desde: '2026-11-25', hasta: '2026-11-25' });
    expect(martes.estaSemana).toEqual({ desde: '2026-11-24', hasta: '2026-11-27' });
    expect(martes.proximaSemana).toEqual({ desde: '2026-11-30', hasta: '2026-12-04' });

    // Sábado 2026-11-28 → Esta semana proyecta lun–vie entrante; Próxima semana proyecta la siguiente
    const sabado = obtenerAtajosFechaBloqueo(new Date(2026, 10, 28));
    expect(sabado.estaSemana).toEqual({ desde: '2026-11-30', hasta: '2026-12-04' });
    expect(sabado.proximaSemana).toEqual({ desde: '2026-12-07', hasta: '2026-12-11' });

    // Domingo 2026-11-29 → misma semana entrante lun–vie y siguiente
    const domingo = obtenerAtajosFechaBloqueo(new Date(2026, 10, 29));
    expect(domingo.estaSemana).toEqual({ desde: '2026-11-30', hasta: '2026-12-04' });
    expect(domingo.proximaSemana).toEqual({ desde: '2026-12-07', hasta: '2026-12-11' });
  });

  it('suma minutos sobre la grilla de 15 minutos con tope 21:45', () => {
    expect(sumarMinutosEnGrilla('15:00', 60)).toBe('16:00');
    expect(sumarMinutosEnGrilla('15:00', 120)).toBe('17:00');
    expect(sumarMinutosEnGrilla('21:15', 60)).toBe('21:45');
    expect(sumarMinutosEnGrilla('21:45', 60)).toBe('21:45');
  });

  it('formatea fecha ISO corta a dd/mm/yyyy y detecta bloqueos de día completo', () => {
    expect(formatearFechaCortaIso('2026-11-28')).toBe('28/11/2026');
    expect(esBloqueoDiaCompleto('2026-11-26T00:00:00-03:00', '2026-11-27T00:00:00-03:00')).toBe(true);
    expect(esBloqueoDiaCompleto('2026-11-28T08:00:00-03:00', '2026-11-28T09:00:00-03:00')).toBe(false);
  });
});

describe('HorariosPage — UX intuitiva de bloqueos y horarios semanales', () => {
  it('Chips de box sincronizados con el selector de bloqueo', async () => {
    establecerSesion(SESION_PROF);
    const payloads: Record<string, unknown>[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos' && method === 'GET') return jsonResp(BLOQUEOS_MIX_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/bloqueos' && method === 'POST') {
        const body = leerBody(init) as Record<string, unknown>;
        payloads.push(body);
        return jsonResp({ id: 'bloq-nuevo', ...body }, 201);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByLabelText(/un box del consultorio/i)).toBeTruthy();
    });

    // No aparece jerga técnica "(exclusión mutua)"
    expect(screen.queryByText(/exclusión mutua/i)).toBeNull();

    // Seleccionar alcance Box
    fireEvent.click(screen.getByLabelText(/un box del consultorio/i));

    // Chips solo para boxes activos (Box 1 y Box 2; Box 3 inactivo no aparece como chip)
    const chipBox2 = screen.getByRole('button', { name: 'Box 2' });
    expect(screen.queryByRole('button', { name: 'Box 3 (Inactivo)' })).toBeNull();
    fireEvent.click(chipBox2);

    expect(chipBox2.getAttribute('aria-pressed')).toBe('true');
    const selectBox = screen.getByLabelText(/box a bloquear/i) as HTMLSelectElement;
    expect(selectBox.value).toBe('box-2');

    // Fecha específica y motivo por chip contextual de box
    fireEvent.change(screen.getByLabelText(/día desde/i), { target: { value: '2026-11-28' } });
    fireEvent.change(screen.getByLabelText(/día hasta/i), { target: { value: '2026-11-28' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mantenimiento de box' }));

    // Resumen previo legible antes de confirmar
    const preview = screen.getByTestId('bloqueo-preview');
    expect(preview.textContent).toContain('Box 2');
    expect(preview.textContent).toContain('28/11/2026');
    expect(preview.textContent).toContain('día completo');
    expect(preview.textContent).toContain('Mantenimiento de box');

    fireEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));

    await waitFor(() => {
      expect(payloads).toHaveLength(1);
    });
    expect(payloads[0]).toEqual({
      boxId: 'box-2',
      inicio: '2026-11-28T00:00:00-03:00',
      fin: '2026-11-29T00:00:00-03:00',
      motivo: 'Mantenimiento de box',
    });
    expect(payloads[0]).not.toHaveProperty('profesionalId');
  });

  it('atajos 1-click de fecha (Hoy, Mañana, Próxima semana) y chips contextuales de motivo completan los campos', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_MIX_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mañana' })).toBeTruthy();
    });

    const hoyIso = fechaLocalADateIso(new Date());
    const mananaIso = diaSiguienteIso(hoyIso);

    const inputDesde = screen.getByLabelText(/día desde/i) as HTMLInputElement;
    const inputHasta = screen.getByLabelText(/día hasta/i) as HTMLInputElement;
    const inputMotivo = screen.getByLabelText(/motivo del bloqueo/i) as HTMLInputElement;

    // Atajo Mañana
    fireEvent.click(screen.getByRole('button', { name: 'Mañana' }));
    expect(inputDesde.value).toBe(mananaIso);
    expect(inputHasta.value).toBe(mananaIso);

    // Atajo Próxima semana (rango multi-día lun→vie)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(inputHasta.value > inputDesde.value).toBe(true);

    // Atajo Hoy vuelve al día actual
    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(inputDesde.value).toBe(hoyIso);
    expect(inputHasta.value).toBe(hoyIso);

    // Chips de motivo para alcance profesional
    expect(screen.queryByRole('button', { name: 'Mantenimiento de box' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ausencia personal' }));
    expect(inputMotivo.value).toBe('Ausencia personal');

    // Al cambiar a Box se actualizan los chips de motivo
    fireEvent.click(screen.getByLabelText(/un box del consultorio/i));
    expect(screen.queryByRole('button', { name: 'Ausencia personal' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpieza y desinfección' }));
    expect(inputMotivo.value).toBe('Limpieza y desinfección');
  });

  it('Atajos de fecha y franja horaria con autoajuste de Hora hasta', async () => {
    establecerSesion(SESION_PROF);
    const postSpy = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos' && method === 'GET') return jsonResp(BLOQUEOS_MIX_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      if (url === '/api/bloqueos' && method === 'POST') {
        postSpy(leerBody(init));
        return jsonResp({ id: 'bloq-x', ...(leerBody(init) as Record<string, unknown>) }, 201);
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /elegir franja horaria/i })).toBeTruthy();
    });

    const hoyIso = fechaLocalADateIso(new Date());
    const mananaIso = diaSiguienteIso(hoyIso);
    const inputDesde = screen.getByLabelText(/día desde/i) as HTMLInputElement;
    const inputHasta = screen.getByLabelText(/día hasta/i) as HTMLInputElement;

    // Atajos 1-click de fecha
    fireEvent.click(screen.getByRole('button', { name: 'Mañana' }));
    expect(inputDesde.value).toBe(mananaIso);
    expect(inputHasta.value).toBe(mananaIso);

    fireEvent.click(screen.getByRole('button', { name: 'Próxima semana' }));
    expect(inputHasta.value > inputDesde.value).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(inputDesde.value).toBe(hoyIso);
    expect(inputHasta.value).toBe(hoyIso);

    // Día completo activo por defecto; selector de horas oculto
    const checkDiaCompleto = screen.getByLabelText(/bloquear día completo/i) as HTMLInputElement;
    expect(checkDiaCompleto.checked).toBe(true);
    expect(screen.queryByLabelText(/hora desde/i)).toBeNull();

    // 1 click en "Elegir franja horaria" desmarca día completo y despliega selectores + presets
    fireEvent.click(screen.getByRole('button', { name: /elegir franja horaria/i }));
    expect(checkDiaCompleto.checked).toBe(false);

    const selectDesde = screen.getByLabelText(/hora desde/i) as HTMLSelectElement;
    const selectHasta = screen.getByLabelText(/hora hasta/i) as HTMLSelectElement;
    expect(selectDesde.value).toBe('08:00');
    expect(selectHasta.value).toBe('09:00');

    // Cambiar Hora desde a 15:00 cuando Hora hasta es 09:00 en el mismo día → auto-ajusta a 16:00
    fireEvent.change(selectDesde, { target: { value: '15:00' } });
    expect(selectHasta.value).toBe('16:00');

    // Preset +1 h y +2 h sobre 15:00
    fireEvent.click(screen.getByRole('button', { name: '+1 h' }));
    expect(selectHasta.value).toBe('16:00');
    fireEvent.click(screen.getByRole('button', { name: '+2 h' }));
    expect(selectHasta.value).toBe('17:00');

    // Preset Tarde 14:00–20:00
    fireEvent.click(screen.getByRole('button', { name: /tarde 14:00–20:00/i }));
    expect(selectDesde.value).toBe('14:00');
    expect(selectHasta.value).toBe('20:00');

    // Preset Mañana 08:00–13:00
    fireEvent.click(screen.getByRole('button', { name: /mañana 08:00–13:00/i }));
    expect(selectDesde.value).toBe('08:00');
    expect(selectHasta.value).toBe('13:00');

    // Resumen refleja franja horaria
    const preview = screen.getByTestId('bloqueo-preview');
    expect(preview.textContent).toContain('08:00');
    expect(preview.textContent).toContain('13:00');

    // Tope 21:45 al elegir 21:15 cuando Hora hasta es menor
    fireEvent.change(selectDesde, { target: { value: '21:15' } });
    expect(selectHasta.value).toBe('21:45');

    // Validación inline si el usuario fuerza un rango inválido (Hora hasta <= Hora desde mismo día)
    fireEvent.change(selectHasta, { target: { value: '10:00' } });
    expect(screen.getByText(/hora de fin debe ser posterior/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/motivo del bloqueo/i), { target: { value: 'Prueba rango' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('Filtros Todos, Mi agenda y Boxes sobre los bloqueos vigentes', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_MIX_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByText('Congreso odontológico')).toBeTruthy();
    });

    const seccionBloqueos = screen.getByRole('region', { name: /bloqueos vigentes/i });
    expect(within(seccionBloqueos).getByText('Congreso odontológico')).toBeTruthy();
    expect(within(seccionBloqueos).getByText('Mantenimiento de box')).toBeTruthy();
    expect(within(seccionBloqueos).getByText('Día completo')).toBeTruthy();

    // Filtrar por Mi agenda
    const filtroPropio = within(seccionBloqueos).getByRole('button', { name: /^mi agenda/i });
    fireEvent.click(filtroPropio);
    expect(within(seccionBloqueos).getByText('Congreso odontológico')).toBeTruthy();
    expect(within(seccionBloqueos).queryByText('Mantenimiento de box')).toBeNull();

    // Filtrar por Boxes
    const filtroBoxes = within(seccionBloqueos).getByRole('button', { name: /^boxes/i });
    fireEvent.click(filtroBoxes);
    expect(within(seccionBloqueos).queryByText('Congreso odontológico')).toBeNull();
    expect(within(seccionBloqueos).getByText('Mantenimiento de box')).toBeTruthy();

    // Volver a Todos
    const filtroTodos = within(seccionBloqueos).getByRole('button', { name: /^todos/i });
    fireEvent.click(filtroTodos);
    expect(within(seccionBloqueos).getByText('Congreso odontológico')).toBeTruthy();
    expect(within(seccionBloqueos).getByText('Mantenimiento de box')).toBeTruthy();
  });

  it('filtro sin coincidencias muestra EstadoVacio sin romper el listado', async () => {
    establecerSesion(SESION_PROF);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios') return jsonResp(HORARIOS_SEED);
      if (url === '/api/bloqueos') return jsonResp([BLOQUEOS_MIX_SEED[0]]);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByText('Congreso odontológico')).toBeTruthy();
    });

    const seccionBloqueos = screen.getByRole('region', { name: /bloqueos vigentes/i });
    fireEvent.click(within(seccionBloqueos).getByRole('button', { name: /^boxes/i }));
    expect(within(seccionBloqueos).getByText(/sin bloqueos en esta categoría/i)).toBeTruthy();
  });

  it('Tira semanal Lun–Dom para sumar franjas en un clic', async () => {
    establecerSesion(SESION_PROF);
    let bodyPost: unknown = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'GET') return jsonResp(HORARIOS_SEED);
      if (url === '/api/profesionales/prof-1/horarios' && method === 'POST') {
        bodyPost = leerBody(init);
        return jsonResp([
          ...HORARIOS_SEED,
          { id: 'h-2', profesionalId: 'prof-1', diaSemana: 6, desde: '09:00', hasta: '13:00' },
        ]);
      }
      if (url === '/api/bloqueos') return jsonResp(BLOQUEOS_MIX_SEED);
      if (url === '/api/boxes') return jsonResp(BOXES_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    renderHorarios();

    await waitFor(() => {
      expect(screen.getByLabelText(/desde franja 1/i)).toBeTruthy();
    });

    const tiraSemanal = screen.getByRole('group', { name: /resumen semanal de días/i });
    // Tocar un día ya configurado (Lun) no duplica franjas
    fireEvent.click(within(tiraSemanal).getByRole('button', { name: /lun/i }));
    expect(screen.queryByLabelText(/día franja 2/i)).toBeNull();

    // Tocar un día libre (Sáb) agrega la franja 09:00–13:00
    const btnSab = within(tiraSemanal).getByRole('button', { name: /sáb/i });
    fireEvent.click(btnSab);

    const selectDia2 = screen.getByLabelText(/día franja 2/i) as HTMLSelectElement;
    const selectDesde2 = screen.getByLabelText(/desde franja 2/i) as HTMLSelectElement;
    const selectHasta2 = screen.getByLabelText(/hasta franja 2/i) as HTMLSelectElement;

    expect(selectDia2.value).toBe('6');
    expect(selectDesde2.value).toBe('09:00');
    expect(selectHasta2.value).toBe('13:00');

    fireEvent.click(screen.getByRole('button', { name: /guardar horarios/i }));

    await waitFor(() => {
      expect(bodyPost).toEqual({
        horarios: [
          { diaSemana: 1, desde: '09:00', hasta: '13:00' },
          { diaSemana: 6, desde: '09:00', hasta: '13:00' },
        ],
      });
    });
  });
});
