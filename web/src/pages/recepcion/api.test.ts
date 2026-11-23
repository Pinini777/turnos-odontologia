import { describe, expect, it, vi } from 'vitest';
import { crearClienteHttp, ErrorApi } from '../../base/api';
import {
  cambiarEstadoTurno,
  cancelarTurno,
  crearPaciente,
  crearTurnoRecepcion,
  listarBoxes,
  listarPacientes,
  listarPrestaciones,
  listarProfesionales,
  obtenerAgenda,
  obtenerHuecos,
  reprogramarTurno,
} from './api';

/** Cliente real de C-12 con un fetch simulado que registra cada llamada. */
function clienteDePrueba(status = 200, cuerpo: unknown = []) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } }),
  );
  const cliente = crearClienteHttp({ obtenerToken: () => 'tok', fetchImpl: fetchMock });
  const llamada = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i] ?? [];
    const cuerpoEnviado = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    return { url: String(url), metodo: init?.method, cuerpo: cuerpoEnviado };
  };
  return { cliente, llamada };
}

const DESDE = '2026-11-24T00:00:00-03:00';
const HASTA = '2026-11-25T00:00:00-03:00';

describe('cliente de la API de recepción', () => {
  it('obtenerAgenda pide GET /api/agenda con el rango y los filtros codificados', async () => {
    const { cliente, llamada } = clienteDePrueba();
    await obtenerAgenda({ desde: DESDE, hasta: HASTA, boxId: 'box-1' }, cliente);
    const { url, metodo } = llamada();
    expect(metodo).toBe('GET');
    const u = new URL(url, 'http://x');
    expect(u.pathname).toBe('/api/agenda');
    expect(Object.fromEntries(u.searchParams)).toEqual({ desde: DESDE, hasta: HASTA, boxId: 'box-1' });
  });

  it('obtenerHuecos pide GET /api/recepcion/disponibilidad sin profesional si no se elige', async () => {
    const { cliente, llamada } = clienteDePrueba();
    await obtenerHuecos({ prestacionId: 'consulta', desde: DESDE, hasta: HASTA }, cliente);
    const u = new URL(llamada().url, 'http://x');
    expect(u.pathname).toBe('/api/recepcion/disponibilidad');
    expect(Object.fromEntries(u.searchParams)).toEqual({ prestacionId: 'consulta', desde: DESDE, hasta: HASTA });
  });

  it('crearTurnoRecepcion manda POST /api/recepcion/turnos con pacienteId y sin boxId cuando es automático', async () => {
    const { cliente, llamada } = clienteDePrueba(201, {});
    await crearTurnoRecepcion(
      { paciente: { tipo: 'existente', pacienteId: 'p1' }, profesionalId: 'pro', prestacionId: 'consulta', inicio: '2026-11-24T10:30:00-03:00' },
      cliente,
    );
    expect(llamada()).toEqual({
      url: '/api/recepcion/turnos',
      metodo: 'POST',
      cuerpo: { pacienteId: 'p1', profesionalId: 'pro', prestacionId: 'consulta', inicio: '2026-11-24T10:30:00-03:00' },
    });
  });

  it('crearTurnoRecepcion con paciente nuevo manda el objeto paciente y el box elegido', async () => {
    const { cliente, llamada } = clienteDePrueba(201, {});
    const nuevo = { nombre: 'Paciente', apellido: 'Ficticio Tres', documento: '00000003', email: 'paciente3@example.com' };
    await crearTurnoRecepcion(
      { paciente: { tipo: 'nuevo', datos: nuevo }, profesionalId: 'pro', prestacionId: 'consulta', inicio: 'x', boxId: 'box-2' },
      cliente,
    );
    expect(llamada().cuerpo).toEqual({ paciente: nuevo, profesionalId: 'pro', prestacionId: 'consulta', inicio: 'x', boxId: 'box-2' });
  });

  it('cancelar, cambiar estado y reprogramar usan las rutas de C-05 y C-10', async () => {
    const { cliente, llamada } = clienteDePrueba(200, {});
    await cancelarTurno('t 1', cliente);
    await cambiarEstadoTurno('t1', 'confirmado', cliente);
    await reprogramarTurno('t1', { inicio: 'x', profesionalId: 'pro' }, cliente);
    expect(llamada(0)).toMatchObject({ url: '/api/turnos/t%201/cancelar', metodo: 'POST' });
    expect(llamada(1)).toEqual({ url: '/api/turnos/t1/estado', metodo: 'POST', cuerpo: { estado: 'confirmado' } });
    expect(llamada(2)).toEqual({ url: '/api/turnos/t1/reprogramar', metodo: 'PATCH', cuerpo: { inicio: 'x', profesionalId: 'pro' } });
  });

  it('pacientes y catálogos usan las rutas de C-04 y C-03', async () => {
    const { cliente, llamada } = clienteDePrueba(200, []);
    await listarPacientes(cliente);
    await crearPaciente({ nombre: 'Paciente', apellido: 'Ficticio Tres', documento: '00000003', email: 'paciente3@example.com' }, cliente);
    await listarProfesionales(cliente);
    await listarBoxes(cliente);
    await listarPrestaciones(cliente);
    expect([0, 1, 2, 3, 4].map((i) => `${llamada(i).metodo} ${llamada(i).url}`)).toEqual([
      'GET /api/pacientes', 'POST /api/pacientes', 'GET /api/profesionales', 'GET /api/boxes', 'GET /api/prestaciones',
    ]);
  });

  it('un 409 llega como ErrorApi con su código', async () => {
    const { cliente } = clienteDePrueba(409, { code: 'SOLAPAMIENTO_PROFESIONAL' });
    await expect(cancelarTurno('t1', cliente)).rejects.toBeInstanceOf(ErrorApi);
    await expect(cancelarTurno('t1', cliente)).rejects.toMatchObject({ code: 'SOLAPAMIENTO_PROFESIONAL' });
  });
});
