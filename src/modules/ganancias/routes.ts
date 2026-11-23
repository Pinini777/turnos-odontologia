import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { calcularGanancias } from './aplicacion/calcular-ganancias';

const paramsSchema = z.object({ id: z.string().min(1) });

const querySchema = z
  .object({
    desde: z.string().datetime({ offset: true }),
    hasta: z.string().datetime({ offset: true }),
  })
  .superRefine(({ desde, hasta }, ctx) => {
    if (new Date(desde).getTime() >= new Date(hasta).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasta'],
        message: 'desde debe ser menor que hasta',
      });
    }
  });

/** Ganancias del profesional en un período (C-08, US-040). Solo el dueño las ve (RN-RO-02). */
export default async function ganancias(app: FastifyInstance) {
  app.get(
    '/profesionales/:id/ganancias',
    { preHandler: requireRol('profesional') },
    async (request) => {
      const { id } = paramsSchema.parse(request.params);
      const { desde, hasta } = querySchema.parse(request.query);
      const total = await calcularGanancias(
        {
          sesion: sesionDe(request),
          profesionalId: id,
          desde: new Date(desde),
          hasta: new Date(hasta),
        },
        app.deps,
      );
      return { total };
    },
  );
}
