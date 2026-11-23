import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { crearTurno } from './aplicacion/crear-turno';

const solicitudTurno = z.object({
  profesionalId: z.string().min(1),
  boxId: z.string().min(1),
  prestacionId: z.string().min(1),
  pacienteId: z.string().min(1),
  inicio: z.string().datetime({ offset: true }),
});

export default async function registrarRutas(app: FastifyInstance): Promise<void> {
  app.post('/turnos', { preHandler: requireRol('profesional', 'recepcionista') }, async (request, reply) => {
    const solicitud = solicitudTurno.parse(request.body);
    const turno = await crearTurno(app.deps, sesionDe(request), solicitud);
    return reply.code(201).send(turno);
  });
}
