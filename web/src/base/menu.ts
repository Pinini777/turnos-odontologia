import type { RolUsuario } from './api';
import type { NombreIcono } from './iconos';

export interface ItemMenu {
  readonly etiqueta: string;
  readonly ruta: string;
  readonly roles: readonly RolUsuario[];
  readonly icono?: NombreIcono;
  readonly proximamente?: boolean;
  /** Identificador de vista previa navegable en la maqueta mientras se integran C-13/14/15. */
  readonly vistaPreview?: string;
}

const MENU_BASE: readonly ItemMenu[] = [
  { etiqueta: 'Inicio', ruta: '/inicio', icono: 'inicio', roles: ['profesional', 'recepcionista', 'paciente'] },
  // Recepción (RN-RO-01: nunca precios ni ganancias)
  { etiqueta: 'Agenda del día', ruta: '/recepcion/agenda', vistaPreview: 'agenda', icono: 'agenda', roles: ['recepcionista'], proximamente: true },
  { etiqueta: 'Pacientes', ruta: '/recepcion/pacientes', vistaPreview: 'pacientes', icono: 'pacientes', roles: ['recepcionista'], proximamente: true },
  // Profesional (único que ve precios, ganancias e historia clínica)
  { etiqueta: 'Agenda', ruta: '/profesional/agenda', vistaPreview: 'agenda', icono: 'agenda', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Catálogo y prestaciones', ruta: '/profesional/catalogo', vistaPreview: 'catalogo', icono: 'catalogo', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Mis horarios y bloqueos', ruta: '/profesional/horarios', vistaPreview: 'horarios', icono: 'horarios', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Mis ganancias', ruta: '/profesional/ganancias', vistaPreview: 'ganancias', icono: 'ganancias', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Historia clínica', ruta: '/profesional/clinica', vistaPreview: 'clinica', icono: 'clinica', roles: ['profesional'], proximamente: true },
  // Paciente (reserva online y autogestión)
  { etiqueta: 'Reservar turno', ruta: '/paciente/reservar', vistaPreview: 'reservar', icono: 'reservar', roles: ['paciente'], proximamente: true },
  { etiqueta: 'Mis turnos', ruta: '/paciente/turnos', vistaPreview: 'turnos', icono: 'turnos', roles: ['paciente'], proximamente: true },
  { etiqueta: 'Mis datos', ruta: '/paciente/datos', vistaPreview: 'datos', icono: 'datos', roles: ['paciente'], proximamente: true },
];

export const ETIQUETA_ROL: Readonly<Record<RolUsuario, string>> = {
  profesional: 'Profesional',
  recepcionista: 'Recepcionista',
  paciente: 'Paciente',
};

/** Destino efectivo del ítem en la navegación (real si el módulo ya está montado, o vista previa). */
export function destinoDeItem(item: ItemMenu): string {
  if (item.proximamente && item.vistaPreview) {
    return `/inicio?vista=${item.vistaPreview}`;
  }
  return item.ruta;
}

/**
 * Construye el menú visible para el rol activo.
 * Las áreas C-13, C-14 y C-15 pueden aportar ítems adicionales que reemplazan los placeholders por ruta.
 */
export function obtenerMenuPorRol(
  rol: RolUsuario,
  extras: readonly ItemMenu[] = [],
): ItemMenu[] {
  const porRuta = new Map<string, ItemMenu>();
  for (const item of MENU_BASE) {
    if (item.roles.includes(rol)) {
      porRuta.set(item.ruta, item);
    }
  }
  for (const item of extras) {
    if (item.roles.includes(rol)) {
      porRuta.set(item.ruta, item);
    }
  }
  return [...porRuta.values()];
}
