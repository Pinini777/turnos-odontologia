import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorApi, registrarPacienteApi, type EntradaRegistroPaciente } from './api';
import { CLINICA } from './clinica';
import { AlertaErrorNegocio, Boton, Campo, IconoMarca } from './components';
import { apiConsultorio, useSesion } from './sesion';
import './styles.css';

interface ErroresRegistro {
  nombre?: string;
  apellido?: string;
  documento?: string;
  email?: string;
  password?: string;
}

const textEncoder = new TextEncoder();

export function RegistroPage() {
  const { iniciar } = useSesion();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [plan, setPlan] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [errores, setErrores] = useState<ErroresRegistro>({});

  useEffect(() => {
    document.title = `Crear cuenta — ${CLINICA.nombre}`;
  }, []);

  function validar(): ErroresRegistro {
    const e: ErroresRegistro = {};
    if (!nombre.trim()) e.nombre = 'Ingresá tu nombre.';
    if (!apellido.trim()) e.apellido = 'Ingresá tu apellido.';
    if (!documento.trim()) e.documento = 'Ingresá tu número de documento.';
    if (!email.trim() || !email.includes('@')) e.email = 'Ingresá un correo electrónico válido.';
    if (password.length < 8) {
      e.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (textEncoder.encode(password).length > 72) {
      e.password = 'La contraseña es demasiado larga (máximo 72 bytes).';
    }
    return e;
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    setErrorApi(null);

    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    const payload: EntradaRegistroPaciente = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      documento: documento.trim(),
      email: email.trim(),
      password,
      ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
      ...(obraSocial.trim() ? { obraSocial: obraSocial.trim() } : {}),
      ...(plan.trim() ? { plan: plan.trim() } : {}),
      ...(nroAfiliado.trim() ? { nroAfiliado: nroAfiliado.trim() } : {}),
    };

    setEnviando(true);
    try {
      const resultado = await registrarPacienteApi(apiConsultorio, payload);
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
          <h1 className="wb-auth-editorial__titulo">Reservá tu turno online en pocos pasos</h1>
          <p className="wb-auth-editorial__sub">
            Elegí el horario disponible que mejor se adapte a tu semana, recibí tu confirmación por
            correo y sumala directo a tu calendario.
          </p>

          <div className="wb-clinica-meta">
            <div className="wb-clinica-meta__fila">
              <span>{CLINICA.direccion}</span>
            </div>
            <div className="wb-clinica-meta__fila">
              <span>{CLINICA.horario}</span>
            </div>
          </div>
        </div>

        <div className="wb-agenda-muestra" aria-hidden="true">
          <div className="wb-agenda-muestra__cab">
            <span>Autogestión del paciente</span>
            <span>Sin llamadas</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--1">
            <span>Confirmación por correo + Google Calendar</span>
            <span className="wb-agenda-muestra__chip">Incluido</span>
          </div>
          <div className="wb-agenda-muestra__slot wb-agenda-muestra__slot--2">
            <span>Reprogramación o cancelación hasta 24 h antes</span>
            <span className="wb-agenda-muestra__chip">Online</span>
          </div>
        </div>
      </aside>

      <main className="wb-auth-panel">
        <div className="wb-auth-card wb-auth-card--ancho">
          <h2 className="wb-auth-card__titulo">Creá tu cuenta de paciente</h2>
          <p className="wb-auth-card__sub">
            Completá tus datos personales para reservar y gestionar tus turnos.
          </p>

          <form className="wb-form" onSubmit={handleSubmit} noValidate>
            <div className="wb-nota-clinica">
              Si ya te atendiste en la clínica, usá el mismo DNI y correo electrónico que registraste
              en recepción para vincular tu ficha automáticamente.
            </div>

            {errorApi ? (
              <AlertaErrorNegocio
                code={errorApi.code}
                mensaje={errorApi.mensajeLegible}
                detalles={errorApi.detalles}
              />
            ) : null}

            <div className="wb-form-grid2">
              <Campo
                etiqueta="Nombre"
                name="nombre"
                autoComplete="given-name"
                placeholder="Lucía…"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                error={errores.nombre}
              />
              <Campo
                etiqueta="Apellido"
                name="apellido"
                autoComplete="family-name"
                placeholder="Fernández…"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                error={errores.apellido}
              />
            </div>

            <div className="wb-form-grid2">
              <Campo
                etiqueta="Documento (DNI)"
                name="documento"
                inputMode="numeric"
                autoComplete="off"
                placeholder="00000003…"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                error={errores.documento}
              />
              <Campo
                etiqueta="Correo electrónico"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="lucia.fernandez@example.com…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errores.email}
              />
            </div>

            <Campo
              etiqueta="Contraseña"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres…"
              ayuda="Elegí una contraseña segura de al menos 8 caracteres."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
            />

            <details className="wb-detalles">
              <summary>Contacto y obra social (opcional)</summary>
              <div className="wb-detalles__cuerpo">
                <div className="wb-form-grid2">
                  <Campo
                    etiqueta="Teléfono"
                    name="telefono"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(0261) 000-0101…"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                  <Campo
                    etiqueta="Obra social"
                    name="obraSocial"
                    autoComplete="off"
                    placeholder="OSDE, OSEP, Swiss Medical…"
                    value={obraSocial}
                    onChange={(e) => setObraSocial(e.target.value)}
                  />
                </div>
                <div className="wb-form-grid2">
                  <Campo
                    etiqueta="Plan"
                    name="plan"
                    autoComplete="off"
                    placeholder="Plan 210…"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  />
                  <Campo
                    etiqueta="Nro. de afiliado"
                    name="nroAfiliado"
                    autoComplete="off"
                    placeholder="000000-01…"
                    value={nroAfiliado}
                    onChange={(e) => setNroAfiliado(e.target.value)}
                  />
                </div>
              </div>
            </details>

            <Boton
              type="submit"
              variante="primario"
              anchoCompleto
              cargando={enviando}
              textoCargando="Creando cuenta…"
            >
              Crear cuenta y entrar
            </Boton>
          </form>

          <p className="wb-auth-pie">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="wb-link">
              Ingresá acá
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
