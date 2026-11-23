import { describe, expect, it } from 'vitest';
import type { Paciente, Usuario } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import {
  aUsuarioPublico,
  existeDocumentoEnUso,
  existeEmailEnUso,
  normalizarDocumento,
  normalizarEmail,
  validarUnicidadPaciente,
} from '../../src/modules/cuentas/dominio/reglas';
import {
  combinarPacienteVinculado,
  decidirRegistroPaciente,
} from '../../src/modules/cuentas/dominio/vinculacion';

const usuarioEjemplo: Usuario = {
  id: 'u-1',
  email: 'paciente1@example.com',
  hashPassword: '$2b$10$hash-ficticio-no-exponer',
  rol: 'paciente',
  activo: true,
};

const pacienteEjemplo: Paciente = {
  id: 'p-1',
  usuarioId: 'u-1',
  nombre: 'Paciente',
  apellido: 'Ficticio Uno',
  documento: '00000001',
  email: 'paciente1@example.com',
  telefono: '0000-000001',
};

const pacienteSinCuenta: Paciente = {
  id: 'p-2',
  nombre: 'Paciente',
  apellido: 'Ficticio Dos',
  documento: '00000002',
  email: 'paciente2@example.com',
};

describe('Dominio cuentas — reglas puras (Task 1.1)', () => {
  it('normaliza email recortando espacios y convirtiendo a minúsculas', () => {
    expect(normalizarEmail('  PROFESIONAL@Example.COM  ')).toBe('profesional@example.com');
    expect(normalizarEmail('paciente1@example.com')).toBe('paciente1@example.com');
  });

  it('normaliza documento recortando espacios en los extremos', () => {
    expect(normalizarDocumento('  00000001  ')).toBe('00000001');
    expect(normalizarDocumento('00000002')).toBe('00000002');
  });

  it('proyecta Usuario a UsuarioPublico sin incluir hashPassword', () => {
    const publico = aUsuarioPublico(usuarioEjemplo);
    expect(publico).toEqual({
      id: 'u-1',
      email: 'paciente1@example.com',
      rol: 'paciente',
      activo: true,
    });
    expect('hashPassword' in publico).toBe(false);
  });

  it('detecta email en uso en usuarios o pacientes normalizando mayúsculas/espacios', () => {
    expect(existeEmailEnUso('  PACIENTE1@Example.com ', [usuarioEjemplo], [pacienteEjemplo])).toBe(true);
    expect(existeEmailEnUso('PACIENTE2@example.com', [usuarioEjemplo], [pacienteSinCuenta])).toBe(true);
    expect(existeEmailEnUso('nuevo@example.com', [usuarioEjemplo], [pacienteEjemplo, pacienteSinCuenta])).toBe(false);
  });

  it('excluye al propio paciente y a su usuario vinculado al verificar unicidad en edición', () => {
    expect(
      existeEmailEnUso('paciente1@example.com', [usuarioEjemplo], [pacienteEjemplo, pacienteSinCuenta], {
        pacienteId: 'p-1',
        usuarioId: 'u-1',
      }),
    ).toBe(false);
    expect(
      existeEmailEnUso('paciente2@example.com', [usuarioEjemplo], [pacienteEjemplo, pacienteSinCuenta], {
        pacienteId: 'p-1',
        usuarioId: 'u-1',
      }),
    ).toBe(true);
  });

  it('detecta documento en uso y excluye al propio paciente en edición', () => {
    expect(existeDocumentoEnUso(' 00000001 ', [pacienteEjemplo, pacienteSinCuenta])).toBe(true);
    expect(existeDocumentoEnUso('00000001', [pacienteEjemplo, pacienteSinCuenta], 'p-1')).toBe(false);
    expect(existeDocumentoEnUso('00000002', [pacienteEjemplo, pacienteSinCuenta], 'p-1')).toBe(true);
    expect(existeDocumentoEnUso('00000099', [pacienteEjemplo, pacienteSinCuenta])).toBe(false);
  });

  it('validarUnicidadPaciente lanza ReglaDeNegocioError(DUPLICADO) ante colisión de email o documento', () => {
    expect(() =>
      validarUnicidadPaciente({
        email: 'PACIENTE1@example.com',
        documento: '00000099',
        usuarios: [usuarioEjemplo],
        pacientes: [pacienteEjemplo],
      }),
    ).toThrow(ReglaDeNegocioError);

    try {
      validarUnicidadPaciente({
        email: 'nuevo@example.com',
        documento: ' 00000001 ',
        usuarios: [usuarioEjemplo],
        pacientes: [pacienteEjemplo],
      });
      expect.unreachable('Debió lanzar DUPLICADO');
    } catch (error) {
      expect(error).toBeInstanceOf(ReglaDeNegocioError);
      expect((error as ReglaDeNegocioError).code).toBe('DUPLICADO');
    }

    expect(() =>
      validarUnicidadPaciente({
        email: 'paciente1@example.com',
        documento: '00000001',
        usuarios: [usuarioEjemplo],
        pacientes: [pacienteEjemplo, pacienteSinCuenta],
        excluir: { pacienteId: 'p-1', usuarioId: 'u-1' },
      }),
    ).not.toThrow();
  });
});

describe('Dominio cuentas — matriz de vinculación PA-10 (Task 1.2)', () => {
  const pacientePrevioConTelefono: Paciente = {
    id: 'p-2',
    nombre: 'Paciente',
    apellido: 'Ficticio Dos',
    documento: '00000002',
    email: 'paciente2@example.com',
    telefono: '0000-000002',
  };

  it('caso 1: sin coincidencias en usuarios ni pacientes → crear_nuevo', () => {
    const decision = decidirRegistroPaciente(
      { email: '  NUEVO@example.com ', documento: ' 00000099 ' },
      [usuarioEjemplo],
      [pacienteEjemplo, pacientePrevioConTelefono],
    );
    expect(decision).toEqual({ accion: 'crear_nuevo' });
  });

  it('caso 2: paciente existente con mismo documento y email sin usuarioId → vincular preservando id y campos previos', () => {
    const decision = decidirRegistroPaciente(
      { email: '  PACIENTE2@Example.com ', documento: ' 00000002 ' },
      [usuarioEjemplo],
      [pacienteEjemplo, pacientePrevioConTelefono],
    );
    expect(decision).toEqual({ accion: 'vincular', pacienteExistente: pacientePrevioConTelefono });

    const combinado = combinarPacienteVinculado(pacientePrevioConTelefono, 'u-nuevo', {
      obraSocial: 'Obra Social Ficticia',
      plan: 'Plan A',
    });
    expect(combinado).toEqual({
      id: 'p-2',
      usuarioId: 'u-nuevo',
      nombre: 'Paciente',
      apellido: 'Ficticio Dos',
      documento: '00000002',
      email: 'paciente2@example.com',
      telefono: '0000-000002',
      obraSocial: 'Obra Social Ficticia',
      plan: 'Plan A',
    });
  });

  it('caso 3: email ya existente en usuarios → DUPLICADO', () => {
    const usuarioPersonal: Usuario = {
      id: 'u-prof',
      email: 'profesional@example.com',
      hashPassword: '$2b$10$hash-ficticio',
      rol: 'profesional',
      activo: true,
    };
    expect(() =>
      decidirRegistroPaciente(
        { email: 'PROFESIONAL@example.com', documento: '00000099' },
        [usuarioPersonal],
        [pacienteEjemplo],
      ),
    ).toThrow(ReglaDeNegocioError);
  });

  it('caso 4: paciente con mismo documento y email pero ya vinculado (usuarioId presente) → DUPLICADO', () => {
    expect(() =>
      decidirRegistroPaciente(
        { email: 'paciente1@example.com', documento: '00000001' },
        [],
        [pacienteEjemplo],
      ),
    ).toThrow(ReglaDeNegocioError);
  });

  it('caso 5: paciente con mismo documento y distinto email → DUPLICADO', () => {
    expect(() =>
      decidirRegistroPaciente(
        { email: 'otro@example.com', documento: '00000002' },
        [usuarioEjemplo],
        [pacienteEjemplo, pacientePrevioConTelefono],
      ),
    ).toThrow(ReglaDeNegocioError);
  });

  it('caso 6: paciente con mismo email y distinto documento → DUPLICADO', () => {
    expect(() =>
      decidirRegistroPaciente(
        { email: 'paciente2@example.com', documento: '00000099' },
        [usuarioEjemplo],
        [pacienteEjemplo, pacientePrevioConTelefono],
      ),
    ).toThrow(ReglaDeNegocioError);
  });
});
