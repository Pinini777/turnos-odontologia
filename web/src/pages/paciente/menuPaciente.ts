import type { ItemMenu } from '../../base/menu';

/**
 * Ítems de navegación habilitados del área paciente (C-14).
 * Se pasan como `itemsExtra` a `AppLayout` sin editar `web/src/base/menu.ts`.
 */
export const ITEMS_PACIENTE: readonly ItemMenu[] = [
  { etiqueta: 'Reservar turno', ruta: '/paciente/reservar', icono: 'reservar', roles: ['paciente'] },
  { etiqueta: 'Mis turnos', ruta: '/paciente/turnos', icono: 'turnos', roles: ['paciente'] },
  { etiqueta: 'Mis datos', ruta: '/paciente/datos', icono: 'datos', roles: ['paciente'] },
];
