import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../src/app';
import { FixedClock, type Clock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';

const T1 = '2026-11-23T10:00:00.000Z';
const T2 = '2026-11-23T10:30:00.000Z';
const PASS_PROFESIONAL = 'profesional-ejemplo';
const PASS_RECEPCION = 'recepcion-ejemplo';
const PASS_PACIENTE = 'paciente-ejemplo';

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

describe('Rutas HTTP de historia clínica y odontograma (Tasks 4.1 y 4.2)', () => {
  const appsAbiertas: FastifyInstance[] = [];

  async function crearApp(opciones: BuildAppOptions = {}): Promise<FastifyInstance> {
    const app = await buildApp(opciones);
    appsAbiertas.push(app);
    return app;
  }

  afterEach(async () => {
    while (appsAbiertas.length > 0) {
      const app = appsAbiertas.pop();
      if (app) await app.close();
    }
  });

  async function tokenDe(app: FastifyInstance, email: string, password: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/public/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { token: string }).token;
  }

  describe('Historia clínica — GET/POST /api/pacientes/:id/historia', () => {
    it('registra evoluciones básicas, con turnoId y corrigeAId, y las lista en orden cronológico y empates', async () => {
      const repos = crearRepositoriosEnMemoria();
      await repos.turnos.guardar(turnoFicticio('turno-hc-1', SEED.pacientes.uno.id));
      const { clock, fijar } = relojControlable(T1);
      const app = await crearApp({ repos, clock });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      const vacia = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/historia`,
        headers: auth,
      });
      expect(vacia.statusCode).toBe(200);
      expect(vacia.json()).toEqual([]);

      const r1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: '  Control general sin hallazgos relevantes.  ' },
      });
      expect(r1.statusCode).toBe(201);
      const e1 = r1.json() as {
        id: string;
        pacienteId: string;
        profesionalId: string;
        fecha: string;
        texto: string;
      };
      expect(e1).toMatchObject({
        pacienteId: SEED.pacientes.uno.id,
        profesionalId: SEED.profesionales.anaPerez.id,
        fecha: T1,
        texto: 'Control general sin hallazgos relevantes.',
      });

      const r2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Evolución del mismo instante vinculada al turno.', turnoId: 'turno-hc-1' },
      });
      expect(r2.statusCode).toBe(201);
      const e2 = r2.json() as { id: string; turnoId: string };
      expect(e2.turnoId).toBe('turno-hc-1');

      fijar(T2);
      const r3 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Aclaración de la primera nota.', corrigeAId: e1.id },
      });
      expect(r3.statusCode).toBe(201);
      const e3 = r3.json() as { id: string; corrigeAId: string };
      expect(e3.corrigeAId).toBe(e1.id);

      const lista = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
      });
      expect(lista.statusCode).toBe(200);
      const entradas = lista.json() as Array<{ id: string; texto: string; corrigeAId?: string }>;
      expect(entradas.map((e) => e.id)).toEqual([e1.id, e2.id, e3.id]);
      expect(entradas[0]?.texto).toBe('Control general sin hallazgos relevantes.');
      expect(entradas[2]?.corrigeAId).toBe(e1.id);
    });

    it('acepta texto de exactamente 5000 caracteres y rechaza texto vacío, >5000 caracteres y campos controlados por servidor', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(T1) });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      const r5000 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: `  ${'a'.repeat(5000)}  ` },
      });
      expect(r5000.statusCode).toBe(201);
      expect((r5000.json() as { texto: string }).texto).toHaveLength(5000);

      const invalidos = [
        { texto: '   ' },
        { texto: 'a'.repeat(5001) },
        { texto: 'Nota', profesionalId: SEED.profesionales.brunoGomez.id },
        { texto: 'Nota', fecha: T2 },
        { texto: 'Nota', id: 'id-cliente' },
        { texto: 'Nota', pacienteId: SEED.pacientes.dos.id },
      ];
      for (const payload of invalidos) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: auth,
          payload,
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as { code: string }).code).toBe('FORMATO_INVALIDO');
      }

      expect(await repos.historiaClinica.listar()).toHaveLength(1);
    });

    it('responde 404 NO_ENCONTRADO para paciente, turnoId o corrigeAId inexistentes o ajenos', async () => {
      const repos = crearRepositoriosEnMemoria();
      await repos.turnos.guardar(turnoFicticio('turno-ajeno', SEED.pacientes.dos.id));
      const app = await crearApp({ repos, clock: new FixedClock(T1) });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      const notaDos = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/historia`,
        headers: auth,
        payload: { texto: 'Nota del paciente dos.' },
      });
      expect(notaDos.statusCode).toBe(201);
      const idNotaDos = (notaDos.json() as { id: string }).id;

      const getInexistente = await app.inject({
        method: 'GET',
        url: '/api/pacientes/no-existe/historia',
        headers: auth,
      });
      expect(getInexistente.statusCode).toBe(404);
      expect(getInexistente.json()).toEqual({ code: 'NO_ENCONTRADO' });

      const casos404 = [
        { url: '/api/pacientes/no-existe/historia', payload: { texto: 'Nota.' } },
        {
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          payload: { texto: 'Nota.', turnoId: 'turno-inexistente' },
        },
        {
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          payload: { texto: 'Nota.', turnoId: 'turno-ajeno' },
        },
        {
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          payload: { texto: 'Nota.', corrigeAId: 'hc-inexistente' },
        },
        {
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          payload: { texto: 'Nota.', corrigeAId: idNotaDos },
        },
      ];
      for (const caso of casos404) {
        const res = await app.inject({
          method: 'POST',
          url: caso.url,
          headers: auth,
          payload: caso.payload,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      }

      expect(
        await repos.historiaClinica.listar((e) => e.pacienteId === SEED.pacientes.uno.id),
      ).toEqual([]);
    });

    it('rechaza con 404 NO_ENCONTRADO PUT/PATCH/DELETE sobre historia clínica y PATCH/DELETE sobre odontograma', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(T1) });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      const hc = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: auth,
        payload: { texto: 'Nota inmutable.' },
      });
      const entradaId = (hc.json() as { id: string }).id;

      await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });

      const prohibidas: Array<{ method: 'PUT' | 'PATCH' | 'DELETE'; url: string }> = [
        { method: 'PUT', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia` },
        { method: 'PUT', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia/${entradaId}` },
        { method: 'PATCH', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia` },
        { method: 'PATCH', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia/${entradaId}` },
        { method: 'DELETE', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia` },
        { method: 'DELETE', url: `/api/pacientes/${SEED.pacientes.uno.id}/historia/${entradaId}` },
        { method: 'PATCH', url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma` },
        { method: 'DELETE', url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma` },
      ];

      for (const req of prohibidas) {
        const res = await app.inject({
          method: req.method,
          url: req.url,
          headers: auth,
          payload: req.method === 'DELETE' ? undefined : { texto: 'Intento de edición' },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      }

      expect(await repos.historiaClinica.listar()).toHaveLength(1);
      expect(await repos.odontogramas.listar()).toHaveLength(1);
      expect(await repos.estadosPieza.listar()).toHaveLength(1);
    });
  });

  describe('Odontograma — GET/PUT /api/pacientes/:id/odontograma', () => {
    it('consulta sin efectos secundarios, actualiza incrementalmente y proyecta transiciones pieza completa ↔ caras preservando historial', async () => {
      const repos = crearRepositoriosEnMemoria();
      const { clock, fijar } = relojControlable(T1);
      const app = await crearApp({ repos, clock });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      const getVacio = await app.inject({
        method: 'GET',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
      });
      expect(getVacio.statusCode).toBe(200);
      expect(getVacio.json()).toEqual({
        odontogramaId: null,
        pacienteId: SEED.pacientes.uno.id,
        actualizadoEn: null,
        piezas: [],
        historial: [],
      });
      expect(await repos.odontogramas.listar()).toEqual([]);

      // T1: pieza 16 completa sana + pieza 21 completa sana
      const put1 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: {
          piezas: [
            { pieza: 16, estado: 'sano' },
            { pieza: 21, estado: 'sano' },
          ],
        },
      });
      expect(put1.statusCode).toBe(200);
      const v1 = put1.json() as {
        odontogramaId: string;
        actualizadoEn: string;
        piezas: Array<{ pieza: number; cara?: string; estado: string }>;
        historial: Array<{ pieza: number; cara?: string; estado: string }>;
      };
      expect(v1.odontogramaId).toBeTruthy();
      expect(v1.actualizadoEn).toBe(T1);
      expect(await repos.odontogramas.listar()).toHaveLength(1);

      // T2: dos caras distintas en pieza 16 desplazan a la pieza completa previa en piezas, coexisten entre sí y conservan pieza 21
      fijar(T2);
      const put2 = await app.inject({
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
      expect(put2.statusCode).toBe(200);
      const v2 = put2.json() as typeof v1;
      expect(v2.odontogramaId).toBe(v1.odontogramaId);
      expect(v2.actualizadoEn).toBe(T2);
      expect(v2.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: 'mesial', estado: 'obturado' },
        { pieza: 16, cara: 'oclusal', estado: 'caries' },
        { pieza: 21, cara: undefined, estado: 'sano' },
      ]);
      expect(v2.historial).toHaveLength(4);

      // T3: pieza completa corona en 16 desplaza ambas caras previas en piezas preservando los 5 registros del historial
      fijar('2026-11-23T11:00:00.000Z');
      const put3 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'corona' }] },
      });
      expect(put3.statusCode).toBe(200);
      const v3 = put3.json() as typeof v1;
      expect(v3.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
        { pieza: 16, cara: undefined, estado: 'corona' },
        { pieza: 21, cara: undefined, estado: 'sano' },
      ]);
      expect(v3.historial).toHaveLength(5);
      expect('fechaDefecto' in v3).toBe(false);
      expect('fechaSanado' in v3).toBe(false);
    });

    it('valida todos los límites FDI, estados de pieza completa sin cara vs. con cara, tamaño de lote y consistencia intra-lote', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(T1) });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

      // Extremos de los 8 cuadrantes FDI + todos los estados válidos compatibles
      const extremosFdi = [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 65, 71, 75, 81, 85];
      const rExtremos = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: extremosFdi.map((pieza) => ({ pieza, estado: 'sano' })) },
      });
      expect(rExtremos.statusCode).toBe(200);

      // Tope máximo exacto de 260 ítems (52 piezas FDI × 5 caras) aceptado
      const todasLasFdi: number[] = [];
      for (const c of [1, 2, 3, 4]) {
        for (let p = 1; p <= 8; p++) todasLasFdi.push(c * 10 + p);
      }
      for (const c of [5, 6, 7, 8]) {
        for (let p = 1; p <= 5; p++) todasLasFdi.push(c * 10 + p);
      }
      const caras = ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'] as const;
      const lote260 = todasLasFdi.flatMap((pieza) =>
        caras.map((cara) => ({ pieza, cara, estado: 'caries' as const })),
      );
      expect(lote260).toHaveLength(260);
      const r260 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: auth,
        payload: { piezas: lote260 },
      });
      expect(r260.statusCode).toBe(200);
      expect((r260.json() as { piezas: unknown[] }).piezas).toHaveLength(260);

      // Los 4 estados de pieza completa aceptados SIN cara, y los 3 de cara aceptados CON y SIN cara
      const rEstadosValidos = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.dos.id}/odontograma`,
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
      expect(rEstadosValidos.statusCode).toBe(200);

      const antesCount = (await repos.estadosPieza.listar()).length;

      // Rechazo de los 4 estados de pieza completa cuando se envían con cara
      for (const estado of ['ausente', 'corona', 'endodoncia', 'a_extraer'] as const) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.dos.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza: 36, cara: 'oclusal', estado }] },
        });
        expect(res.statusCode, `estado ${estado} con cara debe dar 400`).toBe(400);
        expect((res.json() as { code: string }).code).toBe('FORMATO_INVALIDO');
      }

      // Rechazo de huecos FDI, no enteros, <= 0
      for (const pieza of [19, 20, 29, 30, 39, 40, 49, 50, 56, 60, 66, 70, 76, 80, 86, 0, -11, 11.5]) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.dos.id}/odontograma`,
          headers: auth,
          payload: { piezas: [{ pieza, estado: 'sano' }] },
        });
        expect(res.statusCode, `pieza ${pieza} debe dar 400`).toBe(400);
        expect((res.json() as { code: string }).code).toBe('FORMATO_INVALIDO');
      }

      // Rechazo de estados/caras fuera de contrato, lote vacío, >260 ítems, duplicados, mezcla y campos extra
      const lote261 = Array.from({ length: 261 }, () => ({ pieza: 16, estado: 'sano' }));
      const payloadsInvalidos: unknown[] = [
        { piezas: [{ pieza: 16, estado: 'danado' }] },
        { piezas: [{ pieza: 16, estado: 'sensible' }] },
        { piezas: [{ pieza: 16, estado: 'en_recambio' }] },
        { piezas: [{ pieza: 16, cara: 'palatina', estado: 'caries' }] },
        { piezas: [] },
        { piezas: lote261 },
        {
          piezas: [
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
            { pieza: 16, cara: 'oclusal', estado: 'obturado' },
          ],
        },
        {
          piezas: [
            { pieza: 21, estado: 'sano' },
            { pieza: 21, estado: 'corona' },
          ],
        },
        {
          piezas: [
            { pieza: 16, estado: 'sano' },
            { pieza: 16, cara: 'oclusal', estado: 'caries' },
          ],
        },
        { piezas: [{ pieza: 16, estado: 'sano' }], odontogramaId: 'odo-extra' },
        { piezas: [{ pieza: 16, estado: 'sano' }], actualizadoEn: T2 },
        { piezas: [{ pieza: 16, estado: 'sano', registradoPor: SEED.profesionales.brunoGomez.id }] },
        { piezas: [{ pieza: 16, estado: 'sano', fecha: T2 }] },
      ];

      for (const payload of payloadsInvalidos) {
        const res = await app.inject({
          method: 'PUT',
          url: `/api/pacientes/${SEED.pacientes.dos.id}/odontograma`,
          headers: auth,
          payload: payload as Record<string, unknown>,
        });
        expect(res.statusCode).toBe(400);
        expect((res.json() as { code: string }).code).toBe('FORMATO_INVALIDO');
      }

      expect((await repos.estadosPieza.listar()).length).toBe(antesCount);

      // Paciente inexistente en GET y PUT
      const get404 = await app.inject({
        method: 'GET',
        url: '/api/pacientes/no-existe/odontograma',
        headers: auth,
      });
      expect(get404.statusCode).toBe(404);

      const put404 = await app.inject({
        method: 'PUT',
        url: '/api/pacientes/no-existe/odontograma',
        headers: auth,
        payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
      });
      expect(put404.statusCode).toBe(404);
    });

    it('serializa dos PUT /api/pacientes/:id/odontograma simultáneos creando estrictamente 1 Odontograma con ambos cambios', async () => {
      const repos = crearRepositoriosEnMemoria();
      const listarOriginal = repos.odontogramas.listar.bind(repos.odontogramas);
      repos.odontogramas.listar = async (filtro) => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return listarOriginal(filtro);
      };

      const app = await crearApp({ repos, clock: new FixedClock(T1) });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const auth = { authorization: `Bearer ${tokenAna}` };

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
      const vista = final.json() as {
        piezas: Array<{ pieza: number; estado: string }>;
        historial: Array<{ pieza: number; estado: string }>;
      };
      expect(vista.piezas.map((p) => ({ pieza: p.pieza, estado: p.estado }))).toEqual([
        { pieza: 16, estado: 'caries' },
        { pieza: 21, estado: 'obturado' },
      ]);
      expect(vista.historial).toHaveLength(2);
    });
  });

  describe('RBAC exclusivo profesional y colaboración multiprofesional', () => {
    it('responde 401 sin token o con token inválido y 403 a recepcionista y paciente incluso para id inexistente o propio', async () => {
      const app = await crearApp({ clock: new FixedClock(T1) });
      const tokenRecepcion = await tokenDe(app, 'recepcion@example.com', PASS_RECEPCION);
      const tokenPaciente = await tokenDe(app, 'paciente1@example.com', PASS_PACIENTE);

      const rutas = (pacienteId: string) => [
        { method: 'GET' as const, url: `/api/pacientes/${pacienteId}/historia` },
        {
          method: 'POST' as const,
          url: `/api/pacientes/${pacienteId}/historia`,
          payload: { texto: 'Nota de prueba.' },
        },
        { method: 'GET' as const, url: `/api/pacientes/${pacienteId}/odontograma` },
        {
          method: 'PUT' as const,
          url: `/api/pacientes/${pacienteId}/odontograma`,
          payload: { piezas: [{ pieza: 16, estado: 'sano' }] },
        },
      ];

      for (const ruta of rutas(SEED.pacientes.uno.id)) {
        const sinAuth = await app.inject(ruta);
        expect(sinAuth.statusCode).toBe(401);
        expect(sinAuth.json()).toEqual({ code: 'NO_AUTENTICADO' });

        const tokenInvalido = await app.inject({
          ...ruta,
          headers: { authorization: 'Bearer token.invalido.aqui' },
        });
        expect(tokenInvalido.statusCode).toBe(401);
        expect(tokenInvalido.json()).toEqual({ code: 'NO_AUTENTICADO' });
      }

      for (const pacienteId of [SEED.pacientes.uno.id, 'paciente-inexistente']) {
        for (const ruta of rutas(pacienteId)) {
          const resRec = await app.inject({
            ...ruta,
            headers: { authorization: `Bearer ${tokenRecepcion}` },
          });
          expect(resRec.statusCode).toBe(403);
          expect(resRec.json()).toEqual({ code: 'SIN_PERMISO' });

          const resPac = await app.inject({
            ...ruta,
            headers: { authorization: `Bearer ${tokenPaciente}` },
          });
          expect(resPac.statusCode).toBe(403);
          expect(resPac.json()).toEqual({ code: 'SIN_PERMISO' });
        }
      }
    });

    it('permite colaboración entre Dra. Ana Pérez y Dr. Bruno Gómez preservando la autoría de cada registro', async () => {
      const { clock, fijar } = relojControlable(T1);
      const app = await crearApp({ clock });
      const tokenAna = await tokenDe(app, 'profesional@example.com', PASS_PROFESIONAL);
      const tokenBruno = await tokenDe(app, 'profesional2@example.com', PASS_PROFESIONAL);

      const rE1 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { texto: 'Caries oclusal observada en pieza 16.' },
      });
      expect(rE1.statusCode).toBe(201);
      const e1 = rE1.json() as { id: string; profesionalId: string };

      const rOdo1 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: { authorization: `Bearer ${tokenAna}` },
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'caries' }] },
      });
      expect(rOdo1.statusCode).toBe(200);

      fijar(T2);

      const rE2 = await app.inject({
        method: 'POST',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
        headers: { authorization: `Bearer ${tokenBruno}` },
        payload: { texto: 'Se realizó obturación de pieza 16.', corrigeAId: e1.id },
      });
      expect(rE2.statusCode).toBe(201);

      const rOdo2 = await app.inject({
        method: 'PUT',
        url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
        headers: { authorization: `Bearer ${tokenBruno}` },
        payload: { piezas: [{ pieza: 16, cara: 'oclusal', estado: 'obturado' }] },
      });
      expect(rOdo2.statusCode).toBe(200);

      const hcFinal = (
        await app.inject({
          method: 'GET',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/historia`,
          headers: { authorization: `Bearer ${tokenBruno}` },
        })
      ).json() as Array<{ id: string; profesionalId: string; corrigeAId?: string }>;
      expect(hcFinal.map((e) => e.profesionalId)).toEqual([
        SEED.profesionales.anaPerez.id,
        SEED.profesionales.brunoGomez.id,
      ]);
      expect(hcFinal[1]?.corrigeAId).toBe(e1.id);

      const odoFinal = (
        await app.inject({
          method: 'GET',
          url: `/api/pacientes/${SEED.pacientes.uno.id}/odontograma`,
          headers: { authorization: `Bearer ${tokenBruno}` },
        })
      ).json() as {
        piezas: Array<{ pieza: number; cara?: string; estado: string; registradoPor: string }>;
        historial: Array<{ estado: string; registradoPor: string; fecha: string }>;
      };
      expect(odoFinal.piezas).toHaveLength(1);
      expect(odoFinal.piezas[0]).toMatchObject({
        pieza: 16,
        cara: 'oclusal',
        estado: 'obturado',
        registradoPor: SEED.profesionales.brunoGomez.id,
      });
      expect(odoFinal.historial.map((h) => ({ estado: h.estado, registradoPor: h.registradoPor, fecha: h.fecha }))).toEqual([
        { estado: 'caries', registradoPor: SEED.profesionales.anaPerez.id, fecha: T1 },
        { estado: 'obturado', registradoPor: SEED.profesionales.brunoGomez.id, fecha: T2 },
      ]);
    });
  });
});
