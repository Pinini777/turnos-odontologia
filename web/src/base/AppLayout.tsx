import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Boton, IconoMarca } from './components';
import { destinoDeItem, ETIQUETA_ROL, obtenerMenuPorRol, type ItemMenu } from './menu';
import { useSesion } from './sesion';
import './styles.css';

interface GeometriaIndicador {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface PropsAppLayout {
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly acciones?: ReactNode;
  readonly itemsExtra?: readonly ItemMenu[];
  readonly claveVista?: string;
  readonly children: ReactNode;
}

export function AppLayout({
  titulo,
  subtitulo,
  acciones,
  itemsExtra = [],
  claveVista,
  children,
}: PropsAppLayout) {
  const { sesion, cerrar } = useSesion();
  const location = useLocation();
  const navigate = useNavigate();

  const navRef = useRef<HTMLElement | null>(null);
  const activoRef = useRef<HTMLAnchorElement | null>(null);
  const [indicador, setIndicador] = useState<GeometriaIndicador | null>(null);

  const items = sesion ? obtenerMenuPorRol(sesion.usuario.rol, itemsExtra) : [];
  const rutaCompleta = `${location.pathname}${location.search}`;
  const claveTransicion = claveVista ?? rutaCompleta;

  useLayoutEffect(() => {
    const actualizar = () => {
      const el = activoRef.current;
      if (!el || (el.offsetWidth === 0 && el.offsetHeight === 0)) {
        setIndicador(null);
        return;
      }
      setIndicador({
        x: el.offsetLeft,
        y: el.offsetTop,
        ancho: el.offsetWidth,
        alto: el.offsetHeight,
      });
    };

    actualizar();

    if (typeof ResizeObserver === 'undefined' || !navRef.current) return;
    const observer = new ResizeObserver(actualizar);
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, [rutaCompleta, sesion?.usuario.rol, items.length]);

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

        <nav
          ref={navRef}
          className={['wb-nav', indicador ? '' : 'wb-nav--sin-indicador'].filter(Boolean).join(' ')}
          aria-label="Menú principal"
        >
          <span
            className="wb-nav__indicador"
            data-indicador-activo="true"
            aria-hidden="true"
            style={
              indicador
                ? {
                    opacity: 1,
                    width: `${indicador.ancho}px`,
                    height: `${indicador.alto}px`,
                    transform: `translate3d(${indicador.x}px, ${indicador.y}px, 0)`,
                  }
                : { opacity: 0, width: 0, height: 0 }
            }
          />

          {items.map((item) => {
            const destino = destinoDeItem(item);
            const activo = rutaCompleta === destino || (item.ruta === '/inicio' && location.pathname === '/inicio' && location.search === '');
            return (
              <Link
                key={item.ruta}
                ref={activo ? activoRef : undefined}
                to={destino}
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
        <div key={claveTransicion} className="wb-vista-enter">
          <header className="wb-main__header">
            <div>
              <h1 className="wb-main__titulo">{titulo}</h1>
              {subtitulo ? <p className="wb-main__sub">{subtitulo}</p> : null}
            </div>
            {acciones ? <div>{acciones}</div> : null}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
