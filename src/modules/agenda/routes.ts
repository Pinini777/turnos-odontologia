import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol } from '../../shared/sesion';
import { consultarAgenda } from './aplicacion/consultar-agenda';
import { consultarAuditoria } from './aplicacion/consultar-auditoria';

const querySchema = z
  .object({
    desde: z.string().datetime({ offset: true }),
    hasta: z.string().datetime({ offset: true }),
    profesionalId: z.string().min(1).optional(),
    boxId: z.string().min(1).optional(),
  })
  .superRefine(({ desde, hasta }, ctx) => {
    if (new Date(desde).getTime() >= new Date(hasta).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: 'desde debe ser menor que hasta' });
    }
  });

const paramsSchema = z.object({ id: z.string().min(1) });

/** Agenda y auditoría de solo lectura (C-07). Sin rutas de escritura: otro método cae en el 404 global (D8). */
export default async function agenda(app: FastifyInstance) {
  app.get('/agenda', { preHandler: requireRol('profesional', 'recepcionista') }, async (request) => {
    const { desde, hasta, profesionalId, boxId } = querySchema.parse(request.query);
    return consultarAgenda(
      {
        desde: new Date(desde),
        hasta: new Date(hasta),
        ...(profesionalId === undefined ? {} : { profesionalId }),
        ...(boxId === undefined ? {} : { boxId }),
      },
      app.deps,
    );
  });

  app.get('/turnos/:id/auditoria', { preHandler: requireRol('profesional') }, async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return consultarAuditoria({ turnoId: id }, app.deps);
  });
}
