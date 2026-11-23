import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { crearEmisorJwt, type EmisorToken } from '../../src/modules/cuentas/adapter';
import type { Clock } from '../../src/shared/clock';
import type { CaraPieza, EstadoDePieza, Turno, Usuario } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria, type Repositorios } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

const T1 = '2026-11-23T10:00:00.000Z';
const T2 = '2026-11-23T10:30:00.000Z';
const T3 = '2026-11-23T11:00:00.000Z';
const PASS_PROFESIONAL = 'profesional-ejemplo';

interface EntradaHistoriaJson {
  id: string;
  pacienteId: string;
  profesionalId: string;
  fecha: string;
  texto: string;
  turnoId?: string;
  corrigeAId?: string;
}

interface EstadoPiezaJson {
  id: string;
  odontogramaId: string;
  pieza: number;
  cara?: CaraPieza;
  estado: EstadoDePieza;
  registradoPor: string;
  fecha: string;
}

interface VistaOdontogramaJson {
  odontogramaId: string | null;
  pacienteId: string;
  actualizadoEn: string | null;
  piezas: EstadoPiezaJson[];
  historial: EstadoPiezaJson[];
}

interface ErrorFormatoJson {
  code: string;
  detalles: Array<{ campo: string; motivo: string }>;
}

function relojControlable(isoInicial: string): { clock: Clock; fijar: (iso: string) => void } {
  let instante = new Date(isoInicial);
  return {
    clock: { ahora: () => new Date(instante.getTime()) },
    fijar: (iso: string) => {
      instante = new Date(iso);
    },
  };
}

function turnoFicticio(id: string, pacienteId: string): Turno {
  return {
    id,
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId,
    inicio: new Date('2026-11-23T12:00:00.000Z'),
    fin: new Date('2026-11-23T12:30:00.000Z'),
    estado: 'reservado',
    origen: 'profesional',
    precioAlReservar: 15000,
    creadoPor: SEED.usuarios.anaPerez.id,
    creadoEn: new Date('2026-11-23T09:00:00.000Z'),
  };
}

function todasLasPiezasFdi(): number[] {
  const piezas: number[] = [];
  for (const c of [1, 2, 3, 4]) {
    for (let p = 1; p <= 8; p++) piezas.push(c * 10 + p);
  }
  for (const c of [5, 6, 7, 8]) {
    for (let p = 1; p <= 5; p++) piezas.push(c * 10 + p);
  }
  return piezas;
}

describe('Especificación HTTP de clinica', () => {
  let repos: Repositorios;
  let fijarReloj: (iso: string) => void;
  let emisor: EmisorToken;
  let app: FastifyInstance;

  beforeEach(async () => {
    repos = crearRepositoriosEnMemoria();
    const reloj = relojControlable(T1);
    fijarReloj = reloj.fijar;
    emisor = crearEmisorJwt(reloj.clock);
    app = await buildApp({ repos, clock: reloj.clock });
  });

  afterEach(async () => {
    await app.close();
  });

  async function authDe(usuario: Pick<Usuario, 'id' | 'rol'>): Promise<{ authorization: string }> {
    const token = await emisor.emitir({ usuarioId: usuario.id, rol: usuario.rol });
    return { authorization: `Bearer ${token}` };
  }

  describe('Consulta cronológica de la historia clínica', () => {
    it('Profesional consulta la historia clínica con múltiples entradas ordenadas cronológicamente', async () => {
      await repos.turnos.guardar(turnoFicticio('turno-hc-crono', SEED.pacientes.uno.id));
      const auth = await authDe(SEED.usuarios.anaPerez);

      fijarReloj(T2);
      const rT2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Segunda evolución cronológica.' },
      });
      expect(rT2.statusCode).toBe(201);
      const eT2 = rT2.json<EntradaHistoriaJson>();

      fijarReloj(T1);
      const rT1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Primera evolución vinculada a turno.', turnoId: 'turno-hc-crono' },
      });
      expect(rT1.statusCode).toBe(201);
      const eT1 = rT1.json<EntradaHistoriaJson>();

      fijarReloj(T3);
      const rT3 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Tercera evolución con corrección.', corrigeAId: eT2.id },
      });
      expect(rT3.statusCode).toBe(201);
      const eT3 = rT3.json<EntradaHistoriaJson>();

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const entradas = res.json<EntradaHistoriaJson[]>();
      expect(entradas).toEqual([
        {
          id: eT1.id,
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          fecha: T1,
          texto: 'Primera evolución vinculada a turno.',
          turnoId: 'turno-hc-crono',
        },
        {
          id: eT2.id,
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          fecha: T2,
          texto: 'Segunda evolución cronológica.',
        },
        {
          id: eT3.id,
          pacienteId: SEED.pacientes.uno.id,
          profesionalId: SEED.profesionales.anaPerez.id,
          fecha: T3,
          texto: 'Tercera evolución con corrección.',
          corrigeAId: eT2.id,
        },
      ]);
    });

    it('Empate de marca temporal preserva el orden de inserción en la historia clínica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const r1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Primera entrada en T1.' },
      });
      const r2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Segunda entrada en T1.' },
      });
      expect(r1.statusCode).toBe(201);
      expect(r2.statusCode).toBe(201);
      const e1 = r1.json<EntradaHistoriaJson>();
      const e2 = r2.json<EntradaHistoriaJson>();

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<EntradaHistoriaJson[]>().map((e) => e.id)).toEqual([e1.id, e2.id]);
    });

    it('Profesional consulta la historia clínica de un paciente sin entradas previas', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/historia`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('Consulta de historia clínica de un paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'GET',
        url: '/api/pacientes/paciente-inexistente/historia',
        headers: auth,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
    });
  });

  describe('Registro append-only de entradas de historia clínica', () => {
    it('Profesional registra una evolución clínica básica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: '  Control general sin hallazgos relevantes.  ' },
      });
      expect(res.statusCode).toBe(201);
      const entrada = res.json<EntradaHistoriaJson>();
      expect(entrada.id).toBeTruthy();
      expect(entrada).toMatchObject({
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        fecha: T1,
        texto: 'Control general sin hallazgos relevantes.',
      });
      expect(await repos.historiaClinica.listar()).toHaveLength(1);
    });

    it('Profesional registra una evolución vinculada a un turno del mismo paciente', async () => {
      await repos.turnos.guardar(turnoFicticio('turno-hc-uno', SEED.pacientes.uno.id));
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Evolución vinculada al turno.', turnoId: 'turno-hc-uno' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json<EntradaHistoriaJson>()).toMatchObject({
        pacienteId: SEED.pacientes.uno.id,
        turnoId: 'turno-hc-uno',
        texto: 'Evolución vinculada al turno.',
      });
    });

    it('Profesional registra una corrección referenciando una entrada previa del mismo paciente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const r1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Nota original en pieza 16.' },
      });
      expect(r1.statusCode).toBe(201);
      const e1 = r1.json<EntradaHistoriaJson>();

      fijarReloj(T2);
      const r2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Aclaración: correspondía a pieza 26.', corrigeAId: e1.id },
      });
      expect(r2.statusCode).toBe(201);
      const e2 = r2.json<EntradaHistoriaJson>();
      expect(e2.corrigeAId).toBe(e1.id);

      const lista = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
      });
      expect(lista.statusCode).toBe(200);
      expect(lista.json<EntradaHistoriaJson[]>()).toEqual([e1, e2]);
    });

    it('Registro de historia clínica para un paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: '/api/pacientes/paciente-inexistente/historia',
        headers: auth,
        payload: { texto: 'Evolución válida.' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });

    it('Rechazo de turnoId inexistente al registrar evolución', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Evolución con turno inexistente.', turnoId: 'turno-inexistente' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });

    it('Rechazo de turnoId perteneciente a otro paciente', async () => {
      await repos.turnos.guardar(turnoFicticio('turno-paciente-dos', SEED.pacientes.dos.id));
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Evolución con turno ajeno.', turnoId: 'turno-paciente-dos' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });

    it('Rechazo de corrigeAId inexistente al registrar corrección', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Corrección de entrada inexistente.', corrigeAId: 'hc-inexistente' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });

    it('Rechazo de corrigeAId perteneciente a otro paciente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const notaDos = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/historia`,
        headers: auth,
        payload: { texto: 'Nota clínica del paciente dos.' },
      });
      expect(notaDos.statusCode).toBe(201);
      const idNotaDos = notaDos.json<EntradaHistoriaJson>().id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Intento de corregir nota ajena.', corrigeAId: idNotaDos },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(
        await repos.historiaClinica.listar((e) => e.pacienteId === SEED.pacientes.uno.id),
      ).toEqual([]);
    });

    it('Rechazo de texto vacío o compuesto solo por espacios', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      for (const texto of ['', '   ']) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload: { texto },
        });
        expect(res.statusCode).toBe(400);
        const body = res.json<ErrorFormatoJson>();
        expect(body.code).toBe('FORMATO_INVALIDO');
        expect(body.detalles.length).toBeGreaterThan(0);
      }
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });

    it('Aceptación de texto de 5000 caracteres y rechazo al superar 5000 caracteres', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const r5000 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: `  ${'a'.repeat(5000)}  ` },
      });
      expect(r5000.statusCode).toBe(201);
      expect(r5000.json<EntradaHistoriaJson>().texto).toHaveLength(5000);

      const r5001 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'a'.repeat(5001) },
      });
      expect(r5001.statusCode).toBe(400);
      expect(r5001.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      expect(await repos.historiaClinica.listar()).toHaveLength(1);
    });

    it('Rechazo de campos controlados por el servidor en el alta de historia clínica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const payloads = [
        { texto: 'Nota.', profesionalId: SEED.profesionales.brunoGomez.id },
        { texto: 'Nota.', fecha: T2 },
        { texto: 'Nota.', id: 'id-forzado-cliente' },
        { texto: 'Nota.', pacienteId: SEED.pacientes.dos.id },
      ];

      for (const payload of payloads) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.historiaClinica.listar()).toEqual([]);
    });
  });

  describe('Inmutabilidad append-only de la historia clínica y ausencia de borrado en odontograma', () => {
    it('No existe ruta PUT para modificar la historia clínica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const creada = (
        await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload: { texto: 'Nota original inmutable.' },
        })
      ).json<EntradaHistoriaJson>();

      for (const url of [
        `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        `/api/pacientes/${SEED.pacientes.uno.id}/historia/${creada.id}`,
      ]) {
        const res = await app.inject({
          method: 'PUT',
          url,
          headers: auth,
          payload: { texto: 'Intento de modificación.' },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      }

      const [persistida] = await repos.historiaClinica.listar((e) => e.id === creada.id);
      expect(persistida?.texto).toBe('Nota original inmutable.');
    });

    it('No existe ruta PATCH para modificar la historia clínica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const creada = (
        await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload: { texto: 'Nota original inmutable.' },
        })
      ).json<EntradaHistoriaJson>();

      for (const url of [
        `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        `/api/pacientes/${SEED.pacientes.uno.id}/historia/${creada.id}`,
      ]) {
        const res = await app.inject({
          method: 'PATCH',
          url,
          headers: auth,
          payload: { texto: 'Intento de parche.' },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      }

      const [persistida] = await repos.historiaClinica.listar((e) => e.id === creada.id);
      expect(persistida?.texto).toBe('Nota original inmutable.');
    });

    it('No existe ruta DELETE para borrar la historia clínica', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const creada = (
        await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload: { texto: 'Nota que no puede borrarse.' },
        })
      ).json<EntradaHistoriaJson>();

      for (const url of [
        `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        `/api/pacientes/${SEED.pacientes.uno.id}/historia/${creada.id}`,
      ]) {
        const res = await app.inject({ method: 'DELETE', url, headers: auth });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      }

      expect(await repos.historiaClinica.listar()).toHaveLength(1);
    });

    it('No existe ruta PATCH sobre el odontograma', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'caries' }] },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect((await repos.estadosPieza.listar()).map((e) => e.estado)).toEqual(['sano']);
    });

    it('No existe ruta DELETE sobre el odontograma', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.odontogramas.listar()).toHaveLength(1);
      expect(await repos.estadosPieza.listar()).toHaveLength(1);
    });
  });

  describe('Consulta y proyección vigente del odontograma', () => {
    it('Profesional consulta el odontograma de un paciente sin registros previos sin crear efectos secundarios', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        odontogramaId: null,
        pacienteId: SEED.pacientes.uno.id,
        actualizadoEn: null,
        piezas: [],
        historial: [],
      });
      expect(await repos.odontogramas.listar()).toEqual([]);
    });

    it('Profesional consulta el odontograma con proyección vigente e historial completo', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 21, estado: 'sano' },
          ],
        },
      });

      fijarReloj(T2);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'obturado' }] },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.odontogramaId).not.toBeNull();
      expect(vista.actualizadoEn).toBe(T2);
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'obturado' },
        { pieza: 21, cara: undefined, estado: 'sano' },
      ]);
      expect(
        vista.historial.map((h) => ({
          pieza: h.pieza,
          cara: h.cara,
          estado: h.estado,
          registradoPor: h.registradoPor,
          fecha: h.fecha,
        })),
      ).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'caries', registradoPor: SEED.profesionales.anaPerez.id, fecha: T1 },
        { pieza: 21, cara: undefined, estado: 'sano', registradoPor: SEED.profesionales.anaPerez.id, fecha: T1 },
        { pieza: 16, cara: 'oclusal', estado: 'obturado', registradoPor: SEED.profesionales.anaPerez.id, fecha: T2 },
      ]);
      expect('fechaDefecto' in vista).toBe(false);
      expect('fechaSanado' in vista).toBe(false);
      for (const item of [...vista.piezas, ...vista.historial]) {
        expect('fechaDefecto' in item).toBe(false);
        expect('fechaSanado' in item).toBe(false);
      }
    });

    it('Múltiples caras distintas de la misma pieza coexisten en la proyección actual', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'caries' }] },
      });
      fijarReloj(T2);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, cara: 'mesial', estado: 'obturado' }] },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'mesial', estado: 'obturado' },
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
      ]);
      expect(vista.historial).toHaveLength(2);
    });

    it('Un registro de cara específica desplaza a un estado previo de pieza completa en piezas preservando historial', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });
      fijarReloj(T2);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'caries' }] },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
      ]);
      expect(vista.historial.map((h) => ({ pieza: h.pieza, cara: h.cara, estado: h.estado }))).toEqual([
        { pieza: 16, cara: undefined, estado: 'sano' },
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
      ]);
    });

    it('Un registro de pieza completa desplaza a los estados previos por cara en piezas preservando historial', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 16, cara: 'mesial', estado: 'obturado' },
          ],
        },
      });
      fijarReloj(T2);
      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'corona' }] },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: undefined, estado: 'corona' },
      ]);
      expect(vista.historial.map((h) => ({ pieza: h.pieza, cara: h.cara, estado: h.estado }))).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
        { pieza: 16, cara: 'mesial', estado: 'obturado' },
        { pieza: 16, cara: undefined, estado: 'corona' },
      ]);
    });

    it('Consulta del odontograma de un paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'GET',
        url: '/api/pacientes/paciente-inexistente/odontograma',
        headers: auth,
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
    });
  });

  describe('Actualización incremental y concurrencia del odontograma', () => {
    it('Primera actualización crea el odontograma 1 a 1 y registra las piezas', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 21, estado: 'sano' },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.odontogramaId).not.toBeNull();
      expect(vista.actualizadoEn).toBe(T1);
      expect(vista.piezas).toHaveLength(2);
      expect(vista.historial).toHaveLength(2);
      expect(
        vista.historial.every(
          (h) => h.registradoPor === SEED.profesionales.anaPerez.id && h.fecha === T1,
        ),
      ).toBe(true);
      expect(
        await repos.odontogramas.listar((o) => o.pacienteId === SEED.pacientes.uno.id),
      ).toHaveLength(1);
    });

    it('Actualización incremental conserva otras piezas y acumula historial de la pieza actualizada', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const put1 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 21, estado: 'sano' },
          ],
        },
      });
      expect(put1.statusCode).toBe(200);
      const v1 = put1.json<VistaOdontogramaJson>();

      fijarReloj(T2);
      const put2 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'obturado' }] },
      });
      expect(put2.statusCode).toBe(200);
      const v2 = put2.json<VistaOdontogramaJson>();

      expect(v2.odontogramaId).toBe(v1.odontogramaId);
      expect(v2.actualizadoEn).toBe(T2);
      expect(v2.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'obturado' },
        { pieza: 21, cara: undefined, estado: 'sano' },
      ]);
      expect(
        v2.historial.map((h) => ({ pieza: h.pieza, cara: h.cara, estado: h.estado, fecha: h.fecha })),
      ).toEqual([
        { pieza: 16, cara: 'oclusal', estado: 'caries', fecha: T1 },
        { pieza: 21, cara: undefined, estado: 'sano', fecha: T1 },
        { pieza: 16, cara: 'oclusal', estado: 'obturado', fecha: T2 },
      ]);
    });

    it('Rechazo de campos controlados por el servidor en PUT odontograma', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const payloads: Record<string, unknown>[] = [
        { piezas: [{ pieza: 16, estado: 'sano' }], odontogramaId: 'odo-forzado' },
        { piezas: [{ pieza: 16, estado: 'sano' }], actualizadoEn: T2 },
        { piezas: [{ pieza: 16, estado: 'sano', registradoPor: SEED.profesionales.brunoGomez.id }] },
        { piezas: [{ pieza: 16, estado: 'sano', fecha: T2 }] },
      ];

      for (const payload of payloads) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });

    it('Actualización de odontograma para un paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/pacientes/paciente-inexistente/odontograma',
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.odontogramas.listar()).toEqual([]);
    });

    it('Dos actualizaciones simultáneas sobre un paciente sin odontograma previo', async () => {
      const listarOriginal = repos.odontogramas.listar.bind(repos.odontogramas);
      repos.odontogramas.listar = async (filtro) => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return listarOriginal(filtro);
      };
      const auth = await authDe(SEED.usuarios.anaPerez);

      const [r1, r2] = await Promise.all([
        app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 16, estado: 'caries' }] },
        }),
        app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 21, estado: 'obturado' }] },
        }),
      ]);

      expect(r1.statusCode).toBe(200);
      expect(r2.statusCode).toBe(200);
      expect(
        await repos.odontogramas.listar((o) => o.pacienteId === SEED.pacientes.uno.id),
      ).toHaveLength(1);

      const final = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(final.statusCode).toBe(200);
      const vista = final.json<VistaOdontogramaJson>();
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, estado: p.estado }))).toEqual([
        { pieza: 16, estado: 'caries' },
        { pieza: 21, estado: 'obturado' },
      ]);
      expect(vista.historial).toHaveLength(2);
    });
  });

  describe('Validación FDI, estados por cara y consistencia intra-lote del odontograma', () => {
    it('Aceptación de todos los límites válidos de notación FDI permanente y temporaria', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const piezas = [
        { pieza: 11, estado: 'sano' },
        { pieza: 18, estado: 'ausente' },
        { pieza: 21, cara: 'vestibular', estado: 'caries' },
        { pieza: 28, estado: 'a_extraer' },
        { pieza: 31, cara: 'lingual', estado: 'obturado' },
        { pieza: 38, estado: 'corona' },
        { pieza: 41, estado: 'endodoncia' },
        { pieza: 48, cara: 'oclusal', estado: 'sano' },
        { pieza: 51, estado: 'sano' },
        { pieza: 55, cara: 'mesial', estado: 'caries' },
        { pieza: 61, estado: 'sano' },
        { pieza: 65, cara: 'distal', estado: 'obturado' },
        { pieza: 71, estado: 'sano' },
        { pieza: 75, estado: 'ausente' },
        { pieza: 81, estado: 'sano' },
        { pieza: 85, estado: 'caries' },
      ];

      const res = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<VistaOdontogramaJson>().piezas).toHaveLength(16);
    });

    it('Rechazo de códigos FDI en huecos o fuera de rango', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const codigosInvalidos = [19, 20, 29, 30, 39, 40, 49, 50, 56, 60, 66, 70, 76, 80, 86];

      for (const pieza of codigosInvalidos) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza, estado: 'sano' }] },
        });
        expect(res.statusCode, `pieza ${pieza} debe dar 400`).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });

    it('Rechazo de códigos FDI no enteros o menores o iguales a cero', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      for (const pieza of [0, -11, 11.5]) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza, estado: 'sano' }] },
        });
        expect(res.statusCode, `pieza ${pieza} debe dar 400`).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });

    it('Rechazo de estados o caras fuera de los contratos congelados', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const payloads = [
        { piezas: [{ pieza: 16, estado: 'danado' }] },
        { piezas: [{ pieza: 16, estado: 'sensible' }] },
        { piezas: [{ pieza: 16, estado: 'en_recambio' }] },
        { piezas: [{ pieza: 16, cara: 'palatina', estado: 'caries' }] },
      ];

      for (const payload of payloads) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });

    it('Rechazo de estados exclusivos de pieza completa enviados con cara', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      for (const estado of ['ausente', 'corona', 'endodoncia', 'a_extraer'] as const) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado }] },
        });
        expect(res.statusCode, `estado ${estado} con cara debe dar 400`).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.estadosPieza.listar()).toEqual([]);

      const ok = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 11, estado: 'ausente' },
            { pieza: 12, estado: 'corona' },
            { pieza: 13, estado: 'endodoncia' },
            { pieza: 14, estado: 'a_extraer' },
            { pieza: 15, estado: 'caries' },
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 17, estado: 'obturado' },
            { pieza: 18, cara: 'distal', estado: 'obturado' },
            { pieza: 21, estado: 'sano' },
            { pieza: 22, cara: 'vestibular', estado: 'sano' },
          ],
        },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json<VistaOdontogramaJson>().piezas).toHaveLength(10);
    });

    it('Rechazo de lote vacío en actualización de odontograma', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      expect(await repos.odontogramas.listar()).toEqual([]);
    });

    it('Rechazo de lote que supera el máximo de 260 ítems en actualización de odontograma', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const lote261 = Array.from({ length: 261 }, () => ({ pieza: 16, estado: 'sano' }));
      const r261 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: lote261 },
      });
      expect(r261.statusCode).toBe(400);
      expect(r261.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      expect(await repos.odontogramas.listar()).toEqual([]);

      const caras: CaraPieza[] = ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'];
      const lote260 = todasLasPiezasFdi().flatMap((pieza) =>
        caras.map((cara) => ({ pieza, cara, estado: 'caries' as const })),
      );
      expect(lote260).toHaveLength(260);
      const r260 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/odontograma`,
        headers: auth,
        payload: { piezas: lote260 },
      });
      expect(r260.statusCode).toBe(200);
      expect(r260.json<VistaOdontogramaJson>().piezas).toHaveLength(260);
    });

    it('Aceptación de múltiples caras distintas de la misma pieza en un mismo lote', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 16, cara: 'mesial', estado: 'obturado' },
          ],
        },
      });
      expect(res.statusCode).toBe(200);
      const vista = res.json<VistaOdontogramaJson>();
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'mesial', estado: 'obturado' },
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
      ]);
      expect(vista.historial).toHaveLength(2);
    });

    it('Rechazo de pares pieza-cara duplicados dentro del mismo pedido', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);
      const duplicados = [
        [
          { pieza: 16, cara: 'oclusal', estado: 'caries' },
          { pieza: 16, cara: 'oclusal', estado: 'obturado' },
        ],
        [
          { pieza: 21, estado: 'sano' },
          { pieza: 21, estado: 'corona' },
        ],
      ];

      for (const piezas of duplicados) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: auth,
          payload: { piezas },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      }
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });

    it('Rechazo de mezcla de pieza completa y cara específica sobre la misma pieza en el mismo pedido', async () => {
      const auth = await authDe(SEED.usuarios.anaPerez);

      const res = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, estado: 'sano' },
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json<ErrorFormatoJson>().code).toBe('FORMATO_INVALIDO');
      expect(await repos.odontogramas.listar()).toEqual([]);
      expect(await repos.estadosPieza.listar()).toEqual([]);
    });
  });

  describe('Control de acceso por rol y visibilidad multiprofesional', () => {
    it('Acceso sin autenticación o con token inválido en rutas clínicas', async () => {
      const rutas = [
        { method: 'GET' as const, url: `/api/pacientes/${SEED.pacientes.uno.id}/historia` },
        {
          method: 'POST' as const,
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          payload: { texto: 'Nota clínica ficticia.' },
        },
        { method: 'GET' as const, url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma` },
        {
          method: 'PUT' as const,
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
        },
      ];

      for (const ruta of rutas) {
        const sinAuth = await app.inject(ruta);
        expect(sinAuth.statusCode).toBe(401);
        expect(sinAuth.json()).toEqual({ code: 'NO_AUTENTICADO' });

        const invalido = await app.inject({
          ...ruta,
          headers: { authorization: 'Bearer token.invalido.aqui' },
        });
        expect(invalido.statusCode).toBe(401);
        expect(invalido.json()).toEqual({ code: 'NO_AUTENTICADO' });
      }
    });

    it('Recepcionista rechazada en rutas de historia clínica incluso con paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.recepcion);

      for (const pacienteId of [SEED.pacientes.uno.id, 'paciente-inexistente']) {
        const getRes = await app.inject({
          method: 'GET',
          url: `/api/pacientes/${pacienteId}/historia`,
          headers: auth,
        });
        expect(getRes.statusCode).toBe(403);
        expect(getRes.json()).toEqual({ code: 'SIN_PERMISO' });

        const postRes = await app.inject({
          method: 'POST',
          url: `/api/pacientes/${pacienteId}/historia`,
          headers: auth,
          payload: { texto: 'Intento sin permiso.' },
        });
        expect(postRes.statusCode).toBe(403);
        expect(postRes.json()).toEqual({ code: 'SIN_PERMISO' });
      }
    });

    it('Recepcionista rechazada en rutas de odontograma incluso con paciente inexistente', async () => {
      const auth = await authDe(SEED.usuarios.recepcion);

      for (const pacienteId of [SEED.pacientes.uno.id, 'paciente-inexistente']) {
        const getRes = await app.inject({
          method: 'GET',
          url: `/api/pacientes/${pacienteId}/odontograma`,
          headers: auth,
        });
        expect(getRes.statusCode).toBe(403);
        expect(getRes.json()).toEqual({ code: 'SIN_PERMISO' });

        const putRes = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${pacienteId}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
        });
        expect(putRes.statusCode).toBe(403);
        expect(putRes.json()).toEqual({ code: 'SIN_PERMISO' });
      }
    });

    it('Paciente rechazado en rutas de historia clínica incluso sobre su propio identificador', async () => {
      const auth = await authDe(SEED.usuarios.paciente1);

      for (const pacienteId of [SEED.pacientes.uno.id, SEED.pacientes.dos.id, 'paciente-inexistente']) {
        const getRes = await app.inject({
          method: 'GET',
          url: `/api/pacientes/${pacienteId}/historia`,
          headers: auth,
        });
        expect(getRes.statusCode).toBe(403);
        expect(getRes.json()).toEqual({ code: 'SIN_PERMISO' });

        const postRes = await app.inject({
          method: 'POST',
          url: `/api/pacientes/${pacienteId}/historia`,
          headers: auth,
          payload: { texto: 'Intento de paciente.' },
        });
        expect(postRes.statusCode).toBe(403);
        expect(postRes.json()).toEqual({ code: 'SIN_PERMISO' });
      }
    });

    it('Paciente rechazado en rutas de odontograma incluso sobre su propio identificador', async () => {
      const auth = await authDe(SEED.usuarios.paciente1);

      for (const pacienteId of [SEED.pacientes.uno.id, SEED.pacientes.dos.id, 'paciente-inexistente']) {
        const getRes = await app.inject({
          method: 'GET',
          url: `/api/pacientes/${pacienteId}/odontograma`,
          headers: auth,
        });
        expect(getRes.statusCode).toBe(403);
        expect(getRes.json()).toEqual({ code: 'SIN_PERMISO' });

        const putRes = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${pacienteId}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
        });
        expect(putRes.statusCode).toBe(403);
        expect(putRes.json()).toEqual({ code: 'SIN_PERMISO' });
      }
    });

    it('Visibilidad y registro colaborativo entre dos profesionales del consultorio', async () => {
      const authAna = await authDe(SEED.usuarios.anaPerez);

      const rE1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: authAna,
        payload: { texto: 'Caries oclusal observada en pieza 16.' },
      });
      expect(rE1.statusCode).toBe(201);
      const e1 = rE1.json<EntradaHistoriaJson>();

      const rOdo1 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: authAna,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'caries' }] },
      });
      expect(rOdo1.statusCode).toBe(200);

      fijarReloj(T2);
      const loginBruno = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: SEED.usuarios.brunoGomez.email, password: PASS_PROFESIONAL },
      });
      expect(loginBruno.statusCode).toBe(200);
      const authBruno = { authorization: `Bearer ${loginBruno.json<{ token: string }>().token}` };

      const hcPrevia = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: authBruno,
      });
      expect(hcPrevia.statusCode).toBe(200);
      expect(hcPrevia.json<EntradaHistoriaJson[]>()).toHaveLength(1);

      const odoPrevio = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: authBruno,
      });
      expect(odoPrevio.statusCode).toBe(200);
      expect(odoPrevio.json<VistaOdontogramaJson>().piezas[0]?.estado).toBe('caries');

      const rE2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: authBruno,
        payload: { texto: 'Se realizó obturación de pieza 16.', corrigeAId: e1.id },
      });
      expect(rE2.statusCode).toBe(201);

      const rOdo2 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: authBruno,
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'obturado' }] },
      });
      expect(rOdo2.statusCode).toBe(200);

      const hcFinal = (
        await app.inject({
          method: 'GET',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: authBruno,
        })
      ).json<EntradaHistoriaJson[]>();
      expect(hcFinal.map((e) => e.profesionalId)).toEqual([
        SEED.profesionales.anaPerez.id,
        SEED.profesionales.brunoGomez.id,
      ]);
      expect(hcFinal[1]?.corrigeAId).toBe(e1.id);

      const odoFinal = (
        await app.inject({
          method: 'GET',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: authBruno,
        })
      ).json<VistaOdontogramaJson>();
      expect(odoFinal.piezas).toHaveLength(1);
      expect(odoFinal.piezas[0]).toMatchObject({
        pieza: 16,
        cara: 'oclusal',
        estado: 'obturado',
        registradoPor: SEED.profesionales.brunoGomez.id,
      });
      expect(
        odoFinal.historial.map((h) => ({
          estado: h.estado,
          registradoPor: h.registradoPor,
          fecha: h.fecha,
        })),
      ).toEqual([
        { estado: 'caries', registradoPor: SEED.profesionales.anaPerez.id, fecha: T1 },
        { estado: 'obturado', registradoPor: SEED.profesionales.brunoGomez.id, fecha: T2 },
      ]);
    });
  });

  describe('Datos 100 % ficticios en registros clínicos de prueba', () => {
    it('Suite clínica libre de datos reales de pacientes', async () => {
      const pacientes = await repos.pacientes.listar();
      expect(pacientes.map((p) => `${p.nombre} ${p.apellido}`)).toEqual([
        'Paciente Ficticio Uno',
        'Paciente Ficticio Dos',
      ]);
      expect(pacientes.every((p) => p.documento.startsWith('000000'))).toBe(true);

      const profesionales = await repos.profesionales.listar();
      expect(profesionales.map((p) => p.nombre)).toEqual(['Dra. Ana Pérez', 'Dr. Bruno Gómez']);

      const usuarios = await repos.usuarios.listar();
      expect(usuarios.every((u) => u.email.endsWith('@example.com'))).toBe(true);

      const carpetaTests = fileURLToPath(new URL('.', import.meta.url));
      const archivos = (await readdir(carpetaTests)).filter((f) => f.endsWith('.test.ts'));
      expect(archivos.length).toBeGreaterThanOrEqual(4);
      for (const archivo of archivos) {
        const contenido = await readFile(join(carpetaTests, archivo), 'utf8');
        const correos = contenido.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
        for (const correo of correos) {
          expect(correo, `correo no ficticio en ${archivo}: ${correo}`).toMatch(/@example\.com$/);
        }
      }
    });
  });
});
