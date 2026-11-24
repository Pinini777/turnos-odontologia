import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi, type PacienteApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, EstadoVacio, SkeletonTabla } from '../../base/components';
import {
  actualizarOdontograma,
  agregarEntradaHistoria,
  listarHistoriaClinica,
  listarPacientes,
  listarProfesionales,
  obtenerOdontograma,
  type EntradaHistoriaApi,
  type ItemActualizacionPiezaPayload,
  type ProfesionalApi,
  type VistaOdontogramaApi,
} from './apiProfesional';
import { formatearFechaHora } from './formatos';
import { GuardiaProfesional } from './GuardiaProfesional';
import { MENU_PROFESIONAL } from './menuProfesional';
import { Odontograma3d } from './Odontograma3d';
import { ETIQUETA_CARA_PIEZA, ETIQUETA_ESTADO_PIEZA } from './odontogramaFdi';

function ContenidoClinica() {
  const [pacientes, setPacientes] = useState<readonly PacienteApi[]>([]);
  const [profesionales, setProfesionales] = useState<readonly ProfesionalApi[]>([]);
  const [pacienteId, setPacienteId] = useState<string>('');
  const [historia, setHistoria] = useState<readonly EntradaHistoriaApi[]>([]);
  const [odontograma, setOdontograma] = useState<VistaOdontogramaApi | null>(null);

  const [cargandoBase, setCargandoBase] = useState<boolean>(true);
  const [cargandoPaciente, setCargandoPaciente] = useState<boolean>(false);
  const [guardandoOdo, setGuardandoOdo] = useState<boolean>(false);
  const [guardandoHc, setGuardandoHc] = useState<boolean>(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [estadoMensaje, setEstadoMensaje] = useState<string | null>(null);

  // Estado del formulario de historia clínica append-only
  const [textoHc, setTextoHc] = useState<string>('');
  const [corrigeAId, setCorrigeAId] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    setCargandoBase(true);
    setErrorApi(null);

    Promise.all([listarPacientes(), listarProfesionales()])
      .then(([listaPac, listaProf]) => {
        if (!activo) return;
        setPacientes(listaPac);
        setProfesionales(listaProf);
        if (listaPac[0]) {
          setPacienteId(listaPac[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargandoBase(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!pacienteId) return;
    let activo = true;
    setCargandoPaciente(true);
    setErrorApi(null);
    setCorrigeAId(null);
    setTextoHc('');

    Promise.all([listarHistoriaClinica(pacienteId), obtenerOdontograma(pacienteId)])
      .then(([listaHc, vistaOdo]) => {
        if (!activo) return;
        setHistoria(listaHc);
        setOdontograma(vistaOdo);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargandoPaciente(false);
      });

    return () => {
      activo = false;
    };
  }, [pacienteId]);

  const pacienteActual = pacientes.find((p) => p.id === pacienteId) ?? null;

  function nombreProfesional(id: string): string {
    return profesionales.find((p) => p.id === id)?.nombre ?? id;
  }

  async function handleGuardarCambiosOdontograma(
    items: readonly ItemActualizacionPiezaPayload[],
  ): Promise<boolean> {
    if (!pacienteId || items.length === 0) return false;
    setErrorApi(null);
    setEstadoMensaje(null);
    setGuardandoOdo(true);
    try {
      const actualizado = await actualizarOdontograma(pacienteId, items);
      setOdontograma(actualizado);
      const etiqueta =
        items.length === 1 && items[0]
          ? `Cambio guardado en pieza ${items[0].pieza}.`
          : `${items.length} cambios guardados en el odontograma.`;
      setEstadoMensaje(etiqueta);
      return true;
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      return false;
    } finally {
      setGuardandoOdo(false);
    }
  }

  async function handleGuardarHistoria(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!pacienteId) return;
    const limpio = textoHc.trim();
    if (!limpio) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }

    setErrorApi(null);
    setEstadoMensaje(null);
    setGuardandoHc(true);
    try {
      const payload = corrigeAId ? { texto: limpio, corrigeAId } : { texto: limpio };
      const nueva = await agregarEntradaHistoria(pacienteId, payload);
      setHistoria((prev) => [...prev, nueva]);
      setTextoHc('');
      setCorrigeAId(null);
      setEstadoMensaje(
        corrigeAId ? 'Corrección registrada en la historia clínica.' : 'Evolución clínica registrada.',
      );
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardandoHc(false);
    }
  }

  const cargando = cargandoBase || cargandoPaciente;

  return (
    <AppLayout
      titulo="Historia clínica y odontograma"
      subtitulo="Registro clínico exclusivo del profesional con odontograma FDI de 5 caras e historial inmutable."
      itemsExtra={MENU_PROFESIONAL}
    >
      <div className="prof-stack">
        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {estadoMensaje ? (
          <div className="prof-banner-exito" role="status" aria-live="polite">
            {estadoMensaje}
          </div>
        ) : null}

        <section className="prof-patient-bar" aria-label="Paciente seleccionado">
          <div className="prof-patient-select">
            <label htmlFor="sel-paciente-clinica" className="prof-field__label">
              Paciente
            </label>
            <select
              id="sel-paciente-clinica"
              className="prof-select"
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              disabled={pacientes.length === 0}
            >
              {pacientes.map((pac) => (
                <option key={pac.id} value={pac.id}>
                  {pac.nombre} {pac.apellido} — DNI {pac.documento}
                </option>
              ))}
            </select>
          </div>

          {pacienteActual ? (
            <div className="prof-patient-meta">
              <span className="prof-patient-chip">{pacienteActual.email}</span>
              {pacienteActual.obraSocial ? (
                <span className="prof-patient-chip">
                  {pacienteActual.obraSocial}
                  {pacienteActual.plan ? ` ${pacienteActual.plan}` : ''} (informativa)
                </span>
              ) : null}
              {odontograma?.actualizadoEn ? (
                <span className="prof-patient-chip">
                  Actualizado: {formatearFechaHora(odontograma.actualizadoEn)}
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        {cargando ? <SkeletonTabla filas={4} /> : null}

        {!cargando && !pacienteActual ? (
          <EstadoVacio
            titulo="No hay pacientes registrados"
            descripcion="Cuando haya pacientes en el consultorio podrás consultar su historia clínica y odontograma."
          />
        ) : null}

        {!cargando && pacienteActual ? (
          <>
            <Odontograma3d
              pacienteId={pacienteActual.id}
              piezas={odontograma?.piezas ?? []}
              historial={odontograma?.historial ?? []}
              guardando={guardandoOdo}
              nombreProfesional={nombreProfesional}
              onGuardarCambios={handleGuardarCambiosOdontograma}
              onNotificar={setEstadoMensaje}
            />

            <section className="prof-grid-2">
              <div className="prof-card" aria-labelledby="titulo-hc">
                <div className="prof-card__head">
                  <div>
                    <h2 id="titulo-hc" className="prof-card__titulo">
                      Historia clínica
                    </h2>
                    <p className="prof-card__sub">
                      Registro append-only: las entradas no se modifican ni borran; ante un error se agrega una corrección referenciada.
                    </p>
                  </div>
                </div>

                {historia.length === 0 ? (
                  <EstadoVacio
                    titulo="Sin evoluciones registradas"
                    descripcion="Registrá la primera evolución clínica del paciente desde el formulario."
                  />
                ) : (
                  <div className="prof-timeline" style={{ marginBottom: 'var(--space-5)' }}>
                    {historia.map((entrada) => (
                      <article
                        key={entrada.id}
                        className={[
                          'prof-entry',
                          entrada.corrigeAId ? 'prof-entry--correccion' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div className="prof-entry__meta">
                          <strong>
                            {nombreProfesional(entrada.profesionalId)} ·{' '}
                            {formatearFechaHora(entrada.fecha)}
                          </strong>
                          {entrada.corrigeAId ? (
                            <span className="prof-entry__badge">
                              Corrección de entrada #{entrada.corrigeAId}
                            </span>
                          ) : (
                            <span>Entrada #{entrada.id}</span>
                          )}
                        </div>
                        <p className="prof-entry__texto">{entrada.texto}</p>
                        <Boton
                          variante="secundario"
                          onClick={() => setCorrigeAId(entrada.id)}
                        >
                          Agregar corrección
                        </Boton>
                      </article>
                    ))}
                  </div>
                )}

                <form className="prof-form" onSubmit={(e) => void handleGuardarHistoria(e)}>
                  <div className="prof-field">
                    <label htmlFor="hc-texto" className="prof-field__label">
                      {corrigeAId
                        ? `Corrección sobre entrada #${corrigeAId}`
                        : 'Nueva evolución clínica'}
                    </label>
                    <textarea
                      id="hc-texto"
                      className="prof-textarea"
                      value={textoHc}
                      onChange={(e) => setTextoHc(e.target.value)}
                      placeholder="Describí el hallazgo, tratamiento o indicación clínica…"
                      required
                    />
                  </div>
                  <div className="prof-acciones">
                    <Boton type="submit" cargando={guardandoHc}>
                      {corrigeAId ? 'Registrar corrección' : 'Registrar evolución'}
                    </Boton>
                    {corrigeAId ? (
                      <Boton variante="secundario" onClick={() => setCorrigeAId(null)}>
                        Cancelar corrección
                      </Boton>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="prof-card" aria-labelledby="titulo-hist-odo">
                <div className="prof-card__head">
                  <div>
                    <h2 id="titulo-hist-odo" className="prof-card__titulo">
                      Historial del odontograma
                    </h2>
                    <p className="prof-card__sub">
                      Cada modificación queda registrada cronológicamente con autor y fecha.
                    </p>
                  </div>
                </div>

                {(odontograma?.historial.length ?? 0) === 0 ? (
                  <EstadoVacio
                    titulo="Sin registros en el odontograma"
                    descripcion="Al guardar el estado de una pieza aparecerá aquí la cronología."
                  />
                ) : (
                  <div className="prof-tabla-wrap">
                    <table className="prof-tabla" aria-label="Historial del odontograma">
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Pieza</th>
                          <th scope="col">Cara</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Autor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(odontograma?.historial ?? []).map((reg) => (
                          <tr key={reg.id}>
                            <td data-label="Fecha" className="prof-num">
                              {formatearFechaHora(reg.fecha)}
                            </td>
                            <td data-label="Pieza" className="prof-num">
                              {reg.pieza}
                            </td>
                            <td data-label="Cara">
                              {reg.cara ? ETIQUETA_CARA_PIEZA[reg.cara] : 'Completa'}
                            </td>
                            <td data-label="Estado">{ETIQUETA_ESTADO_PIEZA[reg.estado]}</td>
                            <td data-label="Autor">{nombreProfesional(reg.registradoPor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function ClinicaPage() {
  return (
    <GuardiaProfesional titulo="Historia clínica y odontograma">
      <ContenidoClinica />
    </GuardiaProfesional>
  );
}
