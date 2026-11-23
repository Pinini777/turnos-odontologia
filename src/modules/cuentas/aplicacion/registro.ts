import { randomUUID } from 'node:crypto';
import type { Paciente, Usuario } from '../../../shared/entidades';
import type { Repositorios } from '../../../shared/repositorios';
import type { EmisorToken, HasherPassword } from '../adapter';
import {
  aUsuarioPublico,
  normalizarDocumento,
  normalizarEmail,
  type UsuarioPublico,
} from '../dominio/reglas';
import {
  combinarPacienteVinculado,
  decidirRegistroPaciente,
} from '../dominio/vinculacion';

export interface DepsRegistro {
  repos: Repositorios;
  hasher: HasherPassword;
  emisor: EmisorToken;
  generarId?: () => string;
}

export interface EntradaRegistroPaciente {
  nombre: string;
  apellido: string;
  documento: string;
  email: string;
  password: string;
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export interface ResultadoRegistroPaciente {
  token: string;
  usuario: UsuarioPublico;
  paciente: Paciente;
}

export async function registrarPaciente(
  deps: DepsRegistro,
  entrada: EntradaRegistroPaciente,
): Promise<ResultadoRegistroPaciente> {
  const [usuarios, pacientes] = await Promise.all([
    deps.repos.usuarios.listar(),
    deps.repos.pacientes.listar(),
  ]);

  const decision = decidirRegistroPaciente(
    { email: entrada.email, documento: entrada.documento },
    usuarios,
    pacientes,
  );

  const nuevoId = deps.generarId ?? randomUUID;
  const emailNorm = normalizarEmail(entrada.email);
  const documentoNorm = normalizarDocumento(entrada.documento);
  const hashPassword = await deps.hasher.hash(entrada.password);

  const usuario: Usuario = {
    id: nuevoId(),
    email: emailNorm,
    hashPassword,
    rol: 'paciente',
    activo: true,
  };

  let paciente: Paciente;
  if (decision.accion === 'vincular') {
    paciente = combinarPacienteVinculado(decision.pacienteExistente, usuario.id, {
      telefono: entrada.telefono,
      obraSocial: entrada.obraSocial,
      plan: entrada.plan,
      nroAfiliado: entrada.nroAfiliado,
    });
  } else {
    paciente = {
      id: nuevoId(),
      usuarioId: usuario.id,
      nombre: entrada.nombre.trim(),
      apellido: entrada.apellido.trim(),
      documento: documentoNorm,
      email: emailNorm,
    };
    if (entrada.telefono !== undefined) paciente.telefono = entrada.telefono;
    if (entrada.obraSocial !== undefined) paciente.obraSocial = entrada.obraSocial;
    if (entrada.plan !== undefined) paciente.plan = entrada.plan;
    if (entrada.nroAfiliado !== undefined) paciente.nroAfiliado = entrada.nroAfiliado;
  }

  await deps.repos.usuarios.guardar(usuario);
  await deps.repos.pacientes.guardar(paciente);

  const token = await deps.emisor.emitir({ usuarioId: usuario.id, rol: usuario.rol });
  return { token, usuario: aUsuarioPublico(usuario), paciente };
}
