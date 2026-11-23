import type { RolUsuario } from './api';

export interface ItemMenu {
  readonly etiqueta: string;
  readonly ruta: string;
  readonly roles: readonly RolUsuario[];
  readonly proximamente?: boolean;
  /** Identificador de vista previa navegable en la maqueta de C-12 mientras se integran C-13/14/15. */
  readonly vistaPreview?: string;
}

const MENU_BASE: readonly ItemMenu[] = [
  { etiqueta: 'Inicio', ruta: '/inicio', roles: ['profesional', 'recepcionista', 'paciente'] },
  // Recepción (RN-RO-01: nunca precios ni ganancias)
  { etiqueta: 'Agenda del día', ruta: '/recepcion/agenda', vistaPreview: 'agenda', roles: ['recepcionista'], proximamente: true },
  { etiqueta: 'Pacientes', ruta: '/recepcion/pacientes', vistaPreview: 'pacientes', roles: ['recepcionista'], proximamente: true },
  // Profesional (único que ve precios, ganancias e historia clínica)
  { etiqueta: 'Agenda', ruta: '/profesional/agenda', vistaPreview: 'agenda', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Catálogo y prestaciones', ruta: '/profesional/catalogo', vistaPreview: 'catalogo', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Mis horarios y bloqueos', ruta: '/profesional/horarios', vistaPreview: 'horarios', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Mis ganancias', ruta: '/profesional/ganancias', vistaPreview: 'ganancias', roles: ['profesional'], proximamente: true },
  { etiqueta: 'Historia clínica', ruta: '/profesional/clinica', vistaPreview: 'clinica', roles: ['profesional'], proximamente: true },
  // Paciente (reserva online y autogestión)
  { etiqueta: 'Reservar turno', ruta: '/paciente/reservar', vistaPreview: 'reservar', roles: ['paciente'], proximamente: true },
  { etiqueta: 'Mis turnos', ruta: '/paciente/turnos', vistaPreview: 'turnos', roles: ['paciente'], proximamente: true },
  { etiqueta: 'Mis datos', ruta: '/paciente/datos', vistaPreview: 'datos', roles: ['paciente'], proximamente: true },
];

export const ETIQUETA_ROL: Readonly<Record<RolUsuario, string>> = {
  profesional: 'Profesional',
  recepcionista: 'Recepcionista',
  paciente: 'Paciente',
};

/** Destino efectivo del ítem en la navegación (real si el módulo ya está montado, o vista previa en C-12). */
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
