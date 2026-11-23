/**
 * Identidad de la clínica odontológica (datos de fantasía realistas, RN-DA-01).
 * Centralizado en un único archivo para actualizarlo fácilmente si cambia la marca.
 */
export const CLINICA = {
  nombre: 'Clínica Dental Alvear',
  subtitulo: 'Centro de salud bucal',
  direccion: 'Av. Alvear 1420, Ciudad de Mendoza',
  horario: 'Lunes a viernes · 08:30 a 19:30',
  telefono: '(0261) 000-0100',
  especialidades: [
    'Odontología general',
    'Ortodoncia',
    'Implantología',
    'Endodoncia',
  ],
  obrasSociales: ['OSDE', 'Swiss Medical', 'OSEP', 'Galeno', 'Particular'],
} as const;
