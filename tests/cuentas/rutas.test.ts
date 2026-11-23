import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import type { Paciente } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { JWT_ISSUER, obtenerSecretoJwt } from '../../src/modules/cuentas/adapter';

const FECHA_BASE = '2026-11-23T10:00:00Z';
const PASS_PROFESIONAL = 'profesional-ejemplo';
const PASS_RECEPCION = 'recepcion-ejemplo';
const PASS_PACIENTE = 'paciente-ejemplo';

function contieneClaveRecursiva(valor: unknown, clave: string): boolean {
  if (valor === null || typeof valor !== 'object') return false;
  if (Array.isArray(valor)) {
    return valor.some((item) => contieneClaveRecursiva(item, clave));
  }
  for (const [k, v] of Object.entries(valor)) {
    if (k === clave || contieneClaveRecursiva(v, clave)) return true;
  }
  return false;
}

describe('Rutas HTTP de cuentas y pacientes (Tasks 5.1 y 5.2)', () => {
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

  async function loginComo(
    app: FastifyInstance,
    email: string,
    password: string,
  ): Promise<{ token: string; usuario: { id: string; email: string; rol: string; activo: boolean } }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/public/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  describe('POST /api/public/login', () => {
    it('autentica los 3 roles semilla sin exponer hashPassword y emite tokens aceptados en rutas protegidas', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });

      const casos = [
        { email: 'profesional@example.com', password: PASS_PROFESIONAL, rol: 'profesional', ruta: '/api/pacientes' },
        { email: 'recepcion@example.com', password: PASS_RECEPCION, rol: 'recepcionista', ruta: '/api/pacientes' },
        { email: 'paciente1@example.com', password: PASS_PACIENTE, rol: 'paciente', ruta: '/api/paciente/datos' },
      ] as const;

      for (const caso of casos) {
        const resLogin = await app.inject({
          method: 'POST',
          url: '/api/public/login',
          payload: { email: caso.email, password: caso.password },
        });
        expect(resLogin.statusCode).toBe(200);
        const body = resLogin.json();
        expect(typeof body.token).toBe('string');
        expect(body.usuario).toMatchObject({ email: caso.email, rol: caso.rol, activo: true });
        expect(contieneClaveRecursiva(body, 'hashPassword')).toBe(false);

        const resProtegida = await app.inject({
          method: 'GET',
          url: caso.ruta,
          headers: { authorization: `Bearer ${body.token}` },
        });
        expect(resProtegida.statusCode).toBe(200);
      }
    });

    it('normaliza el email (recortado y minúsculas) en el login', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const res = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: '  PROFESIONAL@Example.com  ', password: PASS_PROFESIONAL },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.usuario.email).toBe('profesional@example.com');
      expect(contieneClaveRecursiva(body, 'hashPassword')).toBe(false);
    });

    it('responde 401 NO_AUTENTICADO uniforme ante email inexistente, contraseña inválida o usuario inactivo', async () => {
      const repos = crearRepositoriosEnMemoria();
      await repos.usuarios.guardar({ ...SEED.usuarios.brunoGomez, activo: false });
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });

      const intentos = [
        { email: 'noexiste@example.com', password: PASS_PROFESIONAL },
        { email: 'profesional@example.com', password: 'clave-incorrecta' },
        { email: 'profesional2@example.com', password: PASS_PROFESIONAL },
      ];

      for (const payload of intentos) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/public/login',
          payload,
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
      }
    });

    it('responde 400 FORMATO_INVALIDO con detalles ante email mal formado o sin contraseña', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });

      const resEmail = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: 'no-es-email', password: PASS_PROFESIONAL },
      });
      expect(resEmail.statusCode).toBe(400);
      expect(resEmail.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
      expect(resEmail.json().detalles.length).toBeGreaterThan(0);

      const resSinPass = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: 'profesional@example.com' },
      });
      expect(resSinPass.statusCode).toBe(400);
      expect(resSinPass.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
      expect(resSinPass.json().detalles.length).toBeGreaterThan(0);
    });
  });

  describe('Verificación de sesión y expiración con FixedClock', () => {
    it('acepta token en T + 2h - 1s y lo rechaza con 401 NO_AUTENTICADO exactamente en T + 2h', async () => {
      const repos = crearRepositoriosEnMemoria();
      const appEmision = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(appEmision, 'recepcion@example.com', PASS_RECEPCION);

      const appVigente = await crearApp({
        repos,
        clock: new FixedClock('2026-11-23T11:59:59Z'),
      });
      const resVigente = await appVigente.inject({
        method: 'GET',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(resVigente.statusCode).toBe(200);

      const appVencido = await crearApp({
        repos,
        clock: new FixedClock('2026-11-23T12:00:00Z'),
      });
      const resVencido = await appVencido.inject({
        method: 'GET',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(resVencido.statusCode).toBe(401);
      expect(resVencido.json()).toEqual({ code: 'NO_AUTENTICADO' });
    });

    it('rechaza con 401 tokens alterados, mal formados, con algoritmo no permitido o usuario desactivado/inconsistente', async () => {
      const repos = crearRepositoriosEnMemoria();
      const clock = new FixedClock(FECHA_BASE);
      const app = await crearApp({ repos, clock });

      const iat = Math.floor(clock.ahora().getTime() / 1000);
      const tokenOtroSecreto = await new SignJWT({ rol: 'recepcionista' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(SEED.usuarios.recepcion.id)
        .setIssuer(JWT_ISSUER)
        .setIssuedAt(iat)
        .setExpirationTime(iat + 7200)
        .sign(new TextEncoder().encode('otro-secreto-invalido'));

      const tokenAlgInvalido = await new SignJWT({ rol: 'recepcionista' })
        .setProtectedHeader({ alg: 'HS384' })
        .setSubject(SEED.usuarios.recepcion.id)
        .setIssuer(JWT_ISSUER)
        .setIssuedAt(iat)
        .setExpirationTime(iat + 7200)
        .sign(obtenerSecretoJwt());

      const tokenRolInconsistente = await new SignJWT({ rol: 'profesional' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(SEED.usuarios.recepcion.id)
        .setIssuer(JWT_ISSUER)
        .setIssuedAt(iat)
        .setExpirationTime(iat + 7200)
        .sign(obtenerSecretoJwt());

      for (const token of ['malformado', tokenOtroSecreto, tokenAlgInvalido, tokenRolInconsistente]) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/pacientes',
          headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ code: 'NO_AUTENTICADO' });
      }

      const { token: tokenActivo } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);
      await repos.usuarios.guardar({ ...SEED.usuarios.recepcion, activo: false });

      const resDesactivado = await app.inject({
        method: 'GET',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${tokenActivo}` },
      });
      expect(resDesactivado.statusCode).toBe(401);
      expect(resDesactivado.json()).toEqual({ code: 'NO_AUTENTICADO' });
    });
  });

  describe('POST /api/public/pacientes/registro', () => {
    it('registra un paciente nuevo, devuelve 201 sin hashPassword y el token funciona en GET /api/paciente/datos', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const passwordPlano = 'clave-nueva-1234';

      const res = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio Tres',
          documento: ' 00000003 ',
          email: '  PACIENTE3@Example.com ',
          password: passwordPlano,
          telefono: '0000-000003',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(typeof body.token).toBe('string');
      expect(body.usuario).toMatchObject({
        email: 'paciente3@example.com',
        rol: 'paciente',
        activo: true,
      });
      expect(body.paciente).toMatchObject({
        usuarioId: body.usuario.id,
        nombre: 'Paciente',
        apellido: 'Ficticio Tres',
        documento: '00000003',
        email: 'paciente3@example.com',
        telefono: '0000-000003',
      });
      expect(contieneClaveRecursiva(body, 'hashPassword')).toBe(false);

      const usuarioPersistido = await repos.usuarios.buscarPorId(body.usuario.id);
      expect(usuarioPersistido?.hashPassword).not.toBe(passwordPlano);
      expect(usuarioPersistido?.hashPassword).toMatch(/^\$2[ab]\$10\$/);

      const resDatos = await app.inject({
        method: 'GET',
        url: '/api/paciente/datos',
        headers: { authorization: `Bearer ${body.token}` },
      });
      expect(resDatos.statusCode).toBe(200);
      expect(resDatos.json()).toEqual(body.paciente);
    });

    it('vincula ficha preexistente sin cuenta (PA-10) preservando id y teléfono previo cuando se omite', async () => {
      const repos = crearRepositoriosEnMemoria();
      await repos.pacientes.guardar({
        ...SEED.pacientes.dos,
        telefono: '0000-000002',
      });
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });

      const res = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio Dos',
          documento: '00000002',
          email: 'PACIENTE2@example.com',
          password: 'clave-vinculada-123',
          obraSocial: 'Obra Social Ficticia B',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.paciente.id).toBe(SEED.pacientes.dos.id);
      expect(body.paciente.usuarioId).toBe(body.usuario.id);
      expect(body.paciente.obraSocial).toBe('Obra Social Ficticia B');
      expect(body.paciente.telefono).toBe('0000-000002');
      expect(contieneClaveRecursiva(body, 'hashPassword')).toBe(false);

      const resDatos = await app.inject({
        method: 'GET',
        url: '/api/paciente/datos',
        headers: { authorization: `Bearer ${body.token}` },
      });
      expect(resDatos.statusCode).toBe(200);
      expect(resDatos.json().id).toBe(SEED.pacientes.dos.id);
    });

    it('rechaza con 409 DUPLICADO si el email o documento colisionan (usuario existente, ficha vinculada, email/doc cruzados)', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const usuariosAntes = (await repos.usuarios.listar()).length;
      const pacientesAntes = (await repos.pacientes.listar()).length;

      const casos = [
        { documento: '00000090', email: 'recepcion@example.com' },
        { documento: '00000001', email: 'paciente1@example.com' },
        { documento: '00000091', email: 'paciente2@example.com' },
        { documento: '00000002', email: 'otro@example.com' },
      ];

      for (const caso of casos) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/public/pacientes/registro',
          payload: {
            nombre: 'Paciente',
            apellido: 'Ficticio',
            documento: caso.documento,
            email: caso.email,
            password: 'clave-valida-123',
          },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ code: 'DUPLICADO' });
      }

      expect((await repos.usuarios.listar()).length).toBe(usuariosAntes);
      expect((await repos.pacientes.listar()).length).toBe(pacientesAntes);
    });

    it('rechaza contraseña menor a 8 caracteres, mayor a 72 bytes UTF-8 multibyte o email inválido, y acepta exactamente 72 bytes UTF-8', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });

      const resCorta = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000070',
          email: 'corto@example.com',
          password: '1234567',
        },
      });
      expect(resCorta.statusCode).toBe(400);
      expect(resCorta.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

      // 37 veces 'ñ' = 37 caracteres pero 74 bytes UTF-8 (> 72 bytes)
      const resMultibyteExcedido = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000071',
          email: 'multibyte74@example.com',
          password: 'ñ'.repeat(37),
        },
      });
      expect(resMultibyteExcedido.statusCode).toBe(400);
      expect(resMultibyteExcedido.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

      const resEmailInvalido = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000072',
          email: 'email-malo',
          password: 'clave-valida-123',
        },
      });
      expect(resEmailInvalido.statusCode).toBe(400);
      expect(resEmailInvalido.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });

      // 36 veces 'ñ' = exactamente 72 bytes UTF-8 → aceptada
      const resMultibyteValido = await app.inject({
        method: 'POST',
        url: '/api/public/pacientes/registro',
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000073',
          email: 'multibyte72@example.com',
          password: 'ñ'.repeat(36),
        },
      });
      expect(resMultibyteValido.statusCode).toBe(201);
      expect(contieneClaveRecursiva(resMultibyteValido.json(), 'hashPassword')).toBe(false);
    });

    it('crea solo una cuenta cuando llegan dos registros simultáneos con el mismo email', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const usuariosAntes = (await repos.usuarios.listar()).length;
      const pacientesAntes = (await repos.pacientes.listar()).length;

      const peticion = (documento: string) =>
        app.inject({
          method: 'POST',
          url: '/api/public/pacientes/registro',
          payload: {
            nombre: 'Paciente',
            apellido: 'Concurrente',
            documento,
            email: 'concurrente@example.com',
            password: 'clave-valida-123',
          },
        });

      const respuestas = await Promise.all([peticion('00000101'), peticion('00000102')]);
      expect(respuestas.map((res) => res.statusCode).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(respuestas.find((res) => res.statusCode === 409)?.json()).toEqual({ code: 'DUPLICADO' });

      const usuariosConEmail = await repos.usuarios.listar((u) => u.email === 'concurrente@example.com');
      const pacientesConEmail = await repos.pacientes.listar((p) => p.email === 'concurrente@example.com');
      expect(usuariosConEmail).toHaveLength(1);
      expect(pacientesConEmail).toHaveLength(1);
      expect(await repos.usuarios.listar()).toHaveLength(usuariosAntes + 1);
      expect(await repos.pacientes.listar()).toHaveLength(pacientesAntes + 1);
    });
  });

  describe('Gestión de pacientes por personal (GET/POST/PATCH /api/pacientes)', () => {
    it('permite a recepcionista y profesional listar y crear pacientes normalizados sin usuarioId', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token: tokenRecepcion } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);
      const { token: tokenProf } = await loginComo(app, 'profesional@example.com', PASS_PROFESIONAL);

      const resListado = await app.inject({
        method: 'GET',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${tokenRecepcion}` },
      });
      expect(resListado.statusCode).toBe(200);
      const lista = resListado.json() as Paciente[];
      expect(lista.map((p) => p.id)).toEqual([SEED.pacientes.uno.id, SEED.pacientes.dos.id]);
      expect(contieneClaveRecursiva(lista, 'hashPassword')).toBe(false);

      const resAlta = await app.inject({
        method: 'POST',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${tokenProf}` },
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio Cinco',
          documento: ' 00000005 ',
          email: '  PACIENTE5@Example.com ',
          telefono: '0000-000005',
          obraSocial: 'Obra Social Ficticia',
        },
      });
      expect(resAlta.statusCode).toBe(201);
      const creado = resAlta.json();
      expect(creado.email).toBe('paciente5@example.com');
      expect(creado.documento).toBe('00000005');
      expect(creado.usuarioId).toBeUndefined();
      expect(contieneClaveRecursiva(creado, 'hashPassword')).toBe(false);
    });

    it('rechaza alta de paciente con 409 DUPLICADO por email duplicado o por documento duplicado', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);

      const resEmailPaciente = await app.inject({
        method: 'POST',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000080',
          email: 'paciente2@example.com',
        },
      });
      expect(resEmailPaciente.statusCode).toBe(409);
      expect(resEmailPaciente.json()).toEqual({ code: 'DUPLICADO' });

      const resEmailUsuario = await app.inject({
        method: 'POST',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000081',
          email: 'profesional@example.com',
        },
      });
      expect(resEmailUsuario.statusCode).toBe(409);
      expect(resEmailUsuario.json()).toEqual({ code: 'DUPLICADO' });

      const resDocumento = await app.inject({
        method: 'POST',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000001',
          email: 'libre82@example.com',
        },
      });
      expect(resDocumento.statusCode).toBe(409);
      expect(resDocumento.json()).toEqual({ code: 'DUPLICADO' });
    });

    it('crea solo un paciente cuando llegan dos altas simultáneas con el mismo documento', async () => {
      const repos = crearRepositoriosEnMemoria();
      const listarOriginal = repos.pacientes.listar.bind(repos.pacientes);
      repos.pacientes.listar = async (filtro) => {
        const resultado = await listarOriginal(filtro);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return resultado;
      };
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);
      const pacientesAntes = (await repos.pacientes.listar()).length;

      const peticion = (email: string) =>
        app.inject({
          method: 'POST',
          url: '/api/pacientes',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            nombre: 'Paciente',
            apellido: 'Concurrente',
            documento: '00000201',
            email,
          },
        });

      const respuestas = await Promise.all([
        peticion('concurrente-doc-1@example.com'),
        peticion('concurrente-doc-2@example.com'),
      ]);
      expect(respuestas.map((res) => res.statusCode).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(respuestas.find((res) => res.statusCode === 409)?.json()).toEqual({ code: 'DUPLICADO' });

      const pacientesConDoc = await repos.pacientes.listar((p) => p.documento === '00000201');
      expect(pacientesConDoc).toHaveLength(1);
      expect(await repos.pacientes.listar()).toHaveLength(pacientesAntes + 1);
    });

    it('actualiza un paciente vinculado y sincroniza usuario.email verificado en login posterior', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);

      const resPatch = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          email: '  NUEVO-PACIENTE1@Example.com  ',
          obraSocial: 'Obra Social Actualizada',
        },
      });
      expect(resPatch.statusCode).toBe(200);
      expect(resPatch.json()).toMatchObject({
        id: SEED.pacientes.uno.id,
        email: 'nuevo-paciente1@example.com',
        obraSocial: 'Obra Social Actualizada',
      });
      expect(contieneClaveRecursiva(resPatch.json(), 'hashPassword')).toBe(false);

      const resLoginNuevo = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: 'nuevo-paciente1@example.com', password: PASS_PACIENTE },
      });
      expect(resLoginNuevo.statusCode).toBe(200);

      const resLoginViejo = await app.inject({
        method: 'POST',
        url: '/api/public/login',
        payload: { email: 'paciente1@example.com', password: PASS_PACIENTE },
      });
      expect(resLoginViejo.statusCode).toBe(401);
      expect(resLoginViejo.json()).toEqual({ code: 'NO_AUTENTICADO' });
    });

    it('permite en PATCH /api/pacientes/:id conservar propio email y documento sin falso 409 DUPLICADO', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'profesional@example.com', PASS_PROFESIONAL);

      const resConCuenta = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          documento: '00000001',
          email: 'paciente1@example.com',
          telefono: '0000-123456',
        },
      });
      expect(resConCuenta.statusCode).toBe(200);
      expect(resConCuenta.json().telefono).toBe('0000-123456');

      const resSinCuenta = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.dos.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          documento: '00000002',
          email: 'paciente2@example.com',
          telefono: '0000-654321',
        },
      });
      expect(resSinCuenta.statusCode).toBe(200);
      expect(resSinCuenta.json().telefono).toBe('0000-654321');
    });

    it('maneja 404 NO_ENCONTRADO, 409 DUPLICADO y 400 FORMATO_INVALIDO (.strict) en PATCH /api/pacientes/:id', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);

      const res404 = await app.inject({
        method: 'PATCH',
        url: '/api/pacientes/inexistente',
        headers: { authorization: `Bearer ${token}` },
        payload: { telefono: '0000-000000' },
      });
      expect(res404.statusCode).toBe(404);
      expect(res404.json()).toEqual({ code: 'NO_ENCONTRADO' });

      const resEmailDup = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'paciente2@example.com' },
      });
      expect(resEmailDup.statusCode).toBe(409);
      expect(resEmailDup.json()).toEqual({ code: 'DUPLICADO' });

      const resEmailUsuarioDup = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'recepcion@example.com' },
      });
      expect(resEmailUsuarioDup.statusCode).toBe(409);
      expect(resEmailUsuarioDup.json()).toEqual({ code: 'DUPLICADO' });

      const resDocDup = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { documento: '00000002' },
      });
      expect(resDocDup.statusCode).toBe(409);
      expect(resDocDup.json()).toEqual({ code: 'DUPLICADO' });

      const resStrict = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { usuarioId: 'otro-id' },
      });
      expect(resStrict.statusCode).toBe(400);
      expect(resStrict.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
    });

    it('serializa dos PATCH /api/pacientes/:id simultáneos que intentan asignar el mismo email a distintos pacientes', async () => {
      const repos = crearRepositoriosEnMemoria();
      const listarOriginal = repos.pacientes.listar.bind(repos.pacientes);
      repos.pacientes.listar = async (filtro) => {
        const resultado = await listarOriginal(filtro);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return resultado;
      };
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);

      const peticion = (id: string) =>
        app.inject({
          method: 'PATCH',
          url: `/api/pacientes/${id}`,
          headers: { authorization: `Bearer ${token}` },
          payload: { email: 'disputado@example.com' },
        });

      const respuestas = await Promise.all([
        peticion(SEED.pacientes.uno.id),
        peticion(SEED.pacientes.dos.id),
      ]);
      expect(respuestas.map((res) => res.statusCode).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(respuestas.find((res) => res.statusCode === 409)?.json()).toEqual({ code: 'DUPLICADO' });

      const pacientesConEmail = await repos.pacientes.listar((p) => p.email === 'disputado@example.com');
      expect(pacientesConEmail).toHaveLength(1);
    });

    it('rechaza con 403 SIN_PERMISO cuando un paciente intenta acceder a /api/pacientes*', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'paciente1@example.com', PASS_PACIENTE);

      const resGet = await app.inject({
        method: 'GET',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(resGet.statusCode).toBe(403);
      expect(resGet.json()).toEqual({ code: 'SIN_PERMISO' });

      const resPost = await app.inject({
        method: 'POST',
        url: '/api/pacientes',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000099',
          email: 'bloqueado@example.com',
        },
      });
      expect(resPost.statusCode).toBe(403);
      expect(resPost.json()).toEqual({ code: 'SIN_PERMISO' });

      const resPatch = await app.inject({
        method: 'PATCH',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { telefono: '0000-000099' },
      });
      expect(resPatch.statusCode).toBe(403);
      expect(resPatch.json()).toEqual({ code: 'SIN_PERMISO' });
    });
  });

  describe('Autogestión aislada del propio paciente (GET/PATCH /api/paciente/datos)', () => {
    it('devuelve solo los datos propios del paciente autenticado y actualiza únicamente los campos editables', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'paciente1@example.com', PASS_PACIENTE);

      const resGet = await app.inject({
        method: 'GET',
        url: '/api/paciente/datos',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(resGet.statusCode).toBe(200);
      expect(resGet.json()).toEqual(SEED.pacientes.uno);
      expect(contieneClaveRecursiva(resGet.json(), 'hashPassword')).toBe(false);

      const resPatch = await app.inject({
        method: 'PATCH',
        url: '/api/paciente/datos',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          telefono: '0000-555555',
          obraSocial: 'Obra Social Propia',
          plan: 'Plan Oro',
          nroAfiliado: 'AF-1001',
        },
      });
      expect(resPatch.statusCode).toBe(200);
      expect(resPatch.json()).toEqual({
        id: SEED.pacientes.uno.id,
        usuarioId: SEED.usuarios.paciente1.id,
        nombre: SEED.pacientes.uno.nombre,
        apellido: SEED.pacientes.uno.apellido,
        documento: SEED.pacientes.uno.documento,
        email: SEED.pacientes.uno.email,
        telefono: '0000-555555',
        obraSocial: 'Obra Social Propia',
        plan: 'Plan Oro',
        nroAfiliado: 'AF-1001',
      });
      expect(contieneClaveRecursiva(resPatch.json(), 'hashPassword')).toBe(false);
      expect(await repos.pacientes.buscarPorId(SEED.pacientes.dos.id)).toEqual(SEED.pacientes.dos);
    });

    it('rechaza con 400 FORMATO_INVALIDO si el paciente intenta modificar documento, email, id o usuarioId', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'paciente1@example.com', PASS_PACIENTE);

      const intentosProhibidos = [
        { documento: '99999999' },
        { email: 'hack@example.com' },
        { id: SEED.pacientes.dos.id },
        { usuarioId: SEED.usuarios.recepcion.id },
      ];

      for (const payload of intentosProhibidos) {
        const res = await app.inject({
          method: 'PATCH',
          url: '/api/paciente/datos',
          headers: { authorization: `Bearer ${token}` },
          payload,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ code: 'FORMATO_INVALIDO' });
      }

      expect(await repos.pacientes.buscarPorId(SEED.pacientes.uno.id)).toEqual(SEED.pacientes.uno);
    });

    it('rechaza con 403 SIN_PERMISO cuando profesional o recepcionista invocan /api/paciente/datos', async () => {
      const app = await crearApp({ clock: new FixedClock(FECHA_BASE) });
      const { token: tokenProf } = await loginComo(app, 'profesional@example.com', PASS_PROFESIONAL);
      const { token: tokenRecep } = await loginComo(app, 'recepcion@example.com', PASS_RECEPCION);

      for (const token of [tokenProf, tokenRecep]) {
        const resGet = await app.inject({
          method: 'GET',
          url: '/api/paciente/datos',
          headers: { authorization: `Bearer ${token}` },
        });
        expect(resGet.statusCode).toBe(403);
        expect(resGet.json()).toEqual({ code: 'SIN_PERMISO' });

        const resPatch = await app.inject({
          method: 'PATCH',
          url: '/api/paciente/datos',
          headers: { authorization: `Bearer ${token}` },
          payload: { telefono: '0000-111111' },
        });
        expect(resPatch.statusCode).toBe(403);
        expect(resPatch.json()).toEqual({ code: 'SIN_PERMISO' });
      }
    });
  });

  describe('Ausencia de borrado físico (D5)', () => {
    it('responde 404 NO_ENCONTRADO ante DELETE /api/pacientes/:id y conserva el paciente', async () => {
      const repos = crearRepositoriosEnMemoria();
      const app = await crearApp({ repos, clock: new FixedClock(FECHA_BASE) });
      const { token } = await loginComo(app, 'profesional@example.com', PASS_PROFESIONAL);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/pacientes/${SEED.pacientes.uno.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ code: 'NO_ENCONTRADO' });
      expect(await repos.pacientes.buscarPorId(SEED.pacientes.uno.id)).toEqual(SEED.pacientes.uno);
    });
  });
});
