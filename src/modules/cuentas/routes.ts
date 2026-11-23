import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRol, sesionDe } from '../../shared/sesion';
import { crearEmisorJwt, crearHasherBcrypt } from './adapter';
import { iniciarSesion } from './aplicacion/login';
import {
  actualizarDatosPropios,
  actualizarPaciente,
  crearPaciente,
  listarPacientes,
  obtenerDatosPropios,
} from './aplicacion/pacientes';
import { registrarPaciente } from './aplicacion/registro';

const esquemaIdParam = z.object({
  id: z.string().trim().min(1),
});

const esquemaLogin = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const esquemaPasswordRegistro = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((val) => Buffer.byteLength(val, 'utf8') <= 72, {
    message: 'La contraseña no puede superar los 72 bytes en UTF-8',
  });

const esquemaRegistroPaciente = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  documento: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: esquemaPasswordRegistro,
  telefono: z.string().trim().min(1).optional(),
  obraSocial: z.string().trim().min(1).optional(),
  plan: z.string().trim().min(1).optional(),
  nroAfiliado: z.string().trim().min(1).optional(),
});

const esquemaCrearPaciente = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  documento: z.string().trim().min(1),
  email: z.string().trim().email(),
  telefono: z.string().trim().min(1).optional(),
  obraSocial: z.string().trim().min(1).optional(),
  plan: z.string().trim().min(1).optional(),
  nroAfiliado: z.string().trim().min(1).optional(),
});

const esquemaActualizarPaciente = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    apellido: z.string().trim().min(1).optional(),
    documento: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    telefono: z.string().trim().min(1).optional(),
    obraSocial: z.string().trim().min(1).optional(),
    plan: z.string().trim().min(1).optional(),
    nroAfiliado: z.string().trim().min(1).optional(),
  })
  .strict();

const esquemaActualizarDatosPropios = z
  .object({
    nombre: z.string().trim().min(1).optional(),
    apellido: z.string().trim().min(1).optional(),
    telefono: z.string().trim().min(1).optional(),
    obraSocial: z.string().trim().min(1).optional(),
    plan: z.string().trim().min(1).optional(),
    nroAfiliado: z.string().trim().min(1).optional(),
  })
  .strict();

export default async function cuentasRoutes(app: FastifyInstance): Promise<void> {
  const hasher = crearHasherBcrypt();
  const emisor = crearEmisorJwt(app.deps.clock);

  app.post('/public/login', async (request) => {
    const entrada = esquemaLogin.parse(request.body);
    return iniciarSesion({ repos: app.deps.repos, hasher, emisor }, entrada);
  });

  app.post('/public/pacientes/registro', async (request, reply) => {
    const entrada = esquemaRegistroPaciente.parse(request.body);
    const resultado = await registrarPaciente(
      { repos: app.deps.repos, hasher, emisor, conLockDeAgenda: app.deps.conLockDeAgenda },
      entrada,
    );
    return reply.status(201).send(resultado);
  });

  app.get(
    '/pacientes',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async () => listarPacientes(app.deps.repos),
  );

  app.post(
    '/pacientes',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async (request, reply) => {
      const entrada = esquemaCrearPaciente.parse(request.body);
      const paciente = await crearPaciente(app.deps.repos, app.deps.conLockDeAgenda, entrada);
      return reply.status(201).send(paciente);
    },
  );

  app.patch(
    '/pacientes/:id',
    { preHandler: requireRol('profesional', 'recepcionista') },
    async (request) => {
      const { id } = esquemaIdParam.parse(request.params);
      const entrada = esquemaActualizarPaciente.parse(request.body);
      return actualizarPaciente(app.deps.repos, app.deps.conLockDeAgenda, id, entrada);
    },
  );

  app.get(
    '/paciente/datos',
    { preHandler: requireRol('paciente') },
    async (request) => obtenerDatosPropios(app.deps.repos, sesionDe(request)),
  );

  app.patch(
    '/paciente/datos',
    { preHandler: requireRol('paciente') },
    async (request) => {
      const entrada = esquemaActualizarDatosPropios.parse(request.body);
      return actualizarDatosPropios(app.deps.repos, sesionDe(request), entrada);
    },
  );
}
