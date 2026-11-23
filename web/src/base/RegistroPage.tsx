import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorApi, registrarPacienteApi, type EntradaRegistroPaciente } from './api';
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

  function validar(): ErroresRegistro {
    const e: ErroresRegistro = {};
    if (!nombre.trim()) e.nombre = 'Ingresá tu nombre.';
    if (!apellido.trim()) e.apellido = 'Ingresá tu apellido.';
    if (!documento.trim()) e.documento = 'Ingresá tu número de documento.';
    if (!email.trim() || !email.includes('@')) e.email = 'Ingresá un correo electrónico válido.';
    if (password.length < 8) {
      e.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (textEncoder.encode(password).length > 72) {
      e.password = 'La contraseña no puede superar los 72 bytes en UTF-8.';
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
          <span>Consultorio Odontológico</span>
        </div>

        <div>
          <h1 className="wb-auth-editorial__titulo">Reservá tu turno online en pocos pasos</h1>
          <p className="wb-auth-editorial__sub">
            Con tu cuenta podés elegir horario libre, recibir confirmación por correo con Google
            Calendar y cancelar o reprogramar hasta 24 horas antes.
          </p>
        </div>

        <div className="wb-agenda-muestra" aria-hidden="true">
          <div className="wb-agenda-muestra__cab">
            <span>Autogestión del paciente</span>
            <span>Sin llamadas</span>
          </div>
          <div className="wb-agenda-muestra__slot">
            <span>Confirmación por email + archivo .ics</span>
            <span className="wb-agenda-muestra__chip">Incluido</span>
          </div>
          <div className="wb-agenda-muestra__slot">
            <span>Cancelación o cambio hasta 24 h antes</span>
            <span className="wb-agenda-muestra__chip">Online</span>
          </div>
        </div>
      </aside>

      <main className="wb-auth-panel">
        <div className="wb-auth-card wb-auth-card--ancho">
          <h2 className="wb-auth-card__titulo">Creá tu cuenta de paciente</h2>
          <p className="wb-auth-card__sub">
            Completá tus datos para empezar a gestionar tus turnos.
          </p>

          <form className="wb-form" onSubmit={handleSubmit} noValidate>
            <div className="wb-nota-clinica">
              Si la recepción ya cargó tu ficha antes, ingresá el mismo documento y correo
              electrónico para vincular tu historial automáticamente.
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
                placeholder="Paciente…"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                error={errores.nombre}
              />
              <Campo
                etiqueta="Apellido"
                name="apellido"
                autoComplete="family-name"
                placeholder="Ficticio Tres…"
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
                placeholder="paciente3@example.com…"
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
              ayuda="Debe tener al menos 8 caracteres y hasta 72 bytes UTF-8."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
            />

            <details className="wb-detalles">
              <summary>Contacto y obra social (opcional, solo informativo)</summary>
              <div className="wb-detalles__cuerpo">
                <div className="wb-form-grid2">
                  <Campo
                    etiqueta="Teléfono"
                    name="telefono"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0000-000003…"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                  <Campo
                    etiqueta="Obra social"
                    name="obraSocial"
                    autoComplete="off"
                    placeholder="Obra Social Ficticia…"
                    value={obraSocial}
                    onChange={(e) => setObraSocial(e.target.value)}
                  />
                </div>
                <div className="wb-form-grid2">
                  <Campo
                    etiqueta="Plan"
                    name="plan"
                    autoComplete="off"
                    placeholder="Plan Básico…"
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
