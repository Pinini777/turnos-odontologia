import type { Paciente, Usuario } from '../../../shared/entidades';
import { ReglaDeNegocioError } from '../../../shared/errores';
import { normalizarDocumento, normalizarEmail } from './reglas';

export interface CamposOpcionalesPaciente {
  telefono?: string;
  obraSocial?: string;
  plan?: string;
  nroAfiliado?: string;
}

export type DecisionRegistroPaciente =
  | { accion: 'crear_nuevo' }
  | { accion: 'vincular'; pacienteExistente: Paciente };

export function decidirRegistroPaciente(
  datos: { email: string; documento: string },
  usuarios: readonly Usuario[],
  pacientes: readonly Paciente[],
): DecisionRegistroPaciente {
  const emailNorm = normalizarEmail(datos.email);
  const docNorm = normalizarDocumento(datos.documento);

  if (usuarios.some((u) => normalizarEmail(u.email) === emailNorm)) {
    throw new ReglaDeNegocioError('DUPLICADO');
  }

  const porDocumento = pacientes.find((p) => normalizarDocumento(p.documento) === docNorm);
  const porEmail = pacientes.find((p) => normalizarEmail(p.email) === emailNorm);

  if (!porDocumento && !porEmail) {
    return { accion: 'crear_nuevo' };
  }

  if (
    porDocumento !== undefined &&
    porEmail !== undefined &&
    porDocumento.id === porEmail.id &&
    porDocumento.usuarioId === undefined
  ) {
    return { accion: 'vincular', pacienteExistente: porDocumento };
  }

  throw new ReglaDeNegocioError('DUPLICADO');
}

export function combinarPacienteVinculado(
  existente: Paciente,
  usuarioId: string,
  entrante: CamposOpcionalesPaciente,
): Paciente {
  const resultado: Paciente = {
    ...existente,
    usuarioId,
  };
  if (entrante.telefono !== undefined) resultado.telefono = entrante.telefono;
  if (entrante.obraSocial !== undefined) resultado.obraSocial = entrante.obraSocial;
  if (entrante.plan !== undefined) resultado.plan = entrante.plan;
  if (entrante.nroAfiliado !== undefined) resultado.nroAfiliado = entrante.nroAfiliado;
  return resultado;
}
