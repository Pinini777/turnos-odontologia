import { fileURLToPath } from 'node:url';
import type { AuthPort, UsuarioSesion } from '../../src/shared/sesion';
import { SEED } from '../../src/shared/seed';

export const SESIONES: Record<'prof' | 'recep' | 'pac', UsuarioSesion> = {
  prof: { usuarioId: SEED.usuarios.anaPerez.id, rol: 'profesional', profesionalId: SEED.profesionales.anaPerez.id },
  recep: { usuarioId: SEED.usuarios.recepcion.id, rol: 'recepcionista' },
  pac: { usuarioId: SEED.usuarios.paciente1.id, rol: 'paciente', pacienteId: SEED.pacientes.uno.id },
};

const esToken = (t: string): t is keyof typeof SESIONES => t in SESIONES;

/** Acepta los tokens 'prof', 'recep' y 'pac'; cualquier otro es inválido. */
export const authDeTest: AuthPort = {
  async verificar(token) {
    return esToken(token) ? SESIONES[token] : null;
  },
};

export const MODULOS_DE_PRUEBA = fileURLToPath(new URL('./fixtures/modules', import.meta.url));
