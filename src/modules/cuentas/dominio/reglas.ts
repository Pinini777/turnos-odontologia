import type { Paciente, Usuario } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';

export type UsuarioPublico = Omit<Usuario, 'hashPassword'>;

export interface ExclusionUnicidad {
  usuarioId?: string;
  pacienteId?: string;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizarDocumento(documento: string): string {
  return documento.trim();
}

export function aUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo,
  };
}

export function existeEmailEnUso(
  email: string,
  usuarios: readonly Usuario[],
  pacientes: readonly Paciente[],
  excluir?: ExclusionUnicidad,
): boolean {
  const objetivo = normalizarEmail(email);
  const enUsuarios = usuarios.some(
    (u) => u.id !== excluir?.usuarioId && normalizarEmail(u.email) === objetivo,
  );
  if (enUsuarios) return true;
  return pacientes.some(
    (p) => p.id !== excluir?.pacienteId && normalizarEmail(p.email) === objetivo,
  );
}

export function existeDocumentoEnUso(
  documento: string,
  pacientes: readonly Paciente[],
  excluirPacienteId?: string,
): boolean {
  const objetivo = normalizarDocumento(documento);
  return pacientes.some(
    (p) => p.id !== excluirPacienteId && normalizarDocumento(p.documento) === objetivo,
  );
}

export function validarUnicidadPaciente(params: {
  email?: string;
  documento?: string;
  usuarios: readonly Usuario[];
  pacientes: readonly Paciente[];
  excluir?: ExclusionUnicidad;
}): void {
  if (
    params.email !== undefined &&
    existeEmailEnUso(params.email, params.usuarios, params.pacientes, params.excluir)
  ) {
    throw new ReglaDeNegocioError('DUPLICADO');
  }
  if (
    params.documento !== undefined &&
    existeDocumentoEnUso(params.documento, params.pacientes, params.excluir?.pacienteId)
  ) {
    throw new ReglaDeNegocioError('DUPLICADO');
  }
}
