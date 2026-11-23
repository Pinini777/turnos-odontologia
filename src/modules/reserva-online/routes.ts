import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SinPermisoError } from '../../shared/errores';
import { requireRol, sesionDe } from '../../shared/sesion';
import {
  cancelarTurnoPaciente,
  listarTurnosPropios,
  obtenerIcsPropio,
  reprogramarTurnoPaciente,
} from './aplicacion/autogestion-paciente';
import { consultarDisponibilidad } from './aplicacion/disponibilidad';
import {
  reservarTurnoOnline,
  reservarTurnoRecepcion,
  type DatosPacienteInline,
} from './aplicacion/reservar-turno';

const esquemaIdParam = z.object({
  id: z.string().trim().min(1),
});

const esquemaDisponibilidadQuery = z
  .object({
    prestacionId: z.string().trim().min(1),
    desde: z.string().datetime({ offset: true }),
    hasta: z.string().datetime({ offset: true }),
    profesionalId: z.string().trim().min(1).optional(),
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

const esquemaReservaOnline = z.object({
  profesionalId: z.string().trim().min(1),
  prestacionId: z.string().trim().min(1),
  inicio: z.string().datetime({ offset: true }),
  boxId: z.string().trim().min(1).optional(),
});

const esquemaReprogramarPaciente = z.object({
  inicio: z.string().datetime({ offset: true }),
  profesionalId: z.string().trim().min(1).optional(),
  boxId: z.string().trim().min(1).optional(),
});

const esquemaPacienteInline = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  documento: z.string().trim().min(1),
  email: z.string().trim().email(),
  telefono: z.string().trim().min(1).optional(),
  obraSocial: z.string().trim().min(1).optional(),
  plan: z.string().trim().min(1).optional(),
  nroAfiliado: z.string().trim().min(1).optional(),
});

const esquemaReservaRecepcion = z
  .object({
    profesionalId: z.string().trim().min(1),
    prestacionId: z.string().trim().min(1),
    inicio: z.string().datetime({ offset: true }),
    boxId: z.string().trim().min(1).optional(),
    pacienteId: z.string().trim().min(1).optional(),
    paciente: esquemaPacienteInline.optional(),
  })
  .superRefine((datos, ctx) => {
    const tienePacienteId = datos.pacienteId !== undefined;
    const tienePacienteInline = datos.paciente !== undefined;
    if (tienePacienteId === tienePacienteInline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paciente'],
        message: 'Debe informar exactamente uno de pacienteId o paciente',
      });
    }
  });

function pacienteIdDe(request: FastifyRequest): string {
  const { pacienteId } = sesionDe(request);
  if (!pacienteId) {
    throw new SinPermisoError();
  }
  return pacienteId;
}

function normalizarDatosInline(
  paciente: z.infer<typeof esquemaPacienteInline>,
): DatosPacienteInline {
  return {
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    documento: paciente.documento,
    email: paciente.email,
    ...(paciente.telefono !== undefined ? { telefono: paciente.telefono } : {}),
    ...(paciente.obraSocial !== undefined ? { obraSocial: paciente.obraSocial } : {}),
    ...(paciente.plan !== undefined ? { plan: paciente.plan } : {}),
    ...(paciente.nroAfiliado !== undefined ? { nroAfiliado: paciente.nroAfiliado } : {}),
  };
}

function parsearConsultaDisponibilidad(query: unknown, soloReservablesOnline: boolean) {
  const { prestacionId, desde, hasta, profesionalId } = esquemaDisponibilidadQuery.parse(query);
  return {
    prestacionId,
    desde: new Date(desde),
    hasta: new Date(hasta),
    ...(profesionalId !== undefined ? { profesionalId } : {}),
    soloReservablesOnline,
  };
}

/** Rutas HTTP de disponibilidad pública, reserva online, autogestión y registro asistido (C-11). */
export default async function reservaOnlineRoutes(app: FastifyInstance): Promise<void> {
  const soloPaciente = { preHandler: requireRol('paciente') };
  const soloEquipo = { preHandler: requireRol('recepcionista', 'profesional') };

  app.get('/public/disponibilidad', async (request) =>
    consultarDisponibilidad(parsearConsultaDisponibilidad(request.query, true), app.deps),
  );

  app.post('/paciente/turnos', soloPaciente, async (request, reply) => {
    const pacienteId = pacienteIdDe(request);
    const { profesionalId, prestacionId, inicio, boxId } = esquemaReservaOnline.parse(request.body);
    const turno = await reservarTurnoOnline(
      {
        pacienteId,
        profesionalId,
        prestacionId,
        inicio: new Date(inicio),
        ...(boxId !== undefined ? { boxId } : {}),
      },
      app.deps,
    );
    reply.code(201);
    return turno;
  });

  app.get('/paciente/turnos', soloPaciente, async (request) => {
    const pacienteId = pacienteIdDe(request);
    return listarTurnosPropios(pacienteId, app.deps);
  });

  app.get('/paciente/turnos/:id/calendario.ics', soloPaciente, async (request, reply) => {
    const pacienteId = pacienteIdDe(request);
    const { id } = esquemaIdParam.parse(request.params);
    const ics = await obtenerIcsPropio({ turnoId: id, pacienteId }, app.deps);
    reply
      .type('text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="turno-${id}.ics"`);
    return ics;
  });

  app.post('/paciente/turnos/:id/cancelar', soloPaciente, async (request) => {
    const pacienteId = pacienteIdDe(request);
    const { id } = esquemaIdParam.parse(request.params);
    return cancelarTurnoPaciente({ turnoId: id, pacienteId }, app.deps);
  });

  app.patch('/paciente/turnos/:id/reprogramar', soloPaciente, async (request) => {
    const pacienteId = pacienteIdDe(request);
    const { id } = esquemaIdParam.parse(request.params);
    const { inicio, profesionalId, boxId } = esquemaReprogramarPaciente.parse(request.body);
    return reprogramarTurnoPaciente(
      {
        turnoId: id,
        pacienteId,
        cambios: {
          inicio: new Date(inicio),
          ...(profesionalId !== undefined ? { profesionalId } : {}),
          ...(boxId !== undefined ? { boxId } : {}),
        },
      },
      app.deps,
    );
  });

  app.get('/recepcion/disponibilidad', soloEquipo, async (request) =>
    consultarDisponibilidad(parsearConsultaDisponibilidad(request.query, false), app.deps),
  );

  app.post('/recepcion/turnos', soloEquipo, async (request, reply) => {
    const sesion = sesionDe(request);
    const datos = esquemaReservaRecepcion.parse(request.body);
    const base = {
      sesion,
      profesionalId: datos.profesionalId,
      prestacionId: datos.prestacionId,
      inicio: new Date(datos.inicio),
      ...(datos.boxId !== undefined ? { boxId: datos.boxId } : {}),
    };
    const turno =
      datos.pacienteId !== undefined
        ? await reservarTurnoRecepcion({ ...base, pacienteId: datos.pacienteId }, app.deps)
        : await reservarTurnoRecepcion(
            { ...base, paciente: normalizarDatosInline(esquemaPacienteInline.parse(datos.paciente)) },
            app.deps,
          );
    reply.code(201);
    return turno;
  });
}
