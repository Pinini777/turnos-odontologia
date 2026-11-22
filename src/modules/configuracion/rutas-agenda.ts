import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DiaSemana } from '../../shared/entidades';
import { requireRol, sesionDe } from '../../shared/sesion';
import {
  crearBloqueo,
  eliminarBloqueo,
  listarBloqueos,
  type CrearBloqueoInput,
} from './aplicacion/bloqueos';
import {
  listarHorariosProfesional,
  reemplazarHorariosProfesional,
} from './aplicacion/horarios';

const DIAS_VALIDOS: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 7];

function aDiaSemana(n: number): DiaSemana {
  const dia = DIAS_VALIDOS.find((d) => d === n);
  if (dia === undefined) {
    throw new Error(`Día de semana fuera de rango: ${String(n)}`);
  }
  return dia;
}

const idParamSchema = z.object({
  id: z.string().min(1),
});

const REGEX_HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const franjaHorarioSchema = z
  .object({
    diaSemana: z.number().int().min(1).max(7).transform(aDiaSemana),
    desde: z.string().regex(REGEX_HORA_HHMM, 'Formato HH:mm inválido'),
    hasta: z.string().regex(REGEX_HORA_HHMM, 'Formato HH:mm inválido'),
  })
  .refine((h) => h.desde < h.hasta, {
    path: ['hasta'],
    message: 'desde debe ser menor que hasta',
  });

const reemplazarHorariosBodySchema = z.object({
  horarios: z.array(franjaHorarioSchema),
});

const filtroBloqueosQuerySchema = z.object({
  profesionalId: z.string().min(1).optional(),
  boxId: z.string().min(1).optional(),
});

const crearBloqueoBodySchema = z
  .object({
    profesionalId: z.string().trim().min(1).optional(),
    boxId: z.string().trim().min(1).optional(),
    inicio: z.string().datetime({ offset: true }),
    fin: z.string().datetime({ offset: true }),
    motivo: z.string().trim().min(1),
  })
  .superRefine((data, ctx) => {
    const tieneProfesional = data.profesionalId !== undefined;
    const tieneBox = data.boxId !== undefined;
    if (tieneProfesional === tieneBox) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['profesionalId'],
        message: 'Debe indicar exactamente uno de profesionalId o boxId',
      });
    }
    if (new Date(data.inicio).getTime() >= new Date(data.fin).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fin'],
        message: 'inicio debe ser menor que fin',
      });
    }
  });

export async function registrarRutasAgenda(app: FastifyInstance): Promise<void> {
  app.get(
    '/profesionales/:id/horarios',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      return listarHorariosProfesional(app.deps.repos, id);
    },
  );

  app.post(
    '/profesionales/:id/horarios',
    { preHandler: requireRol('profesional') },
    async (request) => {
      const { id } = idParamSchema.parse(request.params);
      const { horarios } = reemplazarHorariosBodySchema.parse(request.body);
      return reemplazarHorariosProfesional(app.deps.repos, sesionDe(request), id, horarios);
    },
  );

  app.get(
    '/bloqueos',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async (request) => {
      const filtros = filtroBloqueosQuerySchema.parse(request.query);
      return listarBloqueos(app.deps.repos, filtros);
    },
  );

  app.post(
    '/bloqueos',
    { preHandler: requireRol('profesional') },
    async (request, reply) => {
      const body = crearBloqueoBodySchema.parse(request.body);
      const inicio = new Date(body.inicio);
      const fin = new Date(body.fin);
      const input: CrearBloqueoInput =
        body.profesionalId !== undefined
          ? { profesionalId: body.profesionalId, inicio, fin, motivo: body.motivo }
          : body.boxId !== undefined
            ? { boxId: body.boxId, inicio, fin, motivo: body.motivo }
            : (() => {
                throw new Error('Invariante XOR violada tras validación Zod');
              })();

      const creado = await crearBloqueo(app.deps.repos, sesionDe(request), input);
      return reply.status(201).send(creado);
    },
  );

  app.delete(
    '/bloqueos/:id',
    { preHandler: requireRol('profesional') },
    async (request, reply) => {
      const { id } = idParamSchema.parse(request.params);
      await eliminarBloqueo(app.deps.repos, sesionDe(request), id);
      return reply.status(204).send();
    },
  );
}
