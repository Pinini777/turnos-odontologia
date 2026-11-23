import { describe, expect, it } from 'vitest';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import {
  actualizarDatosPropios,
  actualizarPaciente,
  crearPaciente,
  listarPacientes,
  obtenerDatosPropios,
} from '../../src/modules/cuentas/aplicacion/pacientes';

describe('Casos de uso de pacientes para personal (Task 4.1)', () => {
  it('lista todos los pacientes del padrón', async () => {
    const repos = crearRepositoriosEnMemoria();
    const lista = await listarPacientes(repos);
    expect(lista.map((p) => p.id)).toEqual([SEED.pacientes.uno.id, SEED.pacientes.dos.id]);
  });

  it('crea un paciente sin usuarioId normalizando email y documento', async () => {
    const repos = crearRepositoriosEnMemoria();
    const creado = await crearPaciente(repos, {
      nombre: 'Paciente',
      apellido: 'Ficticio Cuatro',
      documento: ' 00000004 ',
      email: '  PACIENTE4@Example.com ',
      telefono: '0000-000004',
      obraSocial: 'Obra Social Ficticia',
    });

    expect(creado.id).toBeTruthy();
    expect(creado.usuarioId).toBeUndefined();
    expect(creado.documento).toBe('00000004');
    expect(creado.email).toBe('paciente4@example.com');
    expect(creado.telefono).toBe('0000-000004');
    expect(await repos.pacientes.buscarPorId(creado.id)).toEqual(creado);
  });

  it('rechaza alta por email duplicado (en pacientes o usuarios) y por documento duplicado', async () => {
    const repos = crearRepositoriosEnMemoria();

    await expect(
      crearPaciente(repos, {
        nombre: 'Paciente',
        apellido: 'Ficticio',
        documento: '00000090',
        email: 'PACIENTE2@example.com',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      crearPaciente(repos, {
        nombre: 'Paciente',
        apellido: 'Ficticio',
        documento: '00000091',
        email: 'recepcion@example.com',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      crearPaciente(repos, {
        nombre: 'Paciente',
        apellido: 'Ficticio',
        documento: ' 00000001 ',
        email: 'libre@example.com',
      }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
  });

  it('actualiza un paciente vinculado y sincroniza el email del usuario asociado', async () => {
    const repos = crearRepositoriosEnMemoria();
    const actualizado = await actualizarPaciente(repos, SEED.pacientes.uno.id, {
      email: '  NUEVO1@Example.com ',
      obraSocial: 'Obra Social Nueva',
    });

    expect(actualizado.email).toBe('nuevo1@example.com');
    expect(actualizado.obraSocial).toBe('Obra Social Nueva');
    const usuario = await repos.usuarios.buscarPorId(SEED.usuarios.paciente1.id);
    expect(usuario?.email).toBe('nuevo1@example.com');
  });

  it('permite reenviar el propio email y documento en actualizarPaciente sin falso DUPLICADO (con y sin usuarioId)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const actualizadoConCuenta = await actualizarPaciente(repos, SEED.pacientes.uno.id, {
      documento: '00000001',
      email: 'PACIENTE1@example.com',
      telefono: '0000-999999',
    });

    expect(actualizadoConCuenta.telefono).toBe('0000-999999');
    expect(actualizadoConCuenta.email).toBe('paciente1@example.com');
    expect(actualizadoConCuenta.documento).toBe('00000001');

    const actualizadoSinCuenta = await actualizarPaciente(repos, SEED.pacientes.dos.id, {
      documento: '00000002',
      email: 'PACIENTE2@example.com',
      telefono: '0000-888888',
    });

    expect(actualizadoSinCuenta.telefono).toBe('0000-888888');
    expect(actualizadoSinCuenta.email).toBe('paciente2@example.com');
    expect(actualizadoSinCuenta.documento).toBe('00000002');
  });

  it('rechaza actualización de paciente inexistente (NO_ENCONTRADO) o con email/documento de otro registro (DUPLICADO)', async () => {
    const repos = crearRepositoriosEnMemoria();

    await expect(
      actualizarPaciente(repos, 'id-inexistente', { telefono: '0000-111111' }),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });

    await expect(
      actualizarPaciente(repos, SEED.pacientes.uno.id, { email: 'paciente2@example.com' }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      actualizarPaciente(repos, SEED.pacientes.uno.id, { email: 'profesional@example.com' }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });

    await expect(
      actualizarPaciente(repos, SEED.pacientes.uno.id, { documento: '00000002' }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
  });
});

describe('Casos de uso de autogestión del propio paciente (Task 4.2)', () => {
  it('devuelve únicamente los datos del paciente asociado a la sesión', async () => {
    const repos = crearRepositoriosEnMemoria();
    const datos = await obtenerDatosPropios(repos, {
      usuarioId: SEED.usuarios.paciente1.id,
      rol: 'paciente',
      pacienteId: SEED.pacientes.uno.id,
    });

    expect(datos).toEqual(SEED.pacientes.uno);
    expect(datos.id).not.toBe(SEED.pacientes.dos.id);
  });

  it('actualiza únicamente los campos editables del propio paciente sin afectar otros pacientes ni campos restringidos', async () => {
    const repos = crearRepositoriosEnMemoria();
    const actualizado = await actualizarDatosPropios(
      repos,
      {
        usuarioId: SEED.usuarios.paciente1.id,
        rol: 'paciente',
        pacienteId: SEED.pacientes.uno.id,
      },
      {
        nombre: '  Paciente Editado  ',
        apellido: '  Ficticio Uno Editado ',
        telefono: '0000-777777',
        obraSocial: 'Obra Social Propia',
        plan: 'Plan 210',
        nroAfiliado: 'AF-0001',
      },
    );

    expect(actualizado).toEqual({
      id: SEED.pacientes.uno.id,
      usuarioId: SEED.usuarios.paciente1.id,
      nombre: 'Paciente Editado',
      apellido: 'Ficticio Uno Editado',
      documento: SEED.pacientes.uno.documento,
      email: SEED.pacientes.uno.email,
      telefono: '0000-777777',
      obraSocial: 'Obra Social Propia',
      plan: 'Plan 210',
      nroAfiliado: 'AF-0001',
    });

    const pacienteDos = await repos.pacientes.buscarPorId(SEED.pacientes.dos.id);
    expect(pacienteDos).toEqual(SEED.pacientes.dos);
  });

  it('lanza NO_ENCONTRADO si la sesión no tiene pacienteId o apunta a un paciente inexistente', async () => {
    const repos = crearRepositoriosEnMemoria();

    await expect(
      obtenerDatosPropios(repos, {
        usuarioId: SEED.usuarios.paciente1.id,
        rol: 'paciente',
      }),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });

    await expect(
      obtenerDatosPropios(repos, {
        usuarioId: SEED.usuarios.paciente1.id,
        rol: 'paciente',
        pacienteId: 'paciente-inexistente',
      }),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });

    await expect(
      actualizarDatosPropios(
        repos,
        {
          usuarioId: SEED.usuarios.paciente1.id,
          rol: 'paciente',
          pacienteId: 'paciente-inexistente',
        },
        { telefono: '0000-000000' },
      ),
    ).rejects.toMatchObject({ code: 'NO_ENCONTRADO' });
  });
});
