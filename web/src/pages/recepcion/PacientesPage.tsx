import { useEffect, useState, type FormEvent } from 'react';
import type { ErrorApi, PacienteApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio, Boton, Campo, Tabla } from '../../base/components';
import { crearPaciente, listarPacientes, type DatosPacienteNuevo } from './api';
import { aErrorApi } from './comun';
import { filtrarPacientes } from './dominio';
import { ITEMS_RECEPCION } from './menu';
import './recepcion.css';

const VACIO = { nombre: '', apellido: '', documento: '', email: '', telefono: '' };

/** Lista de pacientes con buscador y alta (spec "Pacientes"). */
export function PacientesPage() {
  const [pacientes, setPacientes] = useState<PacienteApi[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [formAbierto, setFormAbierto] = useState(false);
  const [datos, setDatos] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState<ErrorApi | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarPacientes()
      .then((lista) => vigente && setPacientes(lista))
      .catch((e: unknown) => vigente && setErrorCarga(aErrorApi(e)));
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const { telefono, ...resto } = datos;
    const entrada: DatosPacienteNuevo = {
      nombre: resto.nombre.trim(), apellido: resto.apellido.trim(), documento: resto.documento.trim(), email: resto.email.trim(),
      ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
    };
    setGuardando(true);
    setErrorAlta(null);
    try {
      await crearPaciente(entrada);
      setDatos(VACIO);
      setFormAbierto(false);
      setRecarga((n) => n + 1);
    } catch (err: unknown) {
      setErrorAlta(aErrorApi(err));
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave: keyof typeof VACIO, etiqueta: string, tipo = 'text') => (
    <Campo etiqueta={etiqueta} type={tipo} value={datos[clave]} onChange={(ev) => setDatos({ ...datos, [clave]: ev.target.value })} />
  );
  const completos = [datos.nombre, datos.apellido, datos.documento, datos.email].every((v) => v.trim().length > 0);
  const visibles = filtrarPacientes(pacientes ?? [], busqueda);

  return (
    <AppLayout
      titulo="Pacientes"
      subtitulo="Buscá un paciente o dalo de alta."
      itemsExtra={ITEMS_RECEPCION}
      acciones={formAbierto ? null : <Boton onClick={() => setFormAbierto(true)}>+ Nuevo paciente</Boton>}
    >
      <div className="rc-pila">
        {formAbierto ? (
          <form className="rc-card" aria-label="Alta de paciente" onSubmit={guardar} noValidate>
            <h2>Nuevo paciente</h2>
            <p className="rc-hint">Solo datos ficticios en pruebas.</p>
            {errorAlta ? <AlertaErrorNegocio code={errorAlta.code} mensaje={errorAlta.mensajeLegible} detalles={errorAlta.detalles} /> : null}
            <div className="rc-grid-2">
              {campo('nombre', 'Nombre')}
              {campo('apellido', 'Apellido')}
              {campo('documento', 'Documento')}
              {campo('email', 'Email', 'email')}
              {campo('telefono', 'Teléfono (opcional)', 'tel')}
            </div>
            <div className="rc-acciones">
              <Boton variante="secundario" onClick={() => setFormAbierto(false)}>Cancelar</Boton>
              <Boton type="submit" disabled={!completos} cargando={guardando} textoCargando="Guardando…">Guardar paciente</Boton>
            </div>
          </form>
        ) : null}

        <section className="rc-card" aria-label="Lista de pacientes">
          <Campo etiqueta="Buscar paciente" type="search" placeholder="Nombre, apellido o documento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <div style={{ marginTop: 'var(--space-4)' }}>
            {errorCarga ? <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} /> : null}
            <Tabla
              cargando={pacientes === null && !errorCarga}
              filas={visibles}
              claveFila={(p) => p.id}
              vacioTitulo={busqueda.trim() ? 'Sin resultados' : 'Todavía no hay pacientes'}
              vacioDescripcion={busqueda.trim() ? 'Probá con otro nombre o documento.' : 'Dalos de alta con "Nuevo paciente".'}
              columnas={[
                { encabezado: 'Paciente', render: (p) => `${p.nombre} ${p.apellido}` },
                { encabezado: 'Documento', render: (p) => p.documento },
                { encabezado: 'Email', render: (p) => p.email },
                { encabezado: 'Teléfono', render: (p) => p.telefono ?? '—' },
              ]}
            />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
