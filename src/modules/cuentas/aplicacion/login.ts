import { NoAutenticadoError } from '../../../shared/errores';
import type { Repositorios } from '../../../shared/repositorios';
import type { EmisorToken, HasherPassword } from '../adapter';
import { aUsuarioPublico, normalizarEmail, type UsuarioPublico } from '../dominio/reglas';

export interface DepsLogin {
  repos: Repositorios;
  hasher: HasherPassword;
  emisor: EmisorToken;
}

export interface EntradaLogin {
  email: string;
  password: string;
}

export interface ResultadoLogin {
  token: string;
  usuario: UsuarioPublico;
}

export async function iniciarSesion(
  deps: DepsLogin,
  entrada: EntradaLogin,
): Promise<ResultadoLogin> {
  const emailNorm = normalizarEmail(entrada.email);
  const [usuario] = await deps.repos.usuarios.listar((u) => normalizarEmail(u.email) === emailNorm);
  if (!usuario || !usuario.activo) {
    throw new NoAutenticadoError();
  }

  const coincide = await deps.hasher.comparar(entrada.password, usuario.hashPassword);
  if (!coincide) {
    throw new NoAutenticadoError();
  }

  const token = await deps.emisor.emitir({ usuarioId: usuario.id, rol: usuario.rol });
  return { token, usuario: aUsuarioPublico(usuario) };
}
