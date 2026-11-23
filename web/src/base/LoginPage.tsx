import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorApi, loginApi } from './api';
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
          <span>Consultorio Odontológico</span>
        </div>

        <div>
          <h1 className="wb-auth-editorial__titulo">
            Agenda clínica ordenada por profesional y por box
          </h1>
          <p className="wb-auth-editorial__sub">
            Turnos en bloques de 15 minutos, sin superposiciones ni sobreturnos, y reserva online
            con confirmación para tus pacientes.
          </p>
        </div>

        <div className="wb-agenda-muestra" aria-hidden="true">
          <div className="wb-agenda-muestra__cab">
            <span>Box 1 · Lunes 09:00 a 13:00</span>
            <span>Intervalo [inicio, fin)</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--1">
            <span>10:00 – 10:30 · Consulta · Dra. Ana Pérez</span>
            <span className="wb-agenda-muestra__chip">Confirmado</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--2">
            <span>10:30 – 11:00 · Control · Dra. Ana Pérez</span>
            <span className="wb-agenda-muestra__chip">Contiguo válido</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--3">
            <span>11:00 – 11:45 · Limpieza · Box 2 libre</span>
            <span className="wb-agenda-muestra__chip">Disponible</span>
          </div>
        </div>
      </aside>

      <main className="wb-auth-panel">
        <div className="wb-auth-card">
          <h2 className="wb-auth-card__titulo">Ingresá a tu cuenta</h2>
          <p className="wb-auth-card__sub">
            Accedé como paciente, recepcionista o profesional del consultorio.
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
              placeholder="paciente1@example.com…"
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
            <summary>Cuentas ficticias de ejemplo para pruebas locales</summary>
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
            ¿Sos paciente nuevo?{' '}
            <Link to="/registro" className="wb-link">
              Creá tu cuenta
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
