import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify, { type FastifyInstance, type preHandlerAsyncHookHandler } from 'fastify';
import { ZodError } from 'zod';
import { crearAuth } from './modules/cuentas/adapter';
import { crearDisponibilidad } from './modules/configuracion/disponibilidad';
import { crearNotificador } from './modules/notificaciones/adapter';
import { SystemClock } from './shared/clock';
import { NoAutenticadoError, ReglaDeNegocioError, SinPermisoError } from './shared/errores';
import { crearLockDeAgenda } from './shared/lock';
import { sinPrecioPara } from './shared/precios';
import type { Deps } from './shared/puertos';
import { crearRepositoriosEnMemoria } from './shared/repositorios';
import { esRutaPublica } from './shared/sesion';

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
}

export interface BuildAppOptions extends Partial<Deps> {
  /** Carpeta de módulos a cargar; por defecto src/modules. Los tests la reemplazan. */
  modulesDir?: string;
  logger?: boolean;
}

const MODULOS = fileURLToPath(new URL('./modules', import.meta.url));

/** Arma la API. Congelado después de C-01: los módulos se agregan solos desde su carpeta. */
export async function buildApp(opciones: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { modulesDir = MODULOS, logger = false, ...overrides } = opciones;
  const repos = overrides.repos ?? crearRepositoriosEnMemoria();
  const deps: Deps = {
    clock: overrides.clock ?? new SystemClock(),
    repos,
    auth: overrides.auth ?? crearAuth(repos),
    notificador: overrides.notificador ?? crearNotificador(),
    disponibilidad: overrides.disponibilidad ?? crearDisponibilidad(repos),
    conLockDeAgenda: overrides.conLockDeAgenda ?? crearLockDeAgenda(),
  };

  const app = Fastify({ logger });
  app.decorate('deps', deps);

  const autenticar: preHandlerAsyncHookHandler = async (request) => {
    const [tipo, token] = (request.headers.authorization ?? '').split(' ');
    const sesion = tipo === 'Bearer' && token ? await deps.auth.verificar(token) : null;
    if (!sesion) throw new NoAutenticadoError();
    request.sesion = sesion;
  };

  // Por ruta y no global: así una URL inexistente responde 404 y no 401.
  app.addHook('onRoute', (ruta) => {
    if (esRutaPublica(ruta.url)) return;
    const previos = ruta.preHandler === undefined ? [] : [ruta.preHandler].flat();
    ruta.preHandler = [autenticar, ...previos];
  });

  // RN-RO-01 aunque un módulo se olvide: solo el profesional ve precios.
  app.addHook('preSerialization', async (request, _reply, payload) => sinPrecioPara(request.sesion?.rol, payload));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'FORMATO_INVALIDO',
        detalles: error.issues.map((i) => ({ campo: i.path.join('.'), motivo: i.message })),
      });
    }
    if (error instanceof ReglaDeNegocioError) {
      return reply.status(error.code === 'NO_ENCONTRADO' ? 404 : 409).send({ code: error.code });
    }
    if (error instanceof NoAutenticadoError) return reply.status(401).send({ code: 'NO_AUTENTICADO' });
    if (error instanceof SinPermisoError) return reply.status(403).send({ code: 'SIN_PERMISO' });
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status >= 400 && status < 500) return reply.status(status).send({ code: 'FORMATO_INVALIDO', detalles: [] });
    request.log.error(error);
    return reply.status(500).send({ code: 'ERROR_INTERNO' });
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ code: 'NO_ENCONTRADO' }));

  app.get('/api/health', async () => ({ status: 'ok' }));

  for (const plugin of await cargarModulos(modulesDir)) await app.register(plugin, { prefix: '/api' });

  return app;
}

type PluginDeModulo = (app: FastifyInstance) => Promise<void>;

const esPlugin = (v: unknown): v is PluginDeModulo => typeof v === 'function';

/**
 * Registro sin archivo central (DD-13): importa cada <modulesDir>/<modulo>/routes.ts.
 * Se hace a mano y no con @fastify/autoload porque autoload importa con Node nativo y,
 * bajo Vitest, no resuelve los imports de TypeScript sin extensión.
 */
async function cargarModulos(modulesDir: string): Promise<PluginDeModulo[]> {
  const carpetas = (await readdir(modulesDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const plugins: PluginDeModulo[] = [];
  for (const carpeta of carpetas) {
    const archivo = join(modulesDir, carpeta, 'routes.ts');
    if (!existsSync(archivo)) continue;
    const modulo: { default?: unknown } = await import(pathToFileURL(archivo).href);
    if (!esPlugin(modulo.default)) throw new Error(`${archivo} debe exportar por defecto un plugin de Fastify`);
    plugins.push(modulo.default);
  }
  return plugins;
}
