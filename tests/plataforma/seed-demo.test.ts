import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { conflictoPaciente, conflictos, enGrilla } from '../../src/modules/turnos-alta/dominio/agenda';
import { FixedClock } from '../../src/shared/clock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { cargarSeedDemo, SEED_DEMO } from '../../src/shared/seed-demo';
import { enZonaConsultorio } from '../../src/shared/zona';

const DIA = 24 * 3600_000;
// Una semana completa, para cubrir los corrimientos de sábado y domingo.
const INSTANTES = Array.from({ length: 7 }, (_, i) => new Date(Date.parse('2026-11-23T22:30:00-03:00') + i * DIA));

async function cargar(ahora: Date) {
  const repos = crearRepositoriosEnMemoria();
  cargarSeedDemo(repos, ahora);
  return repos;
}

describe('Seed de demostración', () => {
  it.each(INSTANTES)('respeta la agenda con ahora = %s', async (ahora) => {
    const turnos = await (await cargar(ahora)).turnos.listar();
    expect(turnos.length).toBeGreaterThan(15);
    const fechaHoy = enZonaConsultorio(ahora).fecha;

    for (const t of turnos) {
      const otros = turnos.filter((o) => o.id !== t.id);
      if (t.estado !== 'cancelado') {
        expect(conflictos(otros, t)).toEqual({ profesional: false, box: false });
        expect(conflictoPaciente(otros, t)).toBe(false);
      }
      expect(enGrilla(t.inicio)).toBe(true);
      const desde = enZonaConsultorio(t.inicio);
      const hasta = enZonaConsultorio(t.fin);
      expect(desde.diaSemana).toBeLessThanOrEqual(5);
      expect(desde.hhmm >= '09:00' && hasta.hhmm <= '13:00' && desde.fecha === hasta.fecha).toBe(true);
      if (t.estado === 'reservado' || t.estado === 'confirmado') {
        expect(desde.fecha >= fechaHoy).toBe(true);
      } else {
        expect(t.fin.getTime()).toBeLessThan(ahora.getTime());
      }
    }
  });

  it('La semilla demo carga turnos del día actual y un solo turno futuro para Mario Santos sin solapamientos', async () => {
    const ahora = new Date('2026-11-23T08:00:00-03:00');
    const fechaHoy = enZonaConsultorio(ahora).fecha;
    const turnos = await (await cargar(ahora)).turnos.listar();

    const turnosDeHoy = turnos.filter(
      (t) =>
        enZonaConsultorio(t.inicio).fecha === fechaHoy &&
        (t.estado === 'reservado' || t.estado === 'confirmado'),
    );
    expect(turnosDeHoy.some((t) => t.profesionalId === SEED.profesionales.anaPerez.id)).toBe(true);
    expect(turnosDeHoy.some((t) => t.profesionalId === SEED.profesionales.brunoGomez.id)).toBe(true);
    expect(turnosDeHoy.some((t) => t.estado === 'reservado')).toBe(true);
    expect(turnosDeHoy.some((t) => t.estado === 'confirmado')).toBe(true);

    for (const t of turnos) {
      if (t.estado === 'cancelado') continue;
      const otros = turnos.filter((o) => o.id !== t.id);
      expect(conflictoPaciente(otros, t)).toBe(false);
    }

    const futurosSantos = turnos.filter(
      (t) =>
        t.pacienteId === SEED_DEMO.pacientes.santos.id &&
        (t.estado === 'reservado' || t.estado === 'confirmado'),
    );
    expect(futurosSantos).toHaveLength(1);
    expect(futurosSantos[0]!.inicio.getTime()).toBeGreaterThan(ahora.getTime());
  });

  it('usa solo datos ficticios y piezas FDI válidas', async () => {
    const repos = await cargar(INSTANTES[0]!);
    for (const p of Object.values(SEED_DEMO.pacientes)) {
      expect(p.email).toMatch(/@example\.com$/);
      expect(p.documento).toMatch(/^000001\d\d$/);
    }
    const fdi = /^(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])$/;
    for (const e of await repos.estadosPieza.listar()) expect(String(e.pieza)).toMatch(fdi);
  });

  it('se ve desde la API: Mario Santos entra y la profesional ve el odontograma de Mafalda', async () => {
    const ahora = INSTANTES[0]!;
    const app = await buildApp({ repos: await cargar(ahora), clock: new FixedClock(ahora) });
    const login = async (email: string, password: string) =>
      (await app.inject({ method: 'POST', url: '/api/public/login', payload: { email, password } })).json<{ token: string }>().token;

    const santos = await login('santos@example.com', 'simulador-ejemplo');
    const turnos = await app.inject({ method: 'GET', url: '/api/paciente/turnos', headers: { authorization: `Bearer ${santos}` } });
    expect(turnos.statusCode).toBe(200);
    expect(turnos.json<unknown[]>()).toHaveLength(4);

    const prof = await login('profesional@example.com', 'profesional-ejemplo');
    const odo = await app.inject({
      method: 'GET', url: `/api/pacientes/${SEED_DEMO.pacientes.mafalda.id}/odontograma`, headers: { authorization: `Bearer ${prof}` },
    });
    expect(odo.statusCode).toBe(200);
    const vista = odo.json<{ piezas: { pieza: number; cara?: string; estado: string }[]; historial: { fecha: string }[] }>();
    expect(vista.piezas).toContainEqual(expect.objectContaining({ pieza: 54, cara: 'oclusal', estado: 'obturado' }));
    expect(new Set(vista.historial.map((h) => h.fecha)).size).toBe(2);
  }, 20_000); // dos logins con bcrypt real
});
