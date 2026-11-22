import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CODIGOS_NEGOCIO, ReglaDeNegocioError } from '../../../../../src/shared/errores';
import { requireRol, sesionDe } from '../../../../../src/shared/sesion';

const esquemaFormato = z.object({ inicio: z.string().datetime({ offset: true }) });
const esquemaCodigo = z.object({ code: z.enum(CODIGOS_NEGOCIO) });

/** Módulo de prueba: lo carga el autoload solo en los tests de plataforma. */
export default async function eco(app: FastifyInstance) {
  app.get('/eco', async (request) => ({ eco: true, rol: sesionDe(request).rol }));

  app.post('/eco/formato', async (request) => esquemaFormato.parse(request.body));

  app.get('/eco/negocio/:code', async (request) => {
    throw new ReglaDeNegocioError(esquemaCodigo.parse(request.params).code);
  });

  app.get('/eco/falla', async () => {
    throw new Error('detalle-secreto');
  });

  app.get('/eco/solo-profesional', { preHandler: requireRol('profesional') }, async (request) => sesionDe(request));

  app.get('/eco/precios', async () => ({
    prestaciones: [{ nombre: 'Consulta', precio: 15000 }],
    turno: { precioAlReservar: 15000, prestacion: { nombre: 'Consulta', precio: 15000 } },
  }));

  app.get('/eco/reloj', async () => ({ ahora: app.deps.clock.ahora().toISOString() }));
}
