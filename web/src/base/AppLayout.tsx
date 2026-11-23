import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { UsuarioPublico } from './api';
import { CLINICA } from './clinica';
import { AvatarIniciales, Boton, IconoMarca } from './components';
import { Icono } from './iconos';
import { destinoDeItem, ETIQUETA_ROL, obtenerMenuPorRol, type ItemMenu } from './menu';
import { useSesion } from './sesion';
import './styles.css';

interface GeometriaIndicador {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

function nombreVisibleDeUsuario(usuario: UsuarioPublico): string {
  const email = usuario.email.toLowerCase();
  if (usuario.rol === 'profesional') {
    return email.includes('profesional2') ? 'Dr. Bruno Gómez' : 'Dra. Ana Pérez';
  }
  if (usuario.rol === 'recepcionista') {
    return 'Recepción Alvear';
  }
  if (email === 'paciente1@example.com') {
    return 'Lucía Fernández';
  }
  const parteLocal = usuario.email.split('@')[0] ?? 'Paciente';
  return parteLocal.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
  const nombrePerfil = sesion ? nombreVisibleDeUsuario(sesion.usuario) : '';

  useEffect(() => {
    document.title = `${titulo} — ${CLINICA.nombre}`;
  }, [titulo]);

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

      <aside className="wb-sidebar" aria-label="Navegación de la clínica">
        <Link to="/inicio" className="wb-marca">
          <IconoMarca tamano={34} />
          <span className="wb-marca__texto">
            <span>{CLINICA.nombre}</span>
            <span className="wb-marca__sub">{CLINICA.subtitulo}</span>
          </span>
        </Link>

        {sesion ? (
          <div className="wb-rol-box">
            <div className="wb-rol-perfil">
              <AvatarIniciales nombre={nombrePerfil} tamano="md" />
              <div className="wb-rol-perfil__info">
                <span className="wb-rol-nombre" title={nombrePerfil}>
                  {nombrePerfil}
                </span>
                <span className="wb-rol-pill">{ETIQUETA_ROL[sesion.usuario.rol]}</span>
              </div>
            </div>
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
            const activo =
              rutaCompleta === destino ||
              (item.ruta === '/inicio' && location.pathname === '/inicio' && location.search === '');
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
                <span className="wb-nav__contenido">
                  {item.icono ? <Icono nombre={item.icono} tamano={17} className="wb-nav__icono" /> : null}
                  <span>{item.etiqueta}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {sesion ? (
          <Boton variante="secundario" anchoCompleto onClick={handleCerrarSesion}>
            <Icono nombre="logout" tamano={16} />
            <span>Cerrar sesión</span>
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
