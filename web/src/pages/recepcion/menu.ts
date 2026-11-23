import type { ItemMenu } from '../../base/menu';

/**
 * Ítems reales de recepción. Tienen la misma ruta que los placeholders de C-12, así que
 * `obtenerMenuPorRol` los reemplaza vía `itemsExtra` sin editar `base/menu.ts` (design D2).
 */
export const ITEMS_RECEPCION: readonly ItemMenu[] = [
  { etiqueta: 'Agenda del día', ruta: '/recepcion/agenda', icono: 'agenda', roles: ['recepcionista'] },
  { etiqueta: 'Pacientes', ruta: '/recepcion/pacientes', icono: 'pacientes', roles: ['recepcionista'] },
];
