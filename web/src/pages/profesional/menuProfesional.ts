import type { ItemMenu } from '../../base/menu';

/**
 * Ítems de navegación habilitados del área profesional (C-15).
 * Se pasa como `itemsExtra` a `AppLayout` sin editar `web/src/base/menu.ts`.
 */
export const MENU_PROFESIONAL: readonly ItemMenu[] = [
  { etiqueta: 'Agenda', ruta: '/profesional/agenda', icono: 'agenda', roles: ['profesional'] },
  {
    etiqueta: 'Catálogo y prestaciones',
    ruta: '/profesional/catalogo',
    icono: 'catalogo',
    roles: ['profesional'],
  },
  {
    etiqueta: 'Mis horarios y bloqueos',
    ruta: '/profesional/horarios',
    icono: 'horarios',
    roles: ['profesional'],
  },
  {
    etiqueta: 'Mis ganancias',
    ruta: '/profesional/ganancias',
    icono: 'ganancias',
    roles: ['profesional'],
  },
  {
    etiqueta: 'Historia clínica',
    ruta: '/profesional/clinica',
    icono: 'clinica',
    roles: ['profesional'],
  },
];
