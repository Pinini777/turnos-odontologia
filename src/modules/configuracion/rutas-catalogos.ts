import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { actualizarBox, crearBox, listarBoxes } from './aplicacion/boxes';
import {
  actualizarPrestacion,
  crearPrestacion,
  listarPrestaciones,
  listarPrestacionesPublicas,
} from './aplicacion/prestaciones';
import {
  actualizarProfesional,
  crearProfesional,
  listarProfesionales,
} from './aplicacion/profesionales';

const esquemaIdParam = z.object({
  id: z.string().trim().min(1),
});

const esquemaCrearProfesional = z.object({
  nombre: z.string().trim().min(1),
  matricula: z.string().trim().min(1),
  usuarioId: z.string().trim().min(1),
});

const esquemaActualizarProfesional = z.object({
  nombre: z.string().trim().min(1).optional(),
  matricula: z.string().trim().min(1).optional(),
  activo: z.boolean().optional(),
});

const esquemaCrearBox = z.object({
  nombre: z.string().trim().min(1),
});

const esquemaActualizarBox = z.object({
  nombre: z.string().trim().min(1).optional(),
  activo: z.boolean().optional(),
});

// duracionMin se valida como número finito en Zod para que <= 0 o no múltiplos de 15 entren a negocio (409 DURACION_INVALIDA).
const esquemaCrearPrestacion = z.object({
  nombre: z.string().trim().min(1),
  duracionMin: z.number().finite(),
  precio: z.number().finite().min(0),
  reservableOnline: z.boolean().default(true),
  activa: z.boolean().default(true),
});

const esquemaActualizarPrestacion = z.object({
  nombre: z.string().trim().min(1).optional(),
  duracionMin: z.number().finite().optional(),
  precio: z.number().finite().min(0).optional(),
  reservableOnline: z.boolean().optional(),
  activa: z.boolean().optional(),
});

export async function registrarRutasCatalogos(app: FastifyInstance): Promise<void> {
  app.get(
    '/profesionales',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async () => listarProfesionales(app.deps.repos),
  );

  app.post(
    '/profesionales',
    { preHandler: requireRol('profesional') },
    async (request, reply) => {
      const datos = esquemaCrearProfesional.parse(request.body);
      const profesional = await crearProfesional(app.deps.repos, datos);
      return reply.status(201).send(profesional);
    },
  );

  app.patch(
    '/profesionales/:id',
    { preHandler: requireRol('profesional') },
    async (request) => {
      const { id } = esquemaIdParam.parse(request.params);
      const datos = esquemaActualizarProfesional.parse(request.body);
      return actualizarProfesional(app.deps.repos, id, datos);
    },
  );

  app.get(
    '/boxes',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async () => listarBoxes(app.deps.repos),
  );

  app.post(
    '/boxes',
    { preHandler: requireRol('profesional') },
    async (request, reply) => {
      const datos = esquemaCrearBox.parse(request.body);
      const box = await crearBox(app.deps.repos, datos);
      return reply.status(201).send(box);
    },
  );

  app.patch(
    '/boxes/:id',
    { preHandler: requireRol('profesional') },
    async (request) => {
      const { id } = esquemaIdParam.parse(request.params);
      const datos = esquemaActualizarBox.parse(request.body);
      return actualizarBox(app.deps.repos, id, datos);
    },
  );

  app.get(
    '/prestaciones',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async (request) => listarPrestaciones(app.deps.repos, sesionDe(request).rol),
  );

  app.post(
    '/prestaciones',
    { preHandler: requireRol('profesional') },
    async (request, reply) => {
      const datos = esquemaCrearPrestacion.parse(request.body);
      const prestacion = await crearPrestacion(app.deps.repos, datos);
      return reply.status(201).send(prestacion);
    },
  );

  app.patch(
    '/prestaciones/:id',
    { preHandler: requireRol('profesional') },
    async (request) => {
      const { id } = esquemaIdParam.parse(request.params);
      const datos = esquemaActualizarPrestacion.parse(request.body);
      return actualizarPrestacion(app.deps.repos, id, datos);
    },
  );

  app.get('/public/prestaciones', async () => listarPrestacionesPublicas(app.deps.repos));
}
