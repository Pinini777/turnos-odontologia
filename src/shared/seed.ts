import type { DiaSemana, HorarioAtencion, Paciente, Prestacion, Profesional, Usuario, Box } from './entidades';
import type { Repositorios } from './repositorios';

/**
 * Datos semilla 100 % ficticios (RN-DA-01). IDs fijos para que los tests de todos los changes los referencien.
 * Los hashes son bcrypt (cost 10) de las contraseñas de ejemplo de .env.example.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const usuarios = {
  anaPerez: { id: id(601), email: 'profesional@example.com', rol: 'profesional', activo: true,
    hashPassword: '$2b$10$nimdkHbOerLt.y4u7/Sqe.VugAAMHP4eHcntQ/zdCy2YXFzuYgWru' },
  brunoGomez: { id: id(602), email: 'profesional2@example.com', rol: 'profesional', activo: true,
    hashPassword: '$2b$10$nimdkHbOerLt.y4u7/Sqe.VugAAMHP4eHcntQ/zdCy2YXFzuYgWru' },
  recepcion: { id: id(603), email: 'recepcion@example.com', rol: 'recepcionista', activo: true,
    hashPassword: '$2b$10$LZl2o2uA1wgxTrJgDF5xTutXnPpxgG.ThPV4jFOMh3G9AKBx5GnJu' },
  paciente1: { id: id(604), email: 'paciente1@example.com', rol: 'paciente', activo: true,
    hashPassword: '$2b$10$fH7M9QuoUTQwczcSJv7brOU5UgaT5qJdk.mpSbYlTfXpcML6ulC5O' },
} satisfies Record<string, Usuario>;

const profesionales = {
  anaPerez: { id: id(101), nombre: 'Dra. Ana Pérez', matricula: 'MP 0001', activo: true, usuarioId: usuarios.anaPerez.id },
  brunoGomez: { id: id(102), nombre: 'Dr. Bruno Gómez', matricula: 'MP 0002', activo: true, usuarioId: usuarios.brunoGomez.id },
} satisfies Record<string, Profesional>;

const boxes = {
  box1: { id: id(201), nombre: 'Box 1', activo: true },
  box2: { id: id(202), nombre: 'Box 2', activo: true },
} satisfies Record<string, Box>;

const prestaciones = {
  consulta: { id: id(301), nombre: 'Consulta', duracionMin: 30, precio: 15000, reservableOnline: true, activa: true },
  limpieza: { id: id(302), nombre: 'Limpieza', duracionMin: 45, precio: 25000, reservableOnline: true, activa: true },
  extraccion: { id: id(303), nombre: 'Extracción simple', duracionMin: 60, precio: 40000, reservableOnline: false, activa: true },
  control: { id: id(304), nombre: 'Control', duracionMin: 15, precio: 10000, reservableOnline: true, activa: true },
} satisfies Record<string, Prestacion>;

const pacientes = {
  uno: { id: id(501), usuarioId: usuarios.paciente1.id, nombre: 'Susanita', apellido: 'Chirusi',
    documento: '00000001', email: 'paciente1@example.com', telefono: '0000-000001', obraSocial: 'Obra Social Ficticia' },
  dos: { id: id(502), nombre: 'Manolito', apellido: 'Goreiro', documento: '00000002', email: 'paciente2@example.com' },
} satisfies Record<string, Paciente>;

const DIAS_HABILES: DiaSemana[] = [1, 2, 3, 4, 5];
const FRANJAS = [['09:00', '13:00'], ['15:00', '19:00']] as const;

const horarios: HorarioAtencion[] = Object.values(profesionales).flatMap((p, iProf) =>
  DIAS_HABILES.flatMap((dia) =>
    FRANJAS.map(([desde, hasta], iFranja) => ({
      id: id(400 + iProf * 100 + dia * 10 + iFranja),
      profesionalId: p.id, diaSemana: dia, desde, hasta,
    })),
  ),
);

export const SEED = { usuarios, profesionales, boxes, prestaciones, pacientes, horarios };

export function cargarSeed(repos: Repositorios): void {
  // EnMemoria.guardar escribe de forma sincrónica antes de su primer await.
  for (const u of Object.values(usuarios)) void repos.usuarios.guardar(u);
  for (const p of Object.values(profesionales)) void repos.profesionales.guardar(p);
  for (const b of Object.values(boxes)) void repos.boxes.guardar(b);
  for (const p of Object.values(prestaciones)) void repos.prestaciones.guardar(p);
  for (const p of Object.values(pacientes)) void repos.pacientes.guardar(p);
  for (const h of horarios) void repos.horarios.guardar(h);
}
