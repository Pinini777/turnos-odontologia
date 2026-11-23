import { decodeJwt, decodeProtectedHeader, jwtVerify, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import {
  crearAuth,
  crearEmisorJwt,
  crearHasherBcrypt,
  JWT_ALGORITMO,
  JWT_ISSUER,
  JWT_TTL_SEGUNDOS,
  obtenerSecretoJwt,
} from '../../src/modules/cuentas/adapter';

const FECHA_BASE = '2026-11-23T10:00:00Z';

describe('Adaptador cuentas — JWT_SECRET, emisor JWT y hasher bcrypt (Task 2.1)', () => {
  it('resuelve secreto inyectado y rechaza secreto vacío', () => {
    const clave = obtenerSecretoJwt('secreto-de-test-32-bytes-minimo!!');
    expect(clave).toBeInstanceOf(Uint8Array);
    expect(clave.byteLength).toBeGreaterThan(0);
    expect(() => obtenerSecretoJwt('   ')).toThrow();
  });

  it('usa process.env.JWT_SECRET cuando está definido', () => {
    const previo = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'secreto-desde-env-para-test';
      const clave = obtenerSecretoJwt();
      expect(new TextDecoder().decode(clave)).toBe('secreto-desde-env-para-test');
    } finally {
      if (previo === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previo;
    }
  });

  it('lanza error explícito en NODE_ENV=production si falta JWT_SECRET', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => obtenerSecretoJwt()).toThrow(/JWT_SECRET/);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });

  it('fuera de producción sin JWT_SECRET genera una clave efímera de 32 bytes compartida en el proceso', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      const primera = obtenerSecretoJwt();
      const segunda = obtenerSecretoJwt();
      expect(primera.byteLength).toBe(32);
      expect(segunda).toBe(primera);
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevSecret;
    }
  });

  it('emite JWT HS256 con iss turnos-odontologia, TTL 7200 s con Clock y payload mínimo { sub, rol } sin PII', async () => {
    const secreto = 'secreto-aislado-para-emision-jwt';
    const clock = new FixedClock(FECHA_BASE);
    const emisor = crearEmisorJwt(clock, { secret: secreto });

    const token = await emisor.emitir({ usuarioId: SEED.usuarios.anaPerez.id, rol: 'profesional' });

    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe(JWT_ALGORITMO);

    const payload = decodeJwt(token);
    const esperadoIat = Math.floor(new Date(FECHA_BASE).getTime() / 1000);
    expect(payload).toEqual({
      sub: SEED.usuarios.anaPerez.id,
      rol: 'profesional',
      iss: JWT_ISSUER,
      iat: esperadoIat,
      exp: esperadoIat + JWT_TTL_SEGUNDOS,
    });
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'rol', 'sub']);

    const { payload: verificado } = await jwtVerify(token, new TextEncoder().encode(secreto), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      currentDate: clock.ahora(),
    });
    expect(verificado.sub).toBe(SEED.usuarios.anaPerez.id);
  });

  it('hashea contraseñas con bcryptjs cost 10 y verifica correctamente contra los hashes semilla', async () => {
    const hasher = crearHasherBcrypt();
    const hash = await hasher.hash('clave-ficticia-segura');
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(hash).not.toContain('clave-ficticia-segura');
    expect(await hasher.comparar('clave-ficticia-segura', hash)).toBe(true);
    expect(await hasher.comparar('clave-incorrecta', hash)).toBe(false);
    expect(await hasher.comparar('profesional-ejemplo', SEED.usuarios.anaPerez.hashPassword)).toBe(true);
  });
});

describe('Adaptador cuentas — crearAuth (Task 2.2)', () => {
  const SECRETO = 'secreto-aislado-tests-crear-auth';

  it('resuelve sesión completa según el rol (profesional, recepcionista, paciente)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const emisor = crearEmisorJwt(clock, { secret: SECRETO });
    const auth = crearAuth(repos, clock, { secret: SECRETO });

    const tokenProf = await emisor.emitir({ usuarioId: SEED.usuarios.anaPerez.id, rol: 'profesional' });
    const tokenRecep = await emisor.emitir({ usuarioId: SEED.usuarios.recepcion.id, rol: 'recepcionista' });
    const tokenPac = await emisor.emitir({ usuarioId: SEED.usuarios.paciente1.id, rol: 'paciente' });

    expect(await auth.verificar(tokenProf)).toEqual({
      usuarioId: SEED.usuarios.anaPerez.id,
      rol: 'profesional',
      profesionalId: SEED.profesionales.anaPerez.id,
    });
    expect(await auth.verificar(tokenRecep)).toEqual({
      usuarioId: SEED.usuarios.recepcion.id,
      rol: 'recepcionista',
    });
    expect(await auth.verificar(tokenPac)).toEqual({
      usuarioId: SEED.usuarios.paciente1.id,
      rol: 'paciente',
      pacienteId: SEED.pacientes.uno.id,
    });
  });

  it('acepta token en T + 2h - 1s y lo rechaza en el instante exacto T + 2h', async () => {
    const repos = crearRepositoriosEnMemoria();
    const instanteEmision = new Date(FECHA_BASE);
    const emisor = crearEmisorJwt(new FixedClock(instanteEmision), { secret: SECRETO });
    const token = await emisor.emitir({ usuarioId: SEED.usuarios.recepcion.id, rol: 'recepcionista' });

    const unSegundoAntes = new Date(instanteEmision.getTime() + (JWT_TTL_SEGUNDOS - 1) * 1000);
    const authAntes = crearAuth(repos, new FixedClock(unSegundoAntes), { secret: SECRETO });
    expect(await authAntes.verificar(token)).toEqual({
      usuarioId: SEED.usuarios.recepcion.id,
      rol: 'recepcionista',
    });

    const instanteExactoExpiracion = new Date(instanteEmision.getTime() + JWT_TTL_SEGUNDOS * 1000);
    const authEnExpiracion = crearAuth(repos, new FixedClock(instanteExactoExpiracion), { secret: SECRETO });
    expect(await authEnExpiracion.verificar(token)).toBeNull();
  });

  it('rechaza tokens alterados, mal formados, con otro secreto, otro issuer o algoritmo distinto de HS256', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const auth = crearAuth(repos, clock, { secret: SECRETO });

    expect(await auth.verificar('no-es-un-jwt')).toBeNull();

    const otroSecreto = crearEmisorJwt(clock, { secret: 'otro-secreto-distinto' });
    const tokenOtroSecreto = await otroSecreto.emitir({
      usuarioId: SEED.usuarios.recepcion.id,
      rol: 'recepcionista',
    });
    expect(await auth.verificar(tokenOtroSecreto)).toBeNull();

    const iat = Math.floor(clock.ahora().getTime() / 1000);
    const clave = new TextEncoder().encode(SECRETO);

    const tokenHs384 = await new SignJWT({ rol: 'recepcionista' })
      .setProtectedHeader({ alg: 'HS384' })
      .setSubject(SEED.usuarios.recepcion.id)
      .setIssuer(JWT_ISSUER)
      .setIssuedAt(iat)
      .setExpirationTime(iat + JWT_TTL_SEGUNDOS)
      .sign(clave);
    expect(await auth.verificar(tokenHs384)).toBeNull();

    const tokenOtroIssuer = await new SignJWT({ rol: 'recepcionista' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(SEED.usuarios.recepcion.id)
      .setIssuer('otro-emisor')
      .setIssuedAt(iat)
      .setExpirationTime(iat + JWT_TTL_SEGUNDOS)
      .sign(clave);
    expect(await auth.verificar(tokenOtroIssuer)).toBeNull();
  });

  it('rechaza token si el usuario fue desactivado después del login', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const emisor = crearEmisorJwt(clock, { secret: SECRETO });
    const auth = crearAuth(repos, clock, { secret: SECRETO });

    const token = await emisor.emitir({ usuarioId: SEED.usuarios.recepcion.id, rol: 'recepcionista' });
    await repos.usuarios.guardar({ ...SEED.usuarios.recepcion, activo: false });

    expect(await auth.verificar(token)).toBeNull();
  });

  it('rechaza token con rol inconsistente o vínculo profesional/paciente faltante', async () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const emisor = crearEmisorJwt(clock, { secret: SECRETO });
    const auth = crearAuth(repos, clock, { secret: SECRETO });

    const tokenRolFalso = await emisor.emitir({ usuarioId: SEED.usuarios.recepcion.id, rol: 'profesional' });
    expect(await auth.verificar(tokenRolFalso)).toBeNull();

    await repos.usuarios.guardar({
      id: 'u-paciente-huerfano',
      email: 'huerfano@example.com',
      hashPassword: '$2b$10$hash-ficticio',
      rol: 'paciente',
      activo: true,
    });
    const tokenPacHuerfano = await emisor.emitir({ usuarioId: 'u-paciente-huerfano', rol: 'paciente' });
    expect(await auth.verificar(tokenPacHuerfano)).toBeNull();

    await repos.usuarios.guardar({
      id: 'u-prof-huerfano',
      email: 'prof-huerfano@example.com',
      hashPassword: '$2b$10$hash-ficticio',
      rol: 'profesional',
      activo: true,
    });
    const tokenProfHuerfano = await emisor.emitir({ usuarioId: 'u-prof-huerfano', rol: 'profesional' });
    expect(await auth.verificar(tokenProfHuerfano)).toBeNull();
  });
});
