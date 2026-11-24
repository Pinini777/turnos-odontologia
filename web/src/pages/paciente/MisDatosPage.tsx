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

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setGuardando(true);
    setErrorGuardado(null);
    setGuardadoOk(false);

    const payload: Record<string, string> = {};
    const pares: [keyof EntradaActualizarDatosPaciente, string][] = [
      ['nombre', form.nombre.trim()],
      ['apellido', form.apellido.trim()],
      ['telefono', form.telefono.trim()],
      ['obraSocial', form.obraSocial.trim()],
      ['plan', form.plan.trim()],
      ['nroAfiliado', form.nroAfiliado.trim()],
    ];
    for (const [clave, valor] of pares) {
      if (valor.length > 0) {
        payload[clave] = valor;
      }
    }

    try {
      const actualizado = await actualizarMisDatos(payload as EntradaActualizarDatosPaciente);
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
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, nombre: e.target.value }));
                    setGuardadoOk(false);
                  }}
                />
                <Campo
                  etiqueta="Apellido"
                  required
                  value={form.apellido}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, apellido: e.target.value }));
                    setGuardadoOk(false);
                  }}
                />
                <Campo
                  etiqueta="Teléfono"
                  type="tel"
                  placeholder="Ej. (0261) 000-0100"
                  value={form.telefono}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, telefono: e.target.value }));
                    setGuardadoOk(false);
                  }}
                />
                <Campo
                  etiqueta="Obra social"
                  placeholder="Ej. OSDE, OSEP, Particular"
                  value={form.obraSocial}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, obraSocial: e.target.value }));
                    setGuardadoOk(false);
                  }}
                />
                <Campo
                  etiqueta="Plan"
                  placeholder="Opcional"
                  value={form.plan}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, plan: e.target.value }));
                    setGuardadoOk(false);
                  }}
                />
                <Campo
                  etiqueta="Número de afiliado"
                  placeholder="Opcional"
                  value={form.nroAfiliado}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, nroAfiliado: e.target.value }));
                    setGuardadoOk(false);
                  }}
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
