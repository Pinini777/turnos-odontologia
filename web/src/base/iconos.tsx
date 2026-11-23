/**
 * Íconos SVG de línea fina (stroke 1.75, estilo Lucide) sin agregar dependencias
 * externas al package.json congelado tras C-01 (Regla Dura 3).
 */
export type NombreIcono =
  | 'inicio'
  | 'agenda'
  | 'pacientes'
  | 'catalogo'
  | 'horarios'
  | 'ganancias'
  | 'clinica'
  | 'reservar'
  | 'turnos'
  | 'datos'
  | 'box'
  | 'pendientes'
  | 'check'
  | 'plus'
  | 'logout';

export interface PropsIcono {
  readonly nombre: NombreIcono;
  readonly tamano?: number;
  readonly className?: string;
}

export function Icono({ nombre, tamano = 18, className }: PropsIcono) {
  const base = {
    width: tamano,
    height: tamano,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className,
  };

  switch (nombre) {
    case 'inicio':
      return (
        <svg {...base}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'agenda':
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      );
    case 'pacientes':
      return (
        <svg {...base}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'catalogo':
      return (
        <svg {...base}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case 'horarios':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'ganancias':
      return (
        <svg {...base}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M17 7h4v4" />
        </svg>
      );
    case 'clinica':
      return (
        <svg {...base}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M12 11v6M9 14h6" />
        </svg>
      );
    case 'reservar':
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18M12 13v5M9.5 15.5h5" />
        </svg>
      );
    case 'turnos':
      return (
        <svg {...base}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18M9 15.5l2 2 4-4" />
        </svg>
      );
    case 'datos':
      return (
        <svg {...base}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'box':
      return (
        <svg {...base}>
          <path d="M3 21h18M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" />
          <path d="M9 9h6M9 13h6M10 21v-4h4v4" />
        </svg>
      );
    case 'pendientes':
      return (
        <svg {...base}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'check':
      return (
        <svg {...base}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...base}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...base}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      );
  }
}
