import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { describirCodigoNegocio, type DetalleErrorCampo } from './errores';
import './styles.css';

export type EstadoTurnoUi = 'reservado' | 'confirmado' | 'atendido' | 'ausente' | 'cancelado';

const ETIQUETA_ESTADO: Readonly<Record<EstadoTurnoUi, string>> = {
  reservado: 'Reservado',
  confirmado: 'Confirmado',
  atendido: 'Atendido',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
};

export function IconoMarca({ tamano = 36 }: { readonly tamano?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={tamano}
      height={tamano}
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="11" fill="#0E7490" />
      <path
        d="M14.2 11.5C11.4 11.5 9.5 13.7 9.5 16.7C9.5 20.6 11.7 23.4 12.6 27.2C13 28.9 14.1 29.8 15.3 29.8C16.6 29.8 17.3 28.6 18 26.2C18.5 24.5 19.1 23.8 20 23.8C20.9 23.8 21.5 24.5 22 26.2C22.7 28.6 23.4 29.8 24.7 29.8C25.9 29.8 27 28.9 27.4 27.2C28.3 23.4 30.5 20.6 30.5 16.7C30.5 13.7 28.6 11.5 25.8 11.5C23.9 11.5 22.3 12.5 20 12.5C17.7 12.5 16.1 11.5 14.2 11.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28.5" cy="11.5" r="3.5" fill="#059669" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  );
}

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  readonly anchoCompleto?: boolean;
  readonly cargando?: boolean;
  readonly textoCargando?: string;
}

export function Boton({
  variante = 'primario',
  anchoCompleto = false,
  cargando = false,
  textoCargando = 'Procesando…',
  disabled,
  className,
  children,
  type = 'button',
  ...resto
}: PropsBoton) {
  const clases = [
    'wb-btn',
    `wb-btn--${variante}`,
    anchoCompleto ? 'wb-btn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={clases} disabled={disabled || cargando} {...resto}>
      {cargando ? textoCargando : children}
    </button>
  );
}

export interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  readonly etiqueta: string;
  readonly ayuda?: string;
  readonly error?: string;
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  id,
  className,
  ...inputProps
}: PropsCampo) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const ayudaId = `${fieldId}-ayuda`;
  const errorId = `${fieldId}-error`;
  const describedBy = [error ? errorId : '', ayuda ? ayudaId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="wb-campo">
      <label htmlFor={fieldId} className="wb-campo__label">
        {etiqueta}
      </label>
      <input
        id={fieldId}
        className={['wb-campo__input', error ? 'wb-campo__input--error' : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? (
        <span id={errorId} className="wb-campo__error" role="alert">
          {error}
        </span>
      ) : null}
      {ayuda ? (
        <span id={ayudaId} className="wb-campo__ayuda">
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}

export interface PropsAlertaErrorNegocio {
  readonly code: string;
  readonly mensaje?: string;
  readonly detalles?: readonly DetalleErrorCampo[];
}

export function AlertaErrorNegocio({ code, mensaje, detalles = [] }: PropsAlertaErrorNegocio) {
  return (
    <div className="wb-alerta" role="alert" aria-live="polite">
      <div className="wb-alerta__encabezado">
        <strong>No se pudo completar la acción</strong>
        <span className="wb-alerta__codigo">{code}</span>
      </div>
      <span>{mensaje ?? describirCodigoNegocio(code)}</span>
      {detalles.length > 0 ? (
        <ul className="wb-alerta__lista">
          {detalles.map((d, idx) => (
            <li key={`${d.campo}-${idx}`}>
              <strong>{d.campo}:</strong> {d.motivo}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BadgeEstadoTurno({ estado }: { readonly estado: EstadoTurnoUi }) {
  return <span className={`wb-badge wb-badge--${estado}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

export interface PropsEstadoVacio {
  readonly titulo: string;
  readonly descripcion: string;
  readonly accion?: ReactNode;
}

export function EstadoVacio({ titulo, descripcion, accion }: PropsEstadoVacio) {
  return (
    <div className="wb-vacio">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4B6370" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round" />
      </svg>
      <h3 className="wb-vacio__titulo">{titulo}</h3>
      <p className="wb-vacio__desc">{descripcion}</p>
      {accion ? <div style={{ marginTop: 'var(--space-2)' }}>{accion}</div> : null}
    </div>
  );
}

export interface ColumnaTabla<T> {
  readonly encabezado: string;
  readonly render: (fila: T) => ReactNode;
}

export interface PropsTabla<T> {
  readonly columnas: readonly ColumnaTabla<T>[];
  readonly filas: readonly T[];
  readonly claveFila: (fila: T) => string;
  readonly vacioTitulo?: string;
  readonly vacioDescripcion?: string;
}

export function Tabla<T>({
  columnas,
  filas,
  claveFila,
  vacioTitulo = 'Sin registros todavía',
  vacioDescripcion = 'Cuando haya información disponible aparecerá en esta tabla.',
}: PropsTabla<T>) {
  if (filas.length === 0) {
    return <EstadoVacio titulo={vacioTitulo} descripcion={vacioDescripcion} />;
  }

  return (
    <div className="wb-tabla-wrap">
      <table className="wb-tabla">
        <thead>
          <tr>
            {columnas.map((col) => (
              <th key={col.encabezado} scope="col">
                {col.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={claveFila(fila)}>
              {columnas.map((col) => (
                <td key={col.encabezado}>{col.render(fila)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
