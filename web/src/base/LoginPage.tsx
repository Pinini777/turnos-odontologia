import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorApi, loginApi } from './api';
import { CLINICA } from './clinica';
import { AlertaErrorNegocio, Boton, Campo, IconoMarca } from './components';
import { apiConsultorio, useSesion } from './sesion';
import './styles.css';

const CUENTAS_DEMO = [
  { etiqueta: 'Profesional', email: 'profesional@example.com', password: 'profesional-ejemplo' },
  { etiqueta: 'Recepción', email: 'recepcion@example.com', password: 'recepcion-ejemplo' },
  { etiqueta: 'Paciente', email: 'paciente1@example.com', password: 'paciente-ejemplo' },
] as const;

export function LoginPage() {
  const { iniciar } = useSesion();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [errorLocal, setErrorLocal] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    document.title = `Ingresar — ${CLINICA.nombre}`;
  }, []);

  async function handleSubmit(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErrorApi(null);

    const errores: { email?: string; password?: string } = {};
    if (!email.trim() || !email.includes('@')) {
      errores.email = 'Ingresá un correo electrónico válido.';
    }
    if (password.length === 0) {
      errores.password = 'Ingresá tu contraseña.';
    }
    setErrorLocal(errores);
    if (errores.email || errores.password) return;

    setEnviando(true);
    try {
      const resultado = await loginApi(apiConsultorio, { email: email.trim(), password });
      iniciar({ token: resultado.token, usuario: resultado.usuario });
      void navigate('/inicio', { replace: true });
    } catch (error: unknown) {
      if (error instanceof ErrorApi) {
        setErrorApi(error);
      } else {
        setErrorApi(new ErrorApi(500, 'ERROR_INTERNO'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="wb-auth-split">
      <aside className="wb-auth-editorial">
        <div className="wb-marca">
          <IconoMarca tamano={38} />
          <span className="wb-marca__texto">
            <span>{CLINICA.nombre}</span>
            <span className="wb-marca__sub">{CLINICA.subtitulo}</span>
          </span>
        </div>

        <div>
          <h1 className="wb-auth-editorial__titulo">
            Atención odontológica puntual y ordenada
          </h1>
          <p className="wb-auth-editorial__sub">
            Reservá tu turno online en pocos pasos, recibí tu confirmación al instante y gestioná
            tus horarios sin esperas ni superposiciones.
          </p>

          <div className="wb-clinica-meta">
            <div className="wb-clinica-meta__fila">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>{CLINICA.direccion}</span>
            </div>
            <div className="wb-clinica-meta__fila">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" />
              </svg>
              <span>{CLINICA.horario}</span>
            </div>
            <div className="wb-chips" aria-label="Especialidades">
              {CLINICA.especialidades.map((esp) => (
                <span key={esp} className="wb-chip-oscuro">
                  {esp}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255, 255, 255, 0.82)' }}>
              Obras sociales: {CLINICA.obrasSociales.join(', ')}
            </div>
          </div>
        </div>

        <div className="wb-agenda-muestra" aria-hidden="true">
          <div className="wb-agenda-muestra__cab">
            <span>Turnos organizados · Box 1 y Box 2</span>
            <span>Sin superposiciones</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--1">
            <span>09:00 – 09:30 · Consulta · Dra. Ana Pérez</span>
            <span className="wb-agenda-muestra__chip">Confirmado</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--2">
            <span>09:30 – 10:15 · Limpieza · Dra. Ana Pérez</span>
            <span className="wb-agenda-muestra__chip">En horario</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--3">
            <span>10:00 – 10:30 · Control · Dr. Bruno Gómez</span>
            <span className="wb-agenda-muestra__chip">Box 2 libre</span>
          </div>
        </div>
      </aside>

      <main className="wb-auth-panel">
        <div className="wb-auth-card">
          <h2 className="wb-auth-card__titulo">Ingresá a tu cuenta</h2>
          <p className="wb-auth-card__sub">
            Accedé como paciente, recepción o profesional de {CLINICA.nombre}.
          </p>

          <form className="wb-form" onSubmit={handleSubmit} noValidate>
            {errorApi ? (
              <AlertaErrorNegocio
                code={errorApi.code}
                mensaje={errorApi.mensajeLegible}
                detalles={errorApi.detalles}
              />
            ) : null}

            <Campo
              etiqueta="Correo electrónico"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="tu.nombre@example.com…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errorLocal.email}
            />

            <Campo
              etiqueta="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Tu contraseña…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errorLocal.password}
            />

            <Boton
              type="submit"
              variante="primario"
              anchoCompleto
              cargando={enviando}
              textoCargando="Ingresando…"
            >
              Ingresar
            </Boton>
          </form>

          <details className="wb-detalles" style={{ marginTop: 'var(--space-5)' }}>
            <summary>Accesos de demostración</summary>
            <div className="wb-demo-grid">
              {CUENTAS_DEMO.map((cuenta) => (
                <button
                  key={cuenta.etiqueta}
                  type="button"
                  className="wb-demo-btn"
                  onClick={() => {
                    setEmail(cuenta.email);
                    setPassword(cuenta.password);
                    setErrorLocal({});
                    setErrorApi(null);
                  }}
                >
                  {cuenta.etiqueta}
                </button>
              ))}
            </div>
          </details>

          <p className="wb-auth-pie">
            ¿Primera vez en la clínica?{' '}
            <Link to="/registro" className="wb-link">
              Creá tu cuenta de paciente
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
