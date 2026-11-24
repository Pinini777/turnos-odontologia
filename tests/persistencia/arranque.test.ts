import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import { abrirRepositorios } from '../../src/shared/persistencia/arranque';
import { SEED } from '../../src/shared/seed';
import { SEED_DEMO } from '../../src/shared/seed-demo';
import { conBase, TIMEOUT_POSTGRES, type BasePrueba } from './esquema';

const ahora = new Date('2027-01-04T12:00:00Z');
type Api = Awaited<ReturnType<typeof buildApp>>;

async function conApi<T>(usar: (app: Api, apagar: () => Promise<void>) => Promise<T>, url?: string, esquema?: string) {
  const { repos, cerrar } = await abrirRepositorios(url, ahora, esquema);
  let app: Api | undefined;
  let cierre: Promise<void> | undefined;
  const apagar = () => cierre ??= (async () => {
    try {
      await app?.close();
    } finally {
      await cerrar();
    }
  })();
  try {
    app = await buildApp({ repos, clock: new FixedClock(ahora) });
    return await usar(app, apagar);
  } finally {
    await apagar();
  }
}

function entornoSinBase() {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.TEST_DATABASE_URL;
  return env;
}

const pacienteFicticio = (documento: string) => ({
  id: randomUUID(), nombre: 'Paciente Ficticio', apellido: 'Persistencia',
  documento, email: `persistencia-${documento}@example.com`,
});

async function autenticar(app: Api, email: string, password: string, rol: 'profesional' | 'paciente') {
  const respuesta = await app.inject({
    method: 'POST', url: '/api/public/login', payload: { email, password },
  });
  expect(respuesta.statusCode).toBe(200);
  const sesion = respuesta.json<{ token: string; usuario: { rol: string } }>();
  expect(sesion).toMatchObject({ usuario: { rol }, token: expect.stringMatching(/^[^.]+\.[^.]+\.[^.]+$/) });
  return { authorization: `Bearer ${sesion.token}` };
}

it('Falla de conexión configurada', async () => {
  // Una dirección local no disponible permite probar el error sin usar credenciales ni una base real.
  const destino = new URL('postgresql://127.0.0.1:1/postgres');
  destino.username = 'usuario-ficticio';
  destino.password = 'clave-ficticia';
  const resultado = abrirRepositorios(destino.href, ahora, `test_${randomUUID().replaceAll('-', '')}`);

  await expect(resultado).rejects.toThrow(/^No se pudo iniciar PostgreSQL\.$/);
}, 15_000);

it('Arranque y CI sin base', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('TEST_DATABASE_URL', 'no-debe-usarse-para-arrancar');
  try {
    await conApi(async app => {
      const respuesta = await app.inject('/api/health');
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toEqual({ status: 'ok' });
      const santos = SEED_DEMO.pacientes.santos;
      expect(await app.deps.repos.pacientes.buscarPorId(santos.id)).toEqual(santos);
    }, process.env.DATABASE_URL);
  } finally {
    vi.unstubAllEnvs();
  }

  const cli = fileURLToPath(new URL('../../src/shared/persistencia/migrar-cli.ts', import.meta.url));
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', cli], {
    env: entornoSinBase(), encoding: 'utf8', timeout: 10_000,
  });
  expect(resultado.error).toBeUndefined();
  expect(resultado.status).toBe(1);
  expect(resultado.stdout).toBe('');
  expect(resultado.stderr.trim()).toBe('DATABASE_URL no está configurada.');
}, 15_000);

it('Dos instancias independientes', async () => {
  const paciente = pacienteFicticio('00000991');
  await conApi(async primera => {
    await primera.deps.repos.pacientes.guardar(paciente);
    expect(await primera.deps.repos.pacientes.buscarPorId(paciente.id)).toEqual(paciente);

    await conApi(async segunda => {
      expect(await segunda.deps.repos.pacientes.buscarPorId(paciente.id)).toBeUndefined();
      expect(await segunda.deps.repos.pacientes.buscarPorId(SEED.pacientes.uno.id)).toEqual(SEED.pacientes.uno);
    });
  });
});

it('Un test fallido no deja datos en otra instancia de memoria', async () => {
  const paciente = pacienteFicticio('00000992');
  const falla = new Error('Falla explícita después de guardar un paciente ficticio.');
  await expect(conApi(async primera => {
    await primera.deps.repos.pacientes.guardar(paciente);
    expect(await primera.deps.repos.pacientes.buscarPorId(paciente.id)).toEqual(paciente);
    throw falla;
  })).rejects.toBe(falla);

  await conApi(async siguiente => {
    expect(await siguiente.deps.repos.pacientes.buscarPorId(paciente.id)).toBeUndefined();
    expect(await siguiente.deps.repos.pacientes.buscarPorId(SEED.pacientes.uno.id)).toEqual(SEED.pacientes.uno);
  });
});

it('Verificación estándar sin base', () => {
  // Ejecuta el runner real, con un subconjunto para no invocar npm test de forma recursiva.
  const vitest = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
  const resultado = spawnSync(process.execPath, [
    vitest, 'run', 'tests/persistencia/contrato.test.ts', 'tests/persistencia/invariantes.test.ts',
    '--maxWorkers=1', '--reporter=json',
  ], { env: entornoSinBase(), encoding: 'utf8', timeout: 90_000 }); // arranca otro Vitest: en un runner cargado tarda más de 20 s

  expect(resultado.error).toBeUndefined();
  expect(resultado.status).toBe(0);
  const informe = JSON.parse(resultado.stdout) as {
    success: boolean;
    testResults: { assertionResults: { title: string; status: string }[] }[];
  };
  expect(informe.success).toBe(true);
  const tests = informe.testResults.flatMap(archivo => archivo.assertionResults);
  expect(tests.filter(test => test.status === 'passed').map(test => test.title))
    .toEqual(['Contrato común de lectura y escritura']);
  const remotos = tests.filter(test => test.title !== 'Contrato común de lectura y escritura');
  expect(remotos.length).toBeGreaterThan(0);
  // Vitest informa 'pending' para describe.skipIf y 'skipped' para it.skipIf: ninguno se ejecuta.
  for (const test of remotos) expect(['pending', 'skipped']).toContain(test.status);
  expect(remotos.map(test => test.title)).toContain('Suite PostgreSQL habilitada');
}, 100_000);

describe.skipIf(!process.env.TEST_DATABASE_URL)('arranque PostgreSQL', () => {
  let base: BasePrueba | undefined;
  // El primer arranque también puede sembrar la demo completa a través del pooler.
  const timeoutArranque = 120_000;
  beforeAll(async () => { base = await conBase(); }, TIMEOUT_POSTGRES);
  afterAll(async () => { await base?.cerrar(); }, TIMEOUT_POSTGRES);

  function conApiPostgres<T>(usar: (app: Api, apagar: () => Promise<void>) => Promise<T>) {
    if (!base || !process.env.TEST_DATABASE_URL) throw new Error('No se preparó el esquema de arranque.');
    return conApi(usar, process.env.TEST_DATABASE_URL, base.esquema);
  }

  it('Reinicio con persistencia habilitada', async () => {
    const paciente = SEED_DEMO.pacientes.santos;
    expect(`${paciente.nombre} ${paciente.apellido}`).toBe('Mario Santos');
    const loginProfesional = (app: Api) => autenticar(app, SEED.usuarios.anaPerez.email, 'profesional-ejemplo', 'profesional');
    const loginPaciente = (app: Api) => autenticar(app, paciente.email, 'simulador-ejemplo', 'paciente');

    const turno = await conApiPostgres(async app => {
      const headers = await loginProfesional(app);
      await loginPaciente(app);
      const respuesta = await app.inject({
        method: 'POST', url: '/api/turnos', headers,
        payload: {
          profesionalId: SEED.profesionales.anaPerez.id, pacienteId: paciente.id,
          boxId: SEED.boxes.box1.id, prestacionId: SEED.prestaciones.consulta.id,
          inicio: '2027-01-05T13:00:00.000Z',
        },
      });
      expect(respuesta.statusCode).toBe(201);
      const guardado = respuesta.json<{ id: string; estado: string }>();
      expect(guardado).toMatchObject({ id: expect.any(String), estado: 'reservado' });
      return guardado;
    });

    await conApiPostgres(async app => {
      await loginProfesional(app);
      const headers = await loginPaciente(app);
      expect((await app.inject('/api/paciente/turnos')).statusCode).toBe(401);
      const respuesta = await app.inject({ method: 'GET', url: '/api/paciente/turnos', headers });
      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json()).toContainEqual(expect.objectContaining({ id: turno.id, estado: turno.estado }));
    });
  }, timeoutArranque);

  it('Apagado ordenado en PostgreSQL', async () => {
    await conApiPostgres(async (app, apagar) => {
      expect((await app.inject('/api/health')).statusCode).toBe(200);
      const consultar = () => app.deps.repos.pacientes.buscarPorId(SEED.pacientes.uno.id);
      expect(await consultar()).toEqual(SEED.pacientes.uno);

      await apagar();

      await expect(app.inject('/api/health')).rejects.toMatchObject({ code: 'FST_ERR_REOPENED_CLOSE_SERVER' });
      // Con el pool cerrado la consulta falla; el adaptador oculta el detalle del driver a propósito.
      await expect(consultar()).rejects.toThrow('No se pudo completar la operación de persistencia.');
    });
  }, timeoutArranque);

  it('Dos arranques PostgreSQL contra el mismo esquema', async () => {
    const paciente = pacienteFicticio('00000993');
    await conApiPostgres(async app => {
      await app.deps.repos.pacientes.guardar(paciente);
      expect(await app.deps.repos.pacientes.buscarPorId(paciente.id)).toEqual(paciente);
    });

    await conApiPostgres(async app => {
      expect((await app.inject('/api/health')).statusCode).toBe(200);
      expect(await app.deps.repos.pacientes.buscarPorId(paciente.id)).toEqual(paciente);
    });
  }, timeoutArranque);
});
