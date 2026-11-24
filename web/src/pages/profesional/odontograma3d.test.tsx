import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useRoutes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { establecerSesion, limpiarSesion } from '../../base/sesion';
import type { EstadoPiezaApi } from './apiProfesional';
import {
  agregarCambioBorrador,
  aplicarBorradorSobrePiezas,
  construirSnapshotsHistorial,
  etiquetaCaraAnatomica,
  proyectarEstadoActual,
  quitarCambioBorrador,
} from './odontogramaHistorial';
import { Odontograma3d } from './Odontograma3d';
import {
  soportaWebGl2,
  type EstadoMotor3d,
  type InstanciaMotor3d,
} from './odontograma3dMotor';
import { routes } from './routes';

const SESION_PROF = {
  token: 'jwt-prof-3d',
  usuario: {
    id: 'u-prof-1',
    email: 'profesional@example.com',
    rol: 'profesional' as const,
    activo: true,
  },
};

const PROFESIONALES_SEED = [
  { id: 'prof-1', nombre: 'Dra. Ficticia Uno', matricula: 'MP-1001', activo: true, usuarioId: 'u-prof-1' },
];

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
];

const HISTORIAL_MULTI_CONSULTA: readonly EstadoPiezaApi[] = [
  {
    id: 'ep-1',
    odontogramaId: 'odo-1',
    pieza: 16,
    cara: 'oclusal',
    estado: 'caries',
    registradoPor: 'prof-1',
    fecha: '2026-02-12T15:00:00.000Z',
  },
  {
    id: 'ep-2',
    odontogramaId: 'odo-1',
    pieza: 36,
    cara: 'vestibular',
    estado: 'caries',
    registradoPor: 'prof-1',
    fecha: '2026-02-12T15:00:00.000Z',
  },
  {
    id: 'ep-3',
    odontogramaId: 'odo-1',
    pieza: 16,
    cara: 'oclusal',
    estado: 'obturado',
    registradoPor: 'prof-1',
    fecha: '2026-04-09T15:00:00.000Z',
  },
  {
    id: 'ep-4',
    odontogramaId: 'odo-1',
    pieza: 36,
    estado: 'endodoncia',
    registradoPor: 'prof-1',
    fecha: '2026-06-18T15:00:00.000Z',
  },
];

const ODONTOGRAMA_HISTORIAL_SEED = {
  odontogramaId: 'odo-1',
  pacienteId: 'pac-1',
  actualizadoEn: '2026-06-18T15:00:00.000Z',
  piezas: [
    {
      id: 'ep-3',
      odontogramaId: 'odo-1',
      pieza: 16,
      cara: 'oclusal' as const,
      estado: 'obturado' as const,
      registradoPor: 'prof-1',
      fecha: '2026-04-09T15:00:00.000Z',
    },
    {
      id: 'ep-4',
      odontogramaId: 'odo-1',
      pieza: 36,
      estado: 'endodoncia' as const,
      registradoPor: 'prof-1',
      fecha: '2026-06-18T15:00:00.000Z',
    },
  ],
  historial: HISTORIAL_MULTI_CONSULTA,
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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

function AppClinicaPrueba() {
  return useRoutes([
    { path: '/login', element: <div data-testid="pagina-login">Login</div> },
    { path: '/inicio', element: <div data-testid="pagina-inicio">Inicio</div> },
    ...routes,
  ]);
}

function renderClinica() {
  return render(
    <MemoryRouter initialEntries={['/profesional/clinica']}>
      <AppClinicaPrueba />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  limpiarSesion();
  vi.restoreAllMocks();
});

describe('odontogramaHistorial — lógica pura de proyección, snapshots y borrador C-09', () => {
  it('detecta ausencia de WebGL 2 de forma segura en jsdom', () => {
    expect(soportaWebGl2()).toBe(false);
  });

  it('proyecta estados respetando exclusión mutua entre pieza completa y caras', () => {
    const proyectadas = proyectarEstadoActual(HISTORIAL_MULTI_CONSULTA);
    expect(proyectadas).toHaveLength(2);

    const p16 = proyectadas.find((p) => p.pieza === 16);
    const p36 = proyectadas.find((p) => p.pieza === 36);
    expect(p16?.cara).toBe('oclusal');
    expect(p16?.estado).toBe('obturado');
    // Endodoncia posterior reemplaza la caries vestibular previa en pieza 36
    expect(p36?.cara).toBeUndefined();
    expect(p36?.estado).toBe('endodoncia');

    // Si después se registra una cara en 36, reemplaza la marca de pieza completa previa
    const conCaraPosterior = proyectarEstadoActual([
      ...HISTORIAL_MULTI_CONSULTA,
      {
        id: 'ep-5',
        odontogramaId: 'odo-1',
        pieza: 36,
        cara: 'oclusal',
        estado: 'caries',
        registradoPor: 'prof-1',
        fecha: '2026-07-01T15:00:00.000Z',
      },
    ]);
    const registros36 = conCaraPosterior.filter((p) => p.pieza === 36);
    expect(registros36).toHaveLength(1);
    expect(registros36[0]?.cara).toBe('oclusal');
    expect(registros36[0]?.estado).toBe('caries');
  });

  it('construye snapshots cronológicos y detecta piezas cambiadas entre consultas', () => {
    const snapshots = construirSnapshotsHistorial(HISTORIAL_MULTI_CONSULTA);
    expect(snapshots).toHaveLength(3);

    expect(snapshots[0]?.piezasProyectadas).toHaveLength(2);
    expect(snapshots[0]?.piezasCambiadas).toEqual([16, 36]);

    // Consulta 2: 16 pasa de caries a obturado, 36 sigue igual
    expect(snapshots[1]?.piezasCambiadas).toEqual([16]);
    expect(snapshots[1]?.piezasProyectadas.find((p) => p.pieza === 16)?.estado).toBe('obturado');
    expect(snapshots[1]?.piezasProyectadas.find((p) => p.pieza === 36)?.estado).toBe('caries');

    // Consulta 3: 36 pasa a endodoncia
    expect(snapshots[2]?.piezasCambiadas).toEqual([36]);
    expect(snapshots[2]?.piezasProyectadas.find((p) => p.pieza === 36)?.estado).toBe('endodoncia');
  });

  it('gestiona el borrador multi-cambio sin duplicados ni conflictos C-09', () => {
    let borrador = agregarCambioBorrador([], { pieza: 16, cara: 'oclusal', estado: 'caries' });
    borrador = agregarCambioBorrador(borrador, { pieza: 16, cara: 'mesial', estado: 'obturado' });
    expect(borrador).toHaveLength(2);

    // Actualizar misma (pieza, cara) reemplaza sin duplicar
    borrador = agregarCambioBorrador(borrador, { pieza: 16, cara: 'oclusal', estado: 'obturado' });
    expect(borrador).toHaveLength(2);
    expect(borrador.find((i) => i.cara === 'oclusal')?.estado).toBe('obturado');

    // Un estado solo pieza completa elimina las caras previas de esa pieza y omite `cara`
    borrador = agregarCambioBorrador(borrador, { pieza: 16, cara: 'oclusal', estado: 'corona' });
    expect(borrador).toEqual([{ pieza: 16, estado: 'corona' }]);

    // Agregar otra pieza y deshacer la primera
    borrador = agregarCambioBorrador(borrador, { pieza: 24, estado: 'ausente' });
    expect(borrador).toHaveLength(2);
    borrador = quitarCambioBorrador(borrador, 0);
    expect(borrador).toEqual([{ pieza: 24, estado: 'ausente' }]);

    // Previsualización aplica borrador sobre piezas actuales
    const preview = aplicarBorradorSobrePiezas(ODONTOGRAMA_HISTORIAL_SEED.piezas, borrador);
    expect(preview.find((p) => p.pieza === 24)?.estado).toBe('ausente');
  });

  it('renombra Lingual a Palatina en arcada superior (11–28 y 51–65)', () => {
    expect(etiquetaCaraAnatomica(16, 'lingual')).toBe('Palatina');
    expect(etiquetaCaraAnatomica(21, 'lingual')).toBe('Palatina');
    expect(etiquetaCaraAnatomica(55, 'lingual')).toBe('Palatina');
    expect(etiquetaCaraAnatomica(63, 'lingual')).toBe('Palatina');
    expect(etiquetaCaraAnatomica(36, 'lingual')).toBe('Lingual');
    expect(etiquetaCaraAnatomica(48, 'lingual')).toBe('Lingual');
    expect(etiquetaCaraAnatomica(75, 'lingual')).toBe('Lingual');
    expect(etiquetaCaraAnatomica(81, 'lingual')).toBe('Lingual');
  });
});

describe('Odontograma3d en ClinicaPage — fallback 2D, dentición, paleta, borrador y máquina del tiempo', () => {
  function mockFetchClinica() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_HISTORIAL_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });
  }

  it('Fallback automático al mapa clásico 2D sin WebGL 2', async () => {
    establecerSesion(SESION_PROF);
    mockFetchClinica();

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
    });

    const toolbar = container.querySelector('.prof-odo-toolbar') as HTMLElement;
    const grupoVista = within(toolbar).getByRole('group', { name: /^vista$/i });
    const btn3d = within(grupoVista).getByRole('button', { name: /^3d$/i }) as HTMLButtonElement;
    const btnMapa = within(grupoVista).getByRole('button', { name: /mapa clásico/i });
    const btnRayosX = within(toolbar).getByRole('button', { name: /rayos x/i }) as HTMLButtonElement;

    expect(btn3d.disabled).toBe(true);
    expect(btnMapa.getAttribute('aria-pressed')).toBe('true');
    expect(btnRayosX.disabled).toBe(true);
    expect(btnRayosX.getAttribute('aria-pressed')).toBe('false');
  });

  it('permite cambiar a dentición Temporaria (20 piezas)', async () => {
    establecerSesion(SESION_PROF);
    mockFetchClinica();

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
    });

    const grupoDenticion = within(container.querySelector('.prof-odo-toolbar') as HTMLElement).getByRole(
      'group',
      { name: /^dentición$/i },
    );

    fireEvent.click(within(grupoDenticion).getByRole('button', { name: /^temporaria$/i }));
    expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(20);
    expect(container.querySelector('[data-tooth-fdi="55"]')).toBeTruthy();
    expect(container.querySelector('[data-tooth-fdi="16"]')).toBeNull();
  });

  it('permite cambiar a dentición Mixta (52 piezas)', async () => {
    establecerSesion(SESION_PROF);
    mockFetchClinica();

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
    });

    const grupoDenticion = within(container.querySelector('.prof-odo-toolbar') as HTMLElement).getByRole(
      'group',
      { name: /^dentición$/i },
    );

    fireEvent.click(within(grupoDenticion).getByRole('button', { name: /^mixta$/i }));
    expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(52);
    expect(container.querySelector('[data-tooth-fdi="16"]')).toBeTruthy();
    expect(container.querySelector('[data-tooth-fdi="55"]')).toBeTruthy();

    fireEvent.click(within(grupoDenticion).getByRole('button', { name: /^permanente$/i }));
    expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
  });

  it('Vista Rayos X disponible en modo 3D y deshabilitada en mapa clásico 2D', async () => {
    const estadosRecibidos: EstadoMotor3d[] = [];
    const motorStub: InstanciaMotor3d = {
      actualizarEstado: vi.fn((estado: EstadoMotor3d) => {
        estadosRecibidos.push(estado);
      }),
      enfocarPieza: vi.fn(),
      centrarArcadas: vi.fn(),
      setGiroMini: vi.fn(),
      redimensionar: vi.fn(),
      dispose: vi.fn(),
    };

    const { container } = render(
      <Odontograma3d
        pacienteId="pac-1"
        piezas={ODONTOGRAMA_HISTORIAL_SEED.piezas}
        historial={HISTORIAL_MULTI_CONSULTA}
        guardando={false}
        nombreProfesional={() => 'Dra. Ficticia Uno'}
        onGuardarCambios={async () => true}
        inicializarMotor3d={async () => motorStub}
      />,
    );

    const toolbar = container.querySelector('.prof-odo-toolbar') as HTMLElement;
    const btnRayosX = within(toolbar).getByRole('button', { name: /rayos x/i }) as HTMLButtonElement;
    const grupoVista = within(toolbar).getByRole('group', { name: /^vista$/i });

    await waitFor(() => {
      expect(btnRayosX.disabled).toBe(false);
    });
    expect(btnRayosX.getAttribute('aria-pressed')).toBe('false');

    // Activar Rayos X en modo 3D
    fireEvent.click(btnRayosX);
    expect(btnRayosX.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/rayos x · raíces y conductos/i)).toBeTruthy();
    expect(estadosRecibidos.some((e) => e.rayosX && e.vista3dActiva)).toBe(true);

    // Al pasar a Mapa clásico 2D, Rayos X queda deshabilitado con aria-pressed="false"
    fireEvent.click(within(grupoVista).getByRole('button', { name: /mapa clásico/i }));
    expect(btnRayosX.disabled).toBe(true);
    expect(btnRayosX.getAttribute('aria-pressed')).toBe('false');
  });

  it('paleta de 7 estados y 5 botones de cara respetan Palatina/Lingual y deshabilitan caras en estados de pieza completa', async () => {
    establecerSesion(SESION_PROF);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_HISTORIAL_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelector('[data-pieza="16"][data-cara="oclusal"]')).toBeTruthy();
    });

    const grupoCaras = screen.getByRole('group', { name: /caras de la pieza/i });
    const grupoPaleta = screen.getByRole('group', { name: /estados clínicos/i });

    // Pieza 16 (superior): debe mostrar "Palatina" en los 5 botones rápidos de cara
    expect(within(grupoCaras).getByRole('button', { name: /palatina/i })).toBeTruthy();

    // Al seleccionar pieza 36 (inferior): cambia a "Lingual"
    fireEvent.click(container.querySelector('[data-pieza="36"][data-cara="oclusal"]')!);
    expect(within(grupoCaras).getByRole('button', { name: /lingual/i })).toBeTruthy();

    // Seleccionar estado "Ausente" desde la paleta de 7 estados deshabilita los 5 botones de cara y el <select>
    fireEvent.click(within(grupoPaleta).getByRole('button', { name: /ausente/i }));
    const btnOclusal = within(grupoCaras).getByRole('button', { name: /oclusal/i }) as HTMLButtonElement;
    const selectCara = screen.getByLabelText(/cara anatómica/i) as HTMLSelectElement;
    expect(btnOclusal.disabled).toBe(true);
    expect(selectCara.disabled).toBe(true);

    // Volver a "Caries" habilita las caras nuevamente
    fireEvent.click(within(grupoPaleta).getByRole('button', { name: /caries/i }));
    expect(btnOclusal.disabled).toBe(false);
    expect(selectCara.disabled).toBe(false);
  });

  it('Borrador multi-cambio guardado en un solo PUT', async () => {
    establecerSesion(SESION_PROF);
    const putPayloads: unknown[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = leerUrl(input);
      const method = init?.method ?? 'GET';
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma' && method === 'GET') {
        return jsonResp(ODONTOGRAMA_HISTORIAL_SEED);
      }
      if (url === '/api/pacientes/pac-1/odontograma' && method === 'PUT') {
        putPayloads.push(leerBody(init));
        return jsonResp({
          ...ODONTOGRAMA_HISTORIAL_SEED,
          actualizadoEn: '2026-11-24T12:00:00.000Z',
          piezas: [
            ...ODONTOGRAMA_HISTORIAL_SEED.piezas,
            {
              id: 'ep-99',
              odontogramaId: 'odo-1',
              pieza: 24,
              estado: 'ausente',
              registradoPor: 'prof-1',
              fecha: '2026-11-24T12:00:00.000Z',
            },
          ],
          historial: [
            ...ODONTOGRAMA_HISTORIAL_SEED.historial,
            {
              id: 'ep-99',
              odontogramaId: 'odo-1',
              pieza: 24,
              estado: 'ausente',
              registradoPor: 'prof-1',
              fecha: '2026-11-24T12:00:00.000Z',
            },
          ],
        });
      }
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelector('[data-pieza="11"][data-cara="vestibular"]')).toBeTruthy();
    });

    const panelEditor = container.querySelector('.prof-odo-sheet') as HTMLElement;
    const grupoPaleta = within(panelEditor).getByRole('group', { name: /estados clínicos/i });

    // 1er cambio al borrador: pieza 11 vestibular caries
    fireEvent.click(container.querySelector('[data-pieza="11"][data-cara="vestibular"]')!);
    fireEvent.click(within(grupoPaleta).getByRole('button', { name: /caries/i }));
    fireEvent.click(within(panelEditor).getByRole('button', { name: /agregar cambio al borrador/i }));

    // 2do cambio al borrador: pieza 24 ausente (pieza completa)
    fireEvent.click(container.querySelector('[data-pieza="24"][data-cara="oclusal"]')!);
    fireEvent.click(within(grupoPaleta).getByRole('button', { name: /ausente/i }));
    fireEvent.click(within(panelEditor).getByRole('button', { name: /agregar cambio al borrador/i }));

    // Verificar botones Deshacer y ausencia estricta de editar/eliminar/borrar
    const botonesDeshacer = within(panelEditor).getAllByRole('button', { name: /deshacer/i });
    expect(botonesDeshacer).toHaveLength(2);
    expect(within(panelEditor).queryByRole('button', { name: /editar/i })).toBeNull();
    expect(within(panelEditor).queryByRole('button', { name: /eliminar|borrar/i })).toBeNull();

    // Quitar el primer cambio (pieza 11) con Deshacer
    fireEvent.click(botonesDeshacer[0]!);
    expect(within(panelEditor).getAllByRole('button', { name: /deshacer/i })).toHaveLength(1);

    // Guardar el borrador envía solo el cambio restante en un único PUT
    fireEvent.click(within(panelEditor).getByRole('button', { name: /guardar en odontograma/i }));

    await waitFor(() => {
      expect(putPayloads).toHaveLength(1);
    });
    expect(putPayloads[0]).toEqual({
      piezas: [{ pieza: 24, estado: 'ausente' }],
    });
  });

  it('Máquina del tiempo en solo lectura sobre el historial', async () => {
    establecerSesion(SESION_PROF);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_HISTORIAL_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelector('[data-pieza="36"] [data-overlay="endodoncia"]')).toBeTruthy();
    });

    const panelEditor = container.querySelector('.prof-odo-sheet') as HTMLElement;
    const maquinaTiempo = container.querySelector('.prof-odo-time') as HTMLElement;

    // En el presente (consulta 3): pieza 36 tiene overlay de endodoncia y guardar está habilitado
    const btnGuardar = within(panelEditor).getByRole('button', {
      name: /guardar en odontograma/i,
    }) as HTMLButtonElement;
    expect(btnGuardar.disabled).toBe(false);

    // Ir a la primera consulta (indice 0): 16 tenía caries y 36 aún NO tenía endodoncia
    const slider = within(maquinaTiempo).getByLabelText(/fecha de consulta/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0' } });

    expect(container.querySelector('[data-pieza="36"] [data-overlay="endodoncia"]')).toBeNull();
    expect(btnGuardar.disabled).toBe(true);

    const btnVolver = within(maquinaTiempo).getByRole('button', { name: /volver al presente/i });
    expect(btnVolver).toBeTruthy();

    // Volver al presente restaura endodoncia en 36 y rehabilita guardado
    fireEvent.click(btnVolver);
    expect(container.querySelector('[data-pieza="36"] [data-overlay="endodoncia"]')).toBeTruthy();
    expect(btnGuardar.disabled).toBe(false);
  });

  it('oculta el canvas 3D y aplica la clase de mapa centrado en modo Mapa clásico', async () => {
    establecerSesion(SESION_PROF);
    mockFetchClinica();

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-tooth-fdi]').length).toBe(32);
    });

    const toolbar = container.querySelector('.prof-odo-toolbar') as HTMLElement;
    expect(within(toolbar).getByRole('button', { name: /mapa clásico/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    const canvas3d = container.querySelector<HTMLCanvasElement>('canvas.prof-odo-canvas');
    expect(canvas3d).toBeTruthy();
    expect(canvas3d?.getAttribute('aria-label')).toMatch(/^Arcadas 3D/i);
    expect(canvas3d?.hidden).toBe(true);
    expect(canvas3d?.closest('.prof-odo-viewport')?.classList.contains('prof-odo-viewport--map')).toBe(true);
    const profesionalCss = readFileSync(resolve(__dirname, 'profesional.css'), 'utf8');
    expect(profesionalCss).toMatch(/\.prof-odo-canvas\[hidden\][^{]*\{[^}]*display:\s*none\s*;/);
  });

  it('ubica Historial del odontograma y Máquina del tiempo dentro de .prof-odo-col-izq debajo de .prof-odo-stage', async () => {
    establecerSesion(SESION_PROF);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = leerUrl(input);
      if (url === '/api/pacientes') return jsonResp(PACIENTES_SEED);
      if (url === '/api/profesionales') return jsonResp(PROFESIONALES_SEED);
      if (url === '/api/pacientes/pac-1/historia') return jsonResp([]);
      if (url === '/api/pacientes/pac-1/odontograma') return jsonResp(ODONTOGRAMA_HISTORIAL_SEED);
      return jsonResp({ code: 'NO_ENCONTRADO' }, 404);
    });

    const { container } = renderClinica();

    await waitFor(() => {
      expect(container.querySelector('.prof-odo-col-izq')).toBeTruthy();
    });

    const colIzq = container.querySelector('.prof-grid-clinica > .prof-odo-col-izq');
    expect(colIzq).toBeTruthy();

    const hijos = Array.from(colIzq!.children);
    const stage = colIzq!.querySelector('.prof-odo-stage');
    const maquinaTiempo = colIzq!.querySelector('.prof-odo-time');
    const historialCard = colIzq!.querySelector('[aria-labelledby="titulo-hist-odo"]');

    expect(stage).toBeTruthy();
    expect(maquinaTiempo).toBeTruthy();
    expect(historialCard).toBeTruthy();
    expect(hijos).toEqual([stage, maquinaTiempo, historialCard]);
    expect(colIzq!.querySelector('[aria-labelledby="titulo-hc"]')).toBeNull();
  });
});
