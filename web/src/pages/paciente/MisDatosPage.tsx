import { useEffect, useState, type FormEvent } from 'react';
import type { ErrorApi, PacienteApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { CLINICA } from '../../base/clinica';
import { AlertaErrorNegocio, Boton, Campo, Skeleton } from '../../base/components';
import {
  aErrorApi,
  actualizarMisDatos,
  obtenerMisDatos,
  type EntradaActualizarDatosPaciente,
} from './apiPaciente';
import { GuardiaPaciente } from './GuardiaPaciente';
import { ITEMS_PACIENTE } from './menuPaciente';
import './paciente.css';

interface FormularioDatos {
  readonly nombre: string;
  readonly apellido: string;
  readonly telefono: string;
  readonly obraSocial: string;
  readonly plan: string;
  readonly nroAfiliado: string;
}

type CampoDatos = keyof FormularioDatos;
type ErroresFormularioDatos = Partial<Record<CampoDatos, string>>;

function desdePaciente(p: PacienteApi): FormularioDatos {
  return {
    nombre: p.nombre,
    apellido: p.apellido,
    telefono: p.telefono ?? '',
    obraSocial: p.obraSocial ?? '',
    plan: p.plan ?? '',
    nroAfiliado: p.nroAfiliado ?? '',
  };
}

function MisDatosContenido() {
  const [paciente, setPaciente] = useState<PacienteApi | null>(null);
  const [form, setForm] = useState<FormularioDatos>({
    nombre: '',
    apellido: '',
    telefono: '',
    obraSocial: '',
    plan: '',
    nroAfiliado: '',
  });
  const [erroresCampo, setErroresCampo] = useState<ErroresFormularioDatos>({});
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<ErrorApi | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    let activo = true;
    obtenerMisDatos()
      .then((datos) => {
        if (!activo) return;
        setPaciente(datos);
        setForm(desdePaciente(datos));
      })
      .catch((err: unknown) => {
        if (activo) setErrorCarga(aErrorApi(err));
      });
    return () => {
      activo = false;
    };
  }, []);

  function actualizarCampo(campo: CampoDatos, valor: string): void {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setGuardadoOk(false);
    setErroresCampo((prev) => {
      if (!prev[campo]) return prev;
      const copia: ErroresFormularioDatos = { ...prev };
      delete copia[campo];
      return copia;
    });
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!paciente) return;

    setErrorGuardado(null);
    setGuardadoOk(false);

    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const telefono = form.telefono.trim();
    const obraSocial = form.obraSocial.trim();
    const plan = form.plan.trim();
    const nroAfiliado = form.nroAfiliado.trim();

    const nuevosErrores: ErroresFormularioDatos = {};
    if (nombre.length === 0) nuevosErrores.nombre = 'Este campo no puede quedar vacío.';
    if (apellido.length === 0) nuevosErrores.apellido = 'Este campo no puede quedar vacío.';
    if (paciente.telefono && telefono.length === 0) {
      nuevosErrores.telefono = 'Este campo no puede quedar vacío.';
    }
    if (paciente.obraSocial && obraSocial.length === 0) {
      nuevosErrores.obraSocial = 'Este campo no puede quedar vacío.';
    }
    if (paciente.plan && plan.length === 0) {
      nuevosErrores.plan = 'Este campo no puede quedar vacío.';
    }
    if (paciente.nroAfiliado && nroAfiliado.length === 0) {
      nuevosErrores.nroAfiliado = 'Este campo no puede quedar vacío.';
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresCampo(nuevosErrores);
      return;
    }

    setErroresCampo({});
    setGuardando(true);

    const payload: EntradaActualizarDatosPaciente = {
      nombre,
      apellido,
      ...(telefono.length > 0 ? { telefono } : {}),
      ...(obraSocial.length > 0 ? { obraSocial } : {}),
      ...(plan.length > 0 ? { plan } : {}),
      ...(nroAfiliado.length > 0 ? { nroAfiliado } : {}),
    };

    try {
      const actualizado = await actualizarMisDatos(payload);
      setPaciente(actualizado);
      setForm(desdePaciente(actualizado));
      setGuardadoOk(true);
    } catch (err: unknown) {
      setErrorGuardado(aErrorApi(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <AppLayout
      titulo="Mis datos personales"
      subtitulo="Mantené actualizados tu teléfono y tu cobertura médica para agilizar la atención en recepción."
      itemsExtra={ITEMS_PACIENTE}
    >
      <div className="pa-stack" style={{ maxWidth: '48rem' }}>
        {errorCarga ? (
          <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} />
        ) : null}

        {errorGuardado ? (
          <AlertaErrorNegocio
            code={errorGuardado.code}
            mensaje={errorGuardado.mensajeLegible}
            detalles={errorGuardado.detalles}
          />
        ) : null}

        {guardadoOk ? (
          <div className="pa-banner-exito" role="status" aria-live="polite">
            <span>Tus datos se guardaron correctamente.</span>
          </div>
        ) : null}

        {paciente === null && !errorCarga ? (
          <section className="pa-card pa-stack" aria-label="Cargando tus datos">
            <Skeleton alto="3rem" />
            <Skeleton alto="3rem" />
            <Skeleton alto="3rem" />
          </section>
        ) : paciente !== null ? (
          <section className="pa-card">
            <h2 className="pa-card__titulo">Identificación de cuenta</h2>
            <p className="pa-card__sub">
              Para modificar tu documento o correo electrónico, solicitalo en recepción al{' '}
              {CLINICA.telefono}.
            </p>

            <div className="pa-datos-lectura">
              <div>
                <span>Documento (DNI)</span>
                <strong>{paciente.documento}</strong>
              </div>
              <div>
                <span>Correo electrónico</span>
                <strong>{paciente.email}</strong>
              </div>
            </div>

            <form
              className="pa-stack"
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
            >
              <div className="pa-datos-grid">
                <Campo
                  etiqueta="Nombre"
                  required
                  value={form.nombre}
                  error={erroresCampo.nombre}
                  onChange={(e) => actualizarCampo('nombre', e.target.value)}
                />
                <Campo
                  etiqueta="Apellido"
                  required
                  value={form.apellido}
                  error={erroresCampo.apellido}
                  onChange={(e) => actualizarCampo('apellido', e.target.value)}
                />
                <Campo
                  etiqueta="Teléfono"
                  type="tel"
                  placeholder="Ej. (0261) 000-0100"
                  value={form.telefono}
                  error={erroresCampo.telefono}
                  onChange={(e) => actualizarCampo('telefono', e.target.value)}
                />
                <Campo
                  etiqueta="Obra social"
                  placeholder="Ej. OSDE, OSEP, Particular"
                  value={form.obraSocial}
                  error={erroresCampo.obraSocial}
                  onChange={(e) => actualizarCampo('obraSocial', e.target.value)}
                />
                <Campo
                  etiqueta="Plan"
                  placeholder="Opcional"
                  value={form.plan}
                  error={erroresCampo.plan}
                  onChange={(e) => actualizarCampo('plan', e.target.value)}
                />
                <Campo
                  etiqueta="Número de afiliado"
                  placeholder="Opcional"
                  value={form.nroAfiliado}
                  error={erroresCampo.nroAfiliado}
                  onChange={(e) => actualizarCampo('nroAfiliado', e.target.value)}
                />
              </div>

              <div className="pa-acciones">
                <Boton
                  type="submit"
                  variante="primario"
                  cargando={guardando}
                  textoCargando="Guardando…"
                >
                  Guardar cambios
                </Boton>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function MisDatosPage() {
  return (
    <GuardiaPaciente>
      <MisDatosContenido />
    </GuardiaPaciente>
  );
}
