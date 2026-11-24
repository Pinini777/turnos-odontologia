import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { establecerSesion, limpiarSesion } from '../../base/sesion';
import { MisDatosPage } from './MisDatosPage';
import { MisTurnosPage } from './MisTurnosPage';
import { ReprogramarTurnoPage } from './ReprogramarTurnoPage';
import { ReservarPage } from './ReservarPage';
import { routes as rutasPaciente } from './routes';

const ID_PROF_ANA = '00000000-0000-4000-8000-000000000101';
const ID_PROF_BRUNO = '00000000-0000-4000-8000-000000000102';
const ID_BOX_1 = '00000000-0000-4000-8000-000000000201';
const ID_BOX_2 = '00000000-0000-4000-8000-000000000202';
const ID_PREST_CONSULTA = '00000000-0000-4000-8000-000000000301';
const ID_PREST_LIMPIEZA = '00000000-0000-4000-8000-000000000302';

const PRESTACIONES_MOCK = [
  { id: ID_PREST_CONSULTA, nombre: 'Consulta', duracionMin: 30, reservableOnline: true, activa: true },
  { id: ID_PREST_LIMPIEZA, nombre: 'Limpieza', duracionMin: 45, reservableOnline: true, activa: true },
];

// Incluye horario 09:00 duplicado para ambos profesionales (debe deduplicarse en "Cualquiera")
const HUECOS_MOCK_DIA_24 = [
  {
    inicio: '2026-11-24T09:00:00-03:00',
    fin: '2026-11-24T09:30:00-03:00',
    profesionalId: ID_PROF_ANA,
    boxIds: [ID_BOX_1],
  },
  {
    inicio: '2026-11-24T09:00:00-03:00',
    fin: '2026-11-24T09:30:00-03:00',
    profesionalId: ID_PROF_BRUNO,
    boxIds: [ID_BOX_2],
  },
  {
    inicio: '2026-11-24T15:00:00-03:00',
    fin: '2026-11-24T15:30:00-03:00',
    profesionalId: ID_PROF_BRUNO,
    boxIds: [ID_BOX_2],
  },
];

const HUECOS_MOCK_DIA_28 = [
  {
    inicio: '2026-11-28T09:00:00-03:00',
    fin: '2026-11-28T09:30:00-03:00',
    profesionalId: ID_PROF_ANA,
    boxIds: [ID_BOX_1],
  },
  {
    inicio: '2026-11-28T15:00:00-03:00',
    fin: '2026-11-28T15:30:00-03:00',
    profesionalId: ID_PROF_BRUNO,
    boxIds: [ID_BOX_2],
  },
];

function respuestaJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function respuestaTexto(body: string, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });
}

function sesionPaciente() {
  establecerSesion({
    token: 'tok-paciente-test',
    usuario: {
      id: '00000000-0000-4000-8000-000000000604',
      email: 'paciente1@example.com',
      rol: 'paciente',
      activo: true,
    },
  });
}

function renderConRutas(rutaInicial: string, obtenerAhora?: () => Date) {
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <Routes>
        <Route path="/paciente/reservar" element={<ReservarPage obtenerAhora={obtenerAhora} />} />
        <Route path="/paciente/turnos" element={<MisTurnosPage obtenerAhora={obtenerAhora} />} />
        <Route
          path="/paciente/turnos/:id/reprogramar"
          element={<ReprogramarTurnoPage obtenerAhora={obtenerAhora} />}
        />
        <Route path="/paciente/datos" element={<MisDatosPage />} />
        <Route path="/login" element={<h1>Pantalla de acceso</h1>} />
        <Route path="/inicio" element={<h1>Pantalla de inicio</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('web-paciente (C-14)', () => {
  beforeEach(() => {
    limpiarSesion();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    limpiarSesion();
  });

  it('exporta todas las rutas del área paciente para el autoload de main.tsx', () => {
    const paths = rutasPaciente.map((r) => r.path);
    expect(paths).toContain('/paciente');
    expect(paths).toContain('/paciente/reservar');
    expect(paths).toContain('/paciente/turnos');
    expect(paths).toContain('/paciente/turnos/:id/reprogramar');
    expect(paths).toContain('/paciente/datos');
  });

  it('redirige al login si el visitante no tiene sesión activa', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderConRutas('/paciente/reservar');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pantalla de acceso' })).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bloquea a otros roles con SIN_PERMISO y cero llamadas a la API de paciente', async () => {
    establecerSesion({
      token: 'tok-recep',
      usuario: {
        id: '00000000-0000-4000-8000-000000000603',
        email: 'recepcion@example.com',
        rol: 'recepcionista',
        activo: true,
      },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    renderConRutas('/paciente/turnos');

    await waitFor(() => {
      expect(screen.getByText('SIN_PERMISO')).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra los enlaces de navegación del paciente activos en el menú lateral', async () => {
    sesionPaciente();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/public/disponibilidad')) return Promise.resolve(respuestaJson(HUECOS_MOCK_DIA_24));
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/reservar', () => new Date('2026-11-24T10:00:00-03:00'));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Reservar turno' }).getAttribute('href')).toBe('/paciente/reservar');
    });
    expect(screen.getByRole('link', { name: 'Mis turnos' }).getAttribute('href')).toBe('/paciente/turnos');
    expect(screen.getByRole('link', { name: 'Mis datos' }).getAttribute('href')).toBe('/paciente/datos');
  });

  it('deduplica horarios en Cualquiera, muestra tabs Mañana/Tarde con solo la hora y ofrece día siguiente cuando no hay huecos', async () => {
    sesionPaciente();
    // Día 25 sin huecos, día 26 con horarios de mañana y tarde
    const huecosDia26 = [
      {
        inicio: '2026-11-26T09:00:00-03:00',
        fin: '2026-11-26T09:30:00-03:00',
        profesionalId: ID_PROF_ANA,
        boxIds: [ID_BOX_1],
      },
      {
        inicio: '2026-11-26T09:00:00-03:00',
        fin: '2026-11-26T09:30:00-03:00',
        profesionalId: ID_PROF_BRUNO,
        boxIds: [ID_BOX_2],
      },
      {
        inicio: '2026-11-26T15:00:00-03:00',
        fin: '2026-11-26T15:30:00-03:00',
        profesionalId: ID_PROF_BRUNO,
        boxIds: [ID_BOX_2],
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/public/disponibilidad')) return Promise.resolve(respuestaJson(huecosDia26));
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/reservar', () => new Date('2026-11-25T10:00:00-03:00'));

    // Día 25 no tiene huecos -> ofrece pasar al día siguiente con huecos (26)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Probar el día siguiente' })).toBeTruthy();
    });
    // Chips de profesional presentes sin <select> nativo
    expect(screen.getByRole('button', { name: /Cualquiera/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dra\. Ana Pérez/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Probar el día siguiente' }));

    // Deduplicado: UN solo botón con exactamente "09:00" (sin el nombre del profesional adentro)
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Mañana/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Tarde/i })).toBeTruthy();
    });
    const botones09 = screen.getAllByRole('button', { name: '09:00' });
    expect(botones09).toHaveLength(1);

    // Cambiar al tab Tarde muestra 15:00
    fireEvent.click(screen.getByRole('tab', { name: /Tarde/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '15:00' })).toBeTruthy();
    });
  });

  it('reserva un turno exitosamente y muestra confirmación con Google Calendar y descarga .ics autenticada', async () => {
    sesionPaciente();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/public/disponibilidad')) return Promise.resolve(respuestaJson(HUECOS_MOCK_DIA_24));
      if (url.endsWith('/api/paciente/turnos') && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson(
            {
              id: 'turno-nuevo-1',
              profesionalId: ID_PROF_ANA,
              boxId: ID_BOX_1,
              pacienteId: '00000000-0000-4000-8000-000000000501',
              prestacionId: ID_PREST_CONSULTA,
              inicio: '2026-11-24T09:00:00-03:00',
              fin: '2026-11-24T09:30:00-03:00',
              estado: 'reservado',
              origen: 'online',
            },
            201,
          ),
        );
      }
      if (url.includes('/api/paciente/turnos/turno-nuevo-1/calendario.ics')) {
        return Promise.resolve(
          respuestaTexto('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n', 'text/calendar; charset=utf-8'),
        );
      }
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/reservar', () => new Date('2026-11-24T08:00:00-03:00'));

    const botonHueco = await screen.findByRole('button', { name: '09:00' });
    fireEvent.click(botonHueco);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => {
      expect(screen.getByText(/Tu turno fue reservado correctamente/i)).toBeTruthy();
    });

    const linkGcal = screen.getByRole('link', { name: 'Agregar a Google Calendar' });
    const hrefGcal = linkGcal.getAttribute('href') ?? '';
    expect(hrefGcal).toContain('https://calendar.google.com/calendar/render');
    expect(hrefGcal).not.toContain('$');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar .ics' }));

    await waitFor(() => {
      const llamadaIcs = fetchMock.mock.calls.find(([u]) => String(u).includes('/calendario.ics'));
      expect(llamadaIcs).toBeTruthy();
      const headers = new Headers(llamadaIcs?.[1]?.headers);
      expect(headers.get('Authorization')).toBe('Bearer tok-paciente-test');
    });
  });

  it('si el hueco ya lo tomó otro paciente (409), muestra el error y recarga los huecos para elegir otro', async () => {
    sesionPaciente();
    let pedidosDisponibilidad = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/public/disponibilidad')) {
        pedidosDisponibilidad += 1;
        if (pedidosDisponibilidad === 1) return Promise.resolve(respuestaJson(HUECOS_MOCK_DIA_24));
        // En la recarga tras 409, el de las 09:00 ya no está y queda el de las 15:00
        return Promise.resolve(respuestaJson([HUECOS_MOCK_DIA_24[2]]));
      }
      if (url.endsWith('/api/paciente/turnos') && init?.method === 'POST') {
        return Promise.resolve(respuestaJson({ code: 'SOLAPAMIENTO_PROFESIONAL' }, 409));
      }
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/reservar', () => new Date('2026-11-24T08:00:00-03:00'));

    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => {
      expect(screen.getByText('SOLAPAMIENTO_PROFESIONAL')).toBeTruthy();
    });
    await waitFor(() => {
      expect(pedidosDisponibilidad).toBeGreaterThanOrEqual(2);
      expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
      expect(screen.getByRole('button', { name: '15:00' })).toBeTruthy();
    });
  });

  it('en Mis turnos respeta la regla de 24 h: habilita en borde exacto de 24 h y deshabilita si faltan menos de 24 h', async () => {
    sesionPaciente();
    const turnosMock = [
      {
        id: 'turno-proximo-corto',
        profesionalId: ID_PROF_ANA,
        boxId: ID_BOX_1,
        pacienteId: 'p1',
        prestacionId: ID_PREST_CONSULTA,
        inicio: '2026-11-25T09:00:00-03:00',
        fin: '2026-11-25T09:30:00-03:00',
        estado: 'confirmado',
        origen: 'online',
      },
      {
        id: 'turno-borde-24h',
        profesionalId: ID_PROF_BRUNO,
        boxId: ID_BOX_2,
        pacienteId: 'p1',
        prestacionId: ID_PREST_LIMPIEZA,
        inicio: '2026-11-25T10:00:00-03:00',
        fin: '2026-11-25T10:45:00-03:00',
        estado: 'reservado',
        origen: 'online',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/paciente/turnos')) return Promise.resolve(respuestaJson(turnosMock));
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/turnos', () => new Date('2026-11-24T10:00:00-03:00'));

    await waitFor(() => {
      expect(screen.getByText('Consulta')).toBeTruthy();
      expect(screen.getByText('Limpieza')).toBeTruthy();
    });

    const botonesCancelar = screen.getAllByRole('button', { name: 'Cancelar turno' }) as HTMLButtonElement[];
    expect(botonesCancelar).toHaveLength(2);
    expect(botonesCancelar[0]?.disabled).toBe(true);
    expect(botonesCancelar[1]?.disabled).toBe(false);

    const botonesReprogramar = screen.getAllByRole('button', { name: 'Reprogramar' }) as HTMLButtonElement[];
    expect(botonesReprogramar[0]?.disabled).toBe(true);
    expect(botonesReprogramar[1]?.disabled).toBe(false);
    expect(screen.getAllByRole('link', { name: 'Agregar a Google Calendar' })).toHaveLength(2);
  });

  it('deshabilita la acción inmediatamente si el backend responde 409 PLAZO_VENCIDO al cancelar', async () => {
    sesionPaciente();
    const turnosMock = [
      {
        id: 'turno-limite',
        profesionalId: ID_PROF_ANA,
        boxId: ID_BOX_1,
        pacienteId: 'p1',
        prestacionId: ID_PREST_CONSULTA,
        inicio: '2026-11-26T10:00:00-03:00',
        fin: '2026-11-26T10:30:00-03:00',
        estado: 'reservado',
        origen: 'online',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.endsWith('/api/paciente/turnos/turno-limite/cancelar') && init?.method === 'POST') {
        return Promise.resolve(respuestaJson({ code: 'PLAZO_VENCIDO' }, 409));
      }
      if (url.includes('/api/paciente/turnos')) return Promise.resolve(respuestaJson(turnosMock));
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/turnos', () => new Date('2026-11-24T10:00:00-03:00'));

    const btnCancelar = (await screen.findByRole('button', { name: 'Cancelar turno' })) as HTMLButtonElement;
    expect(btnCancelar.disabled).toBe(false);
    fireEvent.click(btnCancelar);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar turno' }));

    await waitFor(() => {
      expect(screen.getByText('PLAZO_VENCIDO')).toBeTruthy();
    });

    const btnCancelarTrasError = screen.getByRole('button', { name: 'Cancelar turno' }) as HTMLButtonElement;
    const btnReprogramarTrasError = screen.getByRole('button', { name: 'Reprogramar' }) as HTMLButtonElement;
    expect(btnCancelarTrasError.disabled).toBe(true);
    expect(btnReprogramarTrasError.disabled).toBe(true);
  });

  it('cancela un turno dentro del plazo y actualiza su estado a Cancelado', async () => {
    sesionPaciente();
    let cancelado = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.endsWith('/api/paciente/turnos/turno-ok/cancelar') && init?.method === 'POST') {
        cancelado = true;
        return Promise.resolve(
          respuestaJson({
            id: 'turno-ok',
            profesionalId: ID_PROF_ANA,
            boxId: ID_BOX_1,
            pacienteId: 'p1',
            prestacionId: ID_PREST_CONSULTA,
            inicio: '2026-11-27T10:00:00-03:00',
            fin: '2026-11-27T10:30:00-03:00',
            estado: 'cancelado',
            origen: 'online',
          }),
        );
      }
      if (url.includes('/api/paciente/turnos')) {
        return Promise.resolve(
          respuestaJson([
            {
              id: 'turno-ok',
              profesionalId: ID_PROF_ANA,
              boxId: ID_BOX_1,
              pacienteId: 'p1',
              prestacionId: ID_PREST_CONSULTA,
              inicio: '2026-11-27T10:00:00-03:00',
              fin: '2026-11-27T10:30:00-03:00',
              estado: cancelado ? 'cancelado' : 'reservado',
              origen: 'online',
            },
          ]),
        );
      }
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/turnos', () => new Date('2026-11-24T10:00:00-03:00'));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar turno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar turno' }));

    await waitFor(() => {
      expect(screen.getByText('Cancelado')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).toBeNull();
  });

  it('reprograma un turno a un nuevo hueco libre y maneja conflicto 409 recargando disponibilidad', async () => {
    sesionPaciente();
    let intentosPatch = 0;
    let pedidosDisponibilidad = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) return Promise.resolve(respuestaJson(PRESTACIONES_MOCK));
      if (url.includes('/api/public/disponibilidad')) {
        pedidosDisponibilidad += 1;
        return Promise.resolve(respuestaJson(HUECOS_MOCK_DIA_28));
      }
      if (url.includes('/api/paciente/turnos/turno-reprog/reprogramar') && init?.method === 'PATCH') {
        intentosPatch += 1;
        if (intentosPatch === 1) {
          return Promise.resolve(respuestaJson({ code: 'SOLAPAMIENTO_BOX' }, 409));
        }
        return Promise.resolve(
          respuestaJson({
            id: 'turno-reprog',
            profesionalId: ID_PROF_BRUNO,
            boxId: ID_BOX_2,
            pacienteId: 'p1',
            prestacionId: ID_PREST_CONSULTA,
            inicio: '2026-11-28T15:00:00-03:00',
            fin: '2026-11-28T15:30:00-03:00',
            estado: 'reservado',
            origen: 'online',
          }),
        );
      }
      if (url.includes('/api/paciente/turnos')) {
        return Promise.resolve(
          respuestaJson([
            {
              id: 'turno-reprog',
              profesionalId: ID_PROF_ANA,
              boxId: ID_BOX_1,
              pacienteId: 'p1',
              prestacionId: ID_PREST_CONSULTA,
              inicio: '2026-11-28T09:00:00-03:00',
              fin: '2026-11-28T09:30:00-03:00',
              estado: 'confirmado',
              origen: 'online',
            },
          ]),
        );
      }
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/turnos/turno-reprog/reprogramar', () => new Date('2026-11-24T10:00:00-03:00'));

    fireEvent.click(await screen.findByRole('button', { name: '09:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nuevo horario' }));

    await waitFor(() => {
      expect(screen.getByText('SOLAPAMIENTO_BOX')).toBeTruthy();
      expect(pedidosDisponibilidad).toBeGreaterThanOrEqual(2);
    });

    fireEvent.click(screen.getByRole('tab', { name: /Tarde/i }));
    fireEvent.click(await screen.findByRole('button', { name: '15:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nuevo horario' }));

    await waitFor(() => {
      expect(screen.getByText(/Tu turno fue reprogramado correctamente/i)).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Agregar a Google Calendar' })).toBeTruthy();
  });

  it('muestra Mis datos con DNI y correo en solo lectura y guarda cambios editables vía PATCH', async () => {
    sesionPaciente();
    const cuerposEnviados: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/paciente/datos') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(
          respuestaJson({
            id: '00000000-0000-4000-8000-000000000501',
            nombre: 'Paciente',
            apellido: 'Ficticio Uno',
            documento: '00000001',
            email: 'paciente1@example.com',
            telefono: '0000-000001',
            obraSocial: 'Obra Social Ficticia',
          }),
        );
      }
      if (url.endsWith('/api/paciente/datos') && init?.method === 'PATCH') {
        cuerposEnviados.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return Promise.resolve(
          respuestaJson({
            id: '00000000-0000-4000-8000-000000000501',
            nombre: 'Paciente',
            apellido: 'Ficticio Uno',
            documento: '00000001',
            email: 'paciente1@example.com',
            telefono: '261-000-9999',
            obraSocial: 'OSDE',
            plan: '210',
          }),
        );
      }
      return Promise.resolve(respuestaJson([]));
    });

    renderConRutas('/paciente/datos');

    await waitFor(() => {
      expect(screen.getByText('00000001')).toBeTruthy();
    });
    expect(screen.getAllByText('paciente1@example.com').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '261-000-9999' } });
    fireEvent.change(screen.getByLabelText('Obra social'), { target: { value: 'OSDE' } });
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: '210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(screen.getByText(/Tus datos se guardaron correctamente/i)).toBeTruthy();
    });
    const enviado = cuerposEnviados[0];
    expect(enviado).toBeDefined();
    expect(enviado?.telefono).toBe('261-000-9999');
    expect(enviado?.obraSocial).toBe('OSDE');
    expect(enviado?.plan).toBe('210');
    expect(enviado).not.toHaveProperty('documento');
    expect(enviado).not.toHaveProperty('email');
    expect(enviado).not.toHaveProperty('nroAfiliado');
  });

  it('nunca expone precios ni el símbolo $ aunque vengan inyectados en las respuestas (RN-RO-01)', async () => {
    sesionPaciente();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/public/prestaciones')) {
        return Promise.resolve(
          respuestaJson([
            {
              id: ID_PREST_CONSULTA,
              nombre: 'Consulta',
              duracionMin: 30,
              precio: 98765,
              reservableOnline: true,
              activa: true,
            },
          ]),
        );
      }
      if (url.includes('/api/paciente/turnos')) {
        return Promise.resolve(
          respuestaJson([
            {
              id: 'turno-sin-precio',
              profesionalId: ID_PROF_ANA,
              boxId: ID_BOX_1,
              pacienteId: 'p1',
              prestacionId: ID_PREST_CONSULTA,
              inicio: '2026-11-27T10:00:00-03:00',
              fin: '2026-11-27T10:30:00-03:00',
              estado: 'confirmado',
              origen: 'online',
              precioAlReservar: 98765,
            },
          ]),
        );
      }
      return Promise.resolve(respuestaJson([]));
    });

    const { container } = renderConRutas(
      '/paciente/turnos',
      () => new Date('2026-11-24T10:00:00-03:00'),
    );

    await waitFor(() => {
      expect(screen.getByText('Consulta')).toBeTruthy();
    });

    const texto = container.textContent ?? '';
    expect(texto).not.toContain('98765');
    expect(texto).not.toContain('$');
  });
});
