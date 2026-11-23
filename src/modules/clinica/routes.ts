import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { agregarEntradaHistoria, listarHistoriaClinica } from './aplicacion/historia';
import { actualizarOdontograma, obtenerOdontograma } from './aplicacion/odontograma';
import {
  CARAS_PIEZA,
  ESTADOS_DE_PIEZA,
  esEstadoSoloPiezaCompleta,
  esPiezaFdiValida,
  tieneClavesDuplicadas,
  tieneMezclaPiezaCompletaYCara,
} from './dominio/fdi';

const esquemaIdParam = z.object({
  id: z.string().trim().min(1),
});

const esquemaNuevaHistoria = z
  .object({
    texto: z.string().trim().min(1).max(5000),
    turnoId: z.string().trim().min(1).optional(),
    corrigeAId: z.string().trim().min(1).optional(),
  })
  .strict();

const esquemaItemPieza = z
  .object({
    pieza: z.number().int().refine(esPiezaFdiValida, {
      message: 'Código de pieza FDI inválido (válidos: 11–48 y 51–85 sin huecos)',
    }),
    cara: z.enum(CARAS_PIEZA).optional(),
    estado: z.enum(ESTADOS_DE_PIEZA),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.cara !== undefined && esEstadoSoloPiezaCompleta(item.estado)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cara'],
        message: `El estado '${item.estado}' aplica solo a la pieza completa y no admite cara`,
      });
    }
  });

const esquemaActualizarOdontograma = z
  .object({
    piezas: z
      .array(esquemaItemPieza)
      .min(1)
      .max(260)
      .superRefine((items, ctx) => {
        if (tieneClavesDuplicadas(items)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'No se permiten pares (pieza, cara) duplicados en el mismo pedido',
          });
        }
        if (tieneMezclaPiezaCompletaYCara(items)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'No se puede mezclar pieza completa y cara específica para la misma pieza en un mismo pedido',
          });
        }
      }),
  })
  .strict();

export default async function clinicaRoutes(app: FastifyInstance): Promise<void> {
  const soloProfesional = { preHandler: requireRol('profesional') };

  app.get('/pacientes/:id/historia', soloProfesional, async (request) => {
    const { id } = esquemaIdParam.parse(request.params);
    return listarHistoriaClinica(app.deps.repos, id);
  });

  app.post('/pacientes/:id/historia', soloProfesional, async (request, reply) => {
    const { id } = esquemaIdParam.parse(request.params);
    const entrada = esquemaNuevaHistoria.parse(request.body);
    const registro = await agregarEntradaHistoria(
      { repos: app.deps.repos, clock: app.deps.clock },
      sesionDe(request),
      id,
      entrada,
    );
    return reply.status(201).send(registro);
  });

  app.get('/pacientes/:id/odontograma', soloProfesional, async (request) => {
    const { id } = esquemaIdParam.parse(request.params);
    return obtenerOdontograma(app.deps.repos, id);
  });

  app.put('/pacientes/:id/odontograma', soloProfesional, async (request) => {
    const { id } = esquemaIdParam.parse(request.params);
    const entrada = esquemaActualizarOdontograma.parse(request.body);
    return actualizarOdontograma(
      {
        repos: app.deps.repos,
        clock: app.deps.clock,
        conLockDeAgenda: app.deps.conLockDeAgenda,
      },
      sesionDe(request),
      id,
      entrada,
    );
  });
}
