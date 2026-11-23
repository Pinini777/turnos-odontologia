import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Boton, IconoMarca } from './components';
import { ETIQUETA_ROL, obtenerMenuPorRol, type ItemMenu } from './menu';
import { useSesion } from './sesion';
import './styles.css';

export interface PropsAppLayout {
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly acciones?: ReactNode;
  readonly itemsExtra?: readonly ItemMenu[];
  readonly children: ReactNode;
}

export function AppLayout({
  titulo,
  subtitulo,
  acciones,
  itemsExtra = [],
  children,
}: PropsAppLayout) {
  const { sesion, cerrar } = useSesion();
  const location = useLocation();
  const navigate = useNavigate();

  const items = sesion ? obtenerMenuPorRol(sesion.usuario.rol, itemsExtra) : [];

  function handleCerrarSesion(): void {
    cerrar();
    void navigate('/login', { replace: true });
  }

  return (
    <div className="wb-shell">
      <a href="#contenido-principal" className="wb-skip-link">
        Ir al contenido principal
      </a>

      <aside className="wb-sidebar" aria-label="Navegación del consultorio">
        <Link to="/inicio" className="wb-marca">
          <IconoMarca tamano={34} />
          <span>Consultorio Odontológico</span>
        </Link>

        {sesion ? (
          <div className="wb-rol-box">
            <span className="wb-rol-pill">{ETIQUETA_ROL[sesion.usuario.rol]}</span>
            <span className="wb-rol-email" title={sesion.usuario.email}>
              {sesion.usuario.email}
            </span>
          </div>
        ) : null}

        <nav className="wb-nav" aria-label="Menú principal">
          {items.map((item) => {
            const activo = location.pathname === item.ruta;
            return (
              <Link
                key={item.ruta}
                to={item.proximamente ? '/inicio' : item.ruta}
                className={['wb-nav__item', activo ? 'wb-nav__item--activo' : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={activo ? 'page' : undefined}
              >
                <span>{item.etiqueta}</span>
                {item.proximamente ? <span className="wb-nav__tag">Próx.</span> : null}
              </Link>
            );
          })}
        </nav>

        {sesion ? (
          <Boton variante="secundario" anchoCompleto onClick={handleCerrarSesion}>
            Cerrar sesión
          </Boton>
        ) : null}
      </aside>

      <main id="contenido-principal" className="wb-main">
        <header className="wb-main__header">
          <div>
            <h1 className="wb-main__titulo">{titulo}</h1>
            {subtitulo ? <p className="wb-main__sub">{subtitulo}</p> : null}
          </div>
          {acciones ? <div>{acciones}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
