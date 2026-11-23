import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { RolUsuario } from '../../base/api';
import { establecerSesion, limpiarSesion } from '../../base/sesion';
import type { Box, Hueco, Prestacion, Profesional, TurnoAgenda } from './api';
import { routes } from './routes';

/** Una llamada que recibió el servidor falso. */
export interface Llamada {
  readonly metodo: string;
  readonly ruta: string;
  readonly query: URLSearchParams;
  readonly cuerpo: unknown;
}

interface RespuestaFalsa {
  readonly status?: number;
  readonly body?: unknown;
}

type Manejador = (llamada: Llamada) => RespuestaFalsa;

/**
 * Reemplaza `fetch` por un servidor en memoria. Cada clave es "MÉTODO /ruta" (sin query);
 * el valor es el cuerpo de un 200 o una función que arma la respuesta. Una ruta sin
 * manejador responde 404, para que un pedido inesperado se note en el test.
 */
export function servidorFalso(
  manejadores: Readonly<Record<string, Manejador | readonly unknown[] | Readonly<Record<string, unknown>>>>,
) {
  const llamadas: Llamada[] = [];
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const cuerpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const llamada: Llamada = { metodo: init?.method ?? 'GET', ruta: url.pathname, query: url.searchParams, cuerpo };
    llamadas.push(llamada);
    const manejador = manejadores[`${llamada.metodo} ${llamada.ruta}`];
    const respuesta: RespuestaFalsa =
      manejador === undefined ? { status: 404, body: { code: 'NO_ENCONTRADO' } }
        : typeof manejador === 'function' ? (manejador as Manejador)(llamada)
          : { body: manejador };
    return new Response(JSON.stringify(respuesta.body ?? {}), {
      status: respuesta.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchFalso);
  const de = (metodo: string, ruta: string) => llamadas.filter((l) => l.metodo === metodo && l.ruta === ruta);
  return { llamadas, de };
}

const EMAIL_POR_ROL: Readonly<Record<RolUsuario, string>> = {
  recepcionista: 'recepcion@example.com',
  profesional: 'profesional@example.com',
  paciente: 'paciente1@example.com',
};

/** Muestra la ubicación actual para que los tests verifiquen a dónde se navegó. */
function SondaUbicacion() {
  const { pathname, search } = useLocation();
  return <output data-testid="ubicacion" hidden>{`${pathname}${search}`}</output>;
}

/** Ruta actual del router de prueba ("/recepcion/agenda?fecha=..."). */
export const ubicacionActual = () => screen.getByTestId('ubicacion').textContent ?? '';

/**
 * Monta las rutas reales del área en `ruta`, con sesión del rol indicado (o sin sesión).
 * Usa MemoryRouter (como los tests de C-12): el router de datos falla en jsdom al navegar.
 */
export function renderizarEn(ruta: string, rol: RolUsuario | null = 'recepcionista', estado?: unknown) {
  limpiarSesion();
  if (rol) {
    establecerSesion({ token: 'tok-ficticio', usuario: { id: `u-${rol}`, email: EMAIL_POR_ROL[rol], rol, activo: true } });
  }
  return render(
    <MemoryRouter initialEntries={[estado === undefined ? ruta : { pathname: ruta.split('?')[0] ?? ruta, search: ruta.includes('?') ? `?${ruta.split('?')[1]}` : '', state: estado }]}>
      <SondaUbicacion />
      <Routes>
        {routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
        <Route path="/login" element={<p>Pantalla de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

// --- Datos ficticios -----------------------------------------------------------------------

export const PROFESIONALES: Profesional[] = [
  { id: 'pro-perez', nombre: 'Dra. Ana Pérez', activo: true },
  { id: 'pro-gomez', nombre: 'Dr. Bruno Gómez', activo: true },
];
export const BOXES: Box[] = [
  { id: 'box-1', nombre: 'Box 1', activo: true },
  { id: 'box-2', nombre: 'Box 2', activo: true },
];
export const PRESTACIONES: Prestacion[] = [
  { id: 'consulta', nombre: 'Consulta', duracionMin: 30, activa: true },
  { id: 'extraccion', nombre: 'Extracción simple', duracionMin: 60, activa: true },
  { id: 'vieja', nombre: 'Prestación inactiva', duracionMin: 15, activa: false },
];
export const PACIENTES = [
  { id: 'pac-1', nombre: 'Paciente', apellido: 'Ficticio Uno', documento: '00000001', email: 'paciente1@example.com' },
  { id: 'pac-2', nombre: 'Paciente', apellido: 'Ficticio Dos', documento: '00000002', email: 'paciente2@example.com' },
];

/** Catálogos que piden casi todas las pantallas. */
export const CATALOGOS = {
  'GET /api/profesionales': PROFESIONALES,
  'GET /api/boxes': BOXES,
  'GET /api/prestaciones': PRESTACIONES,
  'GET /api/pacientes': PACIENTES,
};

/** Turno de agenda del martes 24/11/2026 (hora local -03:00). */
export function turno(
  id: string,
  desde: string,
  hasta: string,
  cambios: Partial<Omit<TurnoAgenda, 'id' | 'inicio' | 'fin'>> & { readonly dia?: string } = {},
): TurnoAgenda {
  const { dia = '2026-11-24', ...resto } = cambios;
  return {
    id,
    inicio: new Date(`${dia}T${desde}:00-03:00`).toISOString(),
    fin: new Date(`${dia}T${hasta}:00-03:00`).toISOString(),
    estado: 'reservado',
    profesionalId: 'pro-perez',
    boxId: 'box-1',
    pacienteId: 'pac-1',
    prestacionId: 'consulta',
    paciente: { id: 'pac-1', nombre: 'Paciente', apellido: 'Ficticio Uno' },
    profesional: { id: 'pro-perez', nombre: 'Dra. Ana Pérez' },
    box: { id: 'box-1', nombre: 'Box 1' },
    prestacion: { id: 'consulta', nombre: 'Consulta', duracionMin: 30 },
    ...resto,
  };
}

/** Hueco libre del martes 24/11/2026. */
export function hueco(desde: string, hasta: string, boxIds: string[] = ['box-1'], profesionalId = 'pro-perez'): Hueco {
  return {
    inicio: new Date(`2026-11-24T${desde}:00-03:00`).toISOString(),
    fin: new Date(`2026-11-24T${hasta}:00-03:00`).toISOString(),
    profesionalId,
    boxIds,
  };
}
