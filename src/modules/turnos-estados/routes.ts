import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { cambiarEstado, cancelarTurno, ESTADOS_MANUALES } from './aplicacion/cambiar-estado';

const params = z.object({ id: z.string().min(1) });
const cuerpoEstado = z.object({ estado: z.enum(ESTADOS_MANUALES) });

/** Cancelar y cambiar el estado de un turno (C-05, US-011 y US-013). El paciente cancela por C-11. */
export default async function turnosEstados(app: FastifyInstance) {
  const soloEquipo = { preHandler: requireRol('profesional', 'recepcionista') };

  app.post('/turnos/:id/cancelar', soloEquipo, async (request) => {
    const { id } = params.parse(request.params);
    return cancelarTurno({ turnoId: id, actor: sesionDe(request).usuarioId }, app.deps);
  });

  app.post('/turnos/:id/estado', soloEquipo, async (request) => {
    const { id } = params.parse(request.params);
    const { estado } = cuerpoEstado.parse(request.body);
    return cambiarEstado({ turnoId: id, estado, actor: sesionDe(request).usuarioId }, app.deps);
  });
}
