import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { reprogramarTurno } from './aplicacion/reprogramar-turno';

const params = z.object({ id: z.string().min(1) });
const cuerpo = z.object({
  inicio: z.string().datetime({ offset: true }),
  profesionalId: z.string().min(1).optional(),
  boxId: z.string().min(1).optional(),
});

/** Reprogramar un turno (C-10, US-012). El paciente reprograma por C-11. */
export default async function turnosReprogramacion(app: FastifyInstance) {
  app.patch('/turnos/:id/reprogramar', { preHandler: requireRol('profesional', 'recepcionista') }, async (request) => {
    const { id } = params.parse(request.params);
    const { inicio, profesionalId, boxId } = cuerpo.parse(request.body);
    return reprogramarTurno(
      {
        turnoId: id,
        cambios: {
          inicio: new Date(inicio),
          ...(profesionalId !== undefined ? { profesionalId } : {}),
          ...(boxId !== undefined ? { boxId } : {}),
        },
        actor: sesionDe(request).usuarioId,
      },
      app.deps,
    );
  });
}
