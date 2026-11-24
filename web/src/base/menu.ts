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
  { etiqueta: 'Agenda del día', ruta: '/recepcion/agenda', icono: 'agenda', roles: ['recepcionista'] },
  { etiqueta: 'Pacientes', ruta: '/recepcion/pacientes', icono: 'pacientes', roles: ['recepcionista'] },
  // Profesional (único que ve precios, ganancias e historia clínica)
  { etiqueta: 'Agenda', ruta: '/profesional/agenda', icono: 'agenda', roles: ['profesional'] },
  { etiqueta: 'Catálogo y prestaciones', ruta: '/profesional/catalogo', icono: 'catalogo', roles: ['profesional'] },
  { etiqueta: 'Mis horarios y bloqueos', ruta: '/profesional/horarios', icono: 'horarios', roles: ['profesional'] },
  { etiqueta: 'Mis ganancias', ruta: '/profesional/ganancias', icono: 'ganancias', roles: ['profesional'] },
  { etiqueta: 'Historia clínica', ruta: '/profesional/clinica', icono: 'clinica', roles: ['profesional'] },
  // Paciente (reserva online y autogestión)
  { etiqueta: 'Reservar turno', ruta: '/paciente/reservar', icono: 'reservar', roles: ['paciente'] },
  { etiqueta: 'Mis turnos', ruta: '/paciente/turnos', icono: 'turnos', roles: ['paciente'] },
  { etiqueta: 'Mis datos', ruta: '/paciente/datos', icono: 'datos', roles: ['paciente'] },
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
