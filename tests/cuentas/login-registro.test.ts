import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import { NoAutenticadoError, ReglaDeNegocioError } from '../../src/shared/errores';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import {
  crearAuth,
  crearEmisorJwt,
  crearHasherBcrypt,
} from '../../src/modules/cuentas/adapter';
import { iniciarSesion } from '../../src/modules/cuentas/aplicacion/login';
import { registrarPaciente } from '../../src/modules/cuentas/aplicacion/registro';

const FECHA_BASE = '2026-11-23T10:00:00Z';
const SECRETO = 'secreto-tests-login-registro';

describe('Caso de uso iniciarSesion (Task 3.1)', () => {
  const crearDeps = () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const hasher = crearHasherBcrypt();
    const emisor = crearEmisorJwt(clock, { secret: SECRETO });
    const auth = crearAuth(repos, clock, { secret: SECRETO });
    return { repos, clock, hasher, emisor, auth };
  };

  it('autentica los 3 roles semilla, omite hashPassword y emite token verificable', async () => {
    const { repos, hasher, emisor, auth } = crearDeps();

    const casos = [
      { email: 'profesional@example.com', password: 'profesional-ejemplo', rol: 'profesional' as const },
      { email: 'recepcion@example.com', password: 'recepcion-ejemplo', rol: 'recepcionista' as const },
      { email: 'paciente1@example.com', password: 'paciente-ejemplo', rol: 'paciente' as const },
    ];

    for (const caso of casos) {
      const res = await iniciarSesion({ repos, hasher, emisor }, { email: caso.email, password: caso.password });
      expect(res.usuario.email).toBe(caso.email);
      expect(res.usuario.rol).toBe(caso.rol);
      expect(res.usuario.activo).toBe(true);
      expect('hashPassword' in res.usuario).toBe(false);
      const sesion = await auth.verificar(res.token);
      expect(sesion?.rol).toBe(caso.rol);
    }
  });

  it('normaliza espacios y mayúsculas del email al iniciar sesión', async () => {
    const { repos, hasher, emisor } = crearDeps();
    const res = await iniciarSesion(
      { repos, hasher, emisor },
      { email: '  PROFESIONAL@Example.com  ', password: 'profesional-ejemplo' },
    );
    expect(res.usuario.id).toBe(SEED.usuarios.anaPerez.id);
    expect(res.usuario.email).toBe('profesional@example.com');
  });

  it('lanza NoAutenticadoError uniforme ante email inexistente, contraseña incorrecta o usuario inactivo', async () => {
    const { repos, hasher, emisor } = crearDeps();

    await expect(
      iniciarSesion({ repos, hasher, emisor }, { email: 'noexiste@example.com', password: 'profesional-ejemplo' }),
    ).rejects.toBeInstanceOf(NoAutenticadoError);

    await expect(
      iniciarSesion({ repos, hasher, emisor }, { email: 'profesional@example.com', password: 'clave-incorrecta' }),
    ).rejects.toBeInstanceOf(NoAutenticadoError);

    await repos.usuarios.guardar({ ...SEED.usuarios.recepcion, activo: false });
    await expect(
      iniciarSesion({ repos, hasher, emisor }, { email: 'recepcion@example.com', password: 'recepcion-ejemplo' }),
    ).rejects.toBeInstanceOf(NoAutenticadoError);
  });
});

describe('Caso de uso registrarPaciente (Task 3.2)', () => {
  const crearDeps = () => {
    const repos = crearRepositoriosEnMemoria();
    const clock = new FixedClock(FECHA_BASE);
    const hasher = crearHasherBcrypt();
    const emisor = crearEmisorJwt(clock, { secret: SECRETO });
    const auth = crearAuth(repos, clock, { secret: SECRETO });
    return { repos, clock, hasher, emisor, auth };
  };

  it('crea un paciente nuevo + usuario con hash bcrypt, sin hashPassword en respuesta y con token válido', async () => {
    const { repos, hasher, emisor, auth } = crearDeps();

    const res = await registrarPaciente(
      { repos, hasher, emisor },
      {
        nombre: 'Paciente',
        apellido: 'Ficticio Tres',
        documento: ' 00000003 ',
        email: '  PACIENTE3@Example.com ',
        password: 'clave-segura-ficticia',
        telefono: '0000-000003',
      },
    );

    expect(res.usuario.rol).toBe('paciente');
    expect(res.usuario.email).toBe('paciente3@example.com');
    expect(res.usuario.activo).toBe(true);
    expect('hashPassword' in res.usuario).toBe(false);
    expect(res.paciente.usuarioId).toBe(res.usuario.id);
    expect(res.paciente.documento).toBe('00000003');
    expect(res.paciente.email).toBe('paciente3@example.com');
    expect(res.paciente.telefono).toBe('0000-000003');

    const guardado = await repos.usuarios.buscarPorId(res.usuario.id);
    expect(guardado?.hashPassword).toMatch(/^\$2[ab]\$10\$/);
    expect(guardado?.hashPassword).not.toContain('clave-segura-ficticia');

    const sesion = await auth.verificar(res.token);
    expect(sesion).toEqual({
      usuarioId: res.usuario.id,
      rol: 'paciente',
      pacienteId: res.paciente.id,
    });
  });

  it('vincula paciente preexistente sin cuenta (SEED.pacientes.dos) preservando su id y teléfono previo', async () => {
    const { repos, hasher, emisor, auth } = crearDeps();
    await repos.pacientes.guardar({ ...SEED.pacientes.dos, telefono: '0000-000002' });

    const res = await registrarPaciente(
      { repos, hasher, emisor },
      {
        nombre: 'Paciente',
        apellido: 'Ficticio Dos',
        documento: '00000002',
        email: '  PACIENTE2@example.com ',
        password: 'clave-vinculada-ficticia',
        obraSocial: 'Obra Social Ficticia',
      },
    );

    expect(res.paciente.id).toBe(SEED.pacientes.dos.id);
    expect(res.paciente.usuarioId).toBe(res.usuario.id);
    expect(res.paciente.telefono).toBe('0000-000002');
    expect(res.paciente.obraSocial).toBe('Obra Social Ficticia');

    const sesion = await auth.verificar(res.token);
    expect(sesion).toEqual({
      usuarioId: res.usuario.id,
      rol: 'paciente',
      pacienteId: SEED.pacientes.dos.id,
    });
  });

  it('rechaza con DUPLICADO cuando el email ya pertenece a un usuario, la ficha ya está vinculada o hay colisión cruzada', async () => {
    const { repos, hasher, emisor } = crearDeps();

    // Email ya en usuarios (personal)
    await expect(
      registrarPaciente(
        { repos, hasher, emisor },
        {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000091',
          email: 'profesional@example.com',
          password: 'clave-ficticia-valida',
        },
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    // Ficha ya vinculada (SEED.pacientes.uno)
    await expect(
      registrarPaciente(
        { repos, hasher, emisor },
        {
          nombre: 'Paciente',
          apellido: 'Ficticio Uno',
          documento: '00000001',
          email: 'paciente1@example.com',
          password: 'clave-ficticia-valida',
        },
      ),
    ).rejects.toBeInstanceOf(ReglaDeNegocioError);

    // Mismo documento con distinto email
    await expect(
      registrarPaciente(
        { repos, hasher, emisor },
        {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000002',
          email: 'otro@example.com',
          password: 'clave-ficticia-valida',
        },
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    // Mismo email con distinto documento
    await expect(
      registrarPaciente(
        { repos, hasher, emisor },
        {
          nombre: 'Paciente',
          apellido: 'Ficticio',
          documento: '00000099',
          email: 'paciente2@example.com',
          password: 'clave-ficticia-valida',
        },
      ),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
  });
});
