import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { PacienteApi, UsuarioPublico } from './api';
import { CLINICA } from './clinica';
import { AvatarIniciales, Boton, IconoMarca } from './components';
import { Icono } from './iconos';
import { destinoDeItem, ETIQUETA_ROL, obtenerMenuPorRol, type ItemMenu } from './menu';
import { apiConsultorio, useSesion } from './sesion';
import './styles.css';

interface GeometriaIndicador {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

interface ProfesionalResumen {
  readonly id: string;
  readonly nombre: string;
  readonly usuarioId: string;
}

function nombreInicialPorUsuario(usuario: UsuarioPublico): string {
  if (usuario.rol === 'recepcionista') {
    return 'Recepción Alvear';
  }
  return usuario.email;
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
  const [nombreResuelto, setNombreResuelto] = useState<{ usuarioId: string; nombre: string } | null>(null);

  const items = sesion ? obtenerMenuPorRol(sesion.usuario.rol, itemsExtra) : [];
  const rutaCompleta = `${location.pathname}${location.search}`;
  const claveTransicion = claveVista ?? rutaCompleta;

  const nombrePerfil = sesion
    ? nombreResuelto?.usuarioId === sesion.usuario.id
      ? nombreResuelto.nombre
      : nombreInicialPorUsuario(sesion.usuario)
    : '';

  useEffect(() => {
    document.title = `${titulo} — ${CLINICA.nombre}`;
  }, [titulo]);

  useEffect(() => {
    if (!sesion) return;
    const { id: usuarioId, rol } = sesion.usuario;
    if (rol === 'recepcionista') return;
    const path = location.pathname;
    const rutaPermitida =
      path === '/inicio' ||
      (rol === 'paciente' && path.startsWith('/paciente')) ||
      (rol === 'profesional' && path.startsWith('/profesional'));
    if (!rutaPermitida) return;

    let activo = true;
    if (rol === 'paciente') {
      apiConsultorio
        .get<PacienteApi>('/api/paciente/datos')
        .then((datos) => {
          if (!activo || !datos || typeof datos.nombre !== 'string' || typeof datos.apellido !== 'string') {
            return;
          }
          const completo = `${datos.nombre} ${datos.apellido}`.trim();
          if (completo) {
            setNombreResuelto({ usuarioId, nombre: completo });
          }
        })
        .catch(() => {
          // Conserva el email de la sesión si la consulta falla o no está disponible.
        });
    } else if (rol === 'profesional') {
      apiConsultorio
        .get<ProfesionalResumen[]>('/api/profesionales')
        .then((lista) => {
          if (!activo || !Array.isArray(lista)) return;
          const prof = lista.find((p) => p.usuarioId === usuarioId);
          if (prof?.nombre) {
            setNombreResuelto({ usuarioId, nombre: prof.nombre });
          }
        })
        .catch(() => {
          // Conserva el email de la sesión si la consulta falla.
        });
    }

    return () => {
      activo = false;
    };
  }, [sesion, location.pathname]);

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
