import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ErrorApi, PacienteApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio, Boton, Campo } from '../../base/components';
import { crearTurnoRecepcion, listarPacientes, type DatosPacienteNuevo, type Hueco, type PacienteDelTurno } from './api';
import { aErrorApi, esSolapamiento, nombrePorId, useCatalogos } from './comun';
import { etiquetaDia, fechaEnZona, filtrarPacientes, horaEnZona } from './dominio';
import { ITEMS_RECEPCION } from './menu';
import { SelectorHuecos } from './SelectorHuecos';
import './recepcion.css';

type Modo = 'existente' | 'nuevo';
const VACIO: DatosPacienteNuevo = { nombre: '', apellido: '', documento: '', email: '', telefono: '' };

/** Recorta espacios y omite el teléfono vacío (la API lo valida como opcional, no como texto vacío). */
function datosParaEnviar({ telefono, ...resto }: DatosPacienteNuevo): DatosPacienteNuevo {
  const limpio = {
    nombre: resto.nombre.trim(), apellido: resto.apellido.trim(), documento: resto.documento.trim(), email: resto.email.trim(),
  };
  return telefono?.trim() ? { ...limpio, telefono: telefono.trim() } : limpio;
}

/** Nuevo turno en un hueco libre, con paciente existente o nuevo (spec, mockup nuevo-turno.html). */
export function NuevoTurnoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profesionales, boxes, prestaciones } = useCatalogos();
  const [pacientes, setPacientes] = useState<PacienteApi[]>([]);

  const [prestacionId, setPrestacionId] = useState('');
  const [profesionalId, setProfesionalId] = useState('');
  const [fecha, setFecha] = useState(params.get('fecha') ?? fechaEnZona(new Date()));
  const [hueco, setHueco] = useState<Hueco | null>(null);
  const [boxId, setBoxId] = useState<string | null>(null);
  const [recargaHuecos, setRecargaHuecos] = useState(0);

  const [modo, setModo] = useState<Modo>('existente');
  const [busqueda, setBusqueda] = useState('');
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<DatosPacienteNuevo>(VACIO);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  useEffect(() => {
    listarPacientes().then(setPacientes).catch(() => setPacientes([]));
  }, []);
  useEffect(() => {
    if (!prestacionId && prestaciones[0]) setPrestacionId(prestaciones[0].id);
  }, [prestaciones, prestacionId]);

  const prestacion = prestaciones.find((p) => p.id === prestacionId);
  const elegido = pacientes.find((p) => p.id === pacienteId);
  const datosNuevosCompletos = [nuevo.nombre, nuevo.apellido, nuevo.documento, nuevo.email].every((v) => v.trim().length > 0);
  const pacienteListo = modo === 'existente' ? elegido !== undefined : datosNuevosCompletos;
  const listo = hueco !== null && pacienteListo && !enviando;
  const nombresProfesional = nombrePorId(profesionales);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!hueco || !listo) return;
    const paciente: PacienteDelTurno = modo === 'existente'
      ? { tipo: 'existente', pacienteId: pacienteId ?? '' }
      : { tipo: 'nuevo', datos: datosParaEnviar(nuevo) };
    setEnviando(true);
    setError(null);
    try {
      await crearTurnoRecepcion({
        paciente,
        profesionalId: hueco.profesionalId,
        prestacionId,
        inicio: hueco.inicio,
        ...(boxId ? { boxId } : {}),
      });
      navigate(`/recepcion/agenda?fecha=${fechaEnZona(hueco.inicio)}`);
    } catch (err: unknown) {
      const apiError = aErrorApi(err);
      setError(apiError);
      if (esSolapamiento(apiError)) setRecargaHuecos((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  };

  const campoNuevo = (clave: keyof DatosPacienteNuevo, etiqueta: string, tipo = 'text') => (
    <Campo
      etiqueta={etiqueta}
      type={tipo}
      value={nuevo[clave] ?? ''}
      onChange={(ev) => setNuevo({ ...nuevo, [clave]: ev.target.value })}
    />
  );

  return (
    <AppLayout titulo="Nuevo turno" subtitulo="Elegí un hueco libre: la agenda no permite turnos superpuestos." itemsExtra={ITEMS_RECEPCION}>
      <form onSubmit={confirmar} className="rc-con-resumen" noValidate>
        <div className="rc-pila">
          {error ? <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} detalles={error.detalles} /> : null}

          <section className="rc-card" aria-labelledby="rc-paso1">
            <h2 id="rc-paso1"><span className="rc-paso">1</span>Qué y con quién</h2>
            <p className="rc-hint">Todas las prestaciones activas, también las que no se reservan online.</p>
            <div className="rc-grid-3">
              <div className="rc-field">
                <label htmlFor="rc-prestacion">Prestación</label>
                <select id="rc-prestacion" className="rc-select" value={prestacionId} onChange={(e) => setPrestacionId(e.target.value)}>
                  {prestaciones.map((p) => <option key={p.id} value={p.id}>{`${p.nombre} · ${p.duracionMin} min`}</option>)}
                </select>
              </div>
              <div className="rc-field">
                <label htmlFor="rc-profesional">Profesional</label>
                <select id="rc-profesional" className="rc-select" value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)}>
                  <option value="">Cualquiera</option>
                  {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="rc-field">
                <label htmlFor="rc-dia">Día</label>
                <input id="rc-dia" className="rc-input" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rc-card" aria-labelledby="rc-paso2">
            <h2 id="rc-paso2"><span className="rc-paso">2</span>Hueco libre</h2>
            <p className="rc-hint">{`Huecos para ${prestacion?.nombre ?? 'la prestación'} el ${etiquetaDia(fecha)}.`}</p>
            <SelectorHuecos
              prestacionId={prestacionId}
              profesionalId={profesionalId}
              fecha={fecha}
              onCambiarFecha={setFecha}
              recarga={recargaHuecos}
              elegido={hueco}
              onElegir={setHueco}
              boxElegido={boxId}
              onElegirBox={setBoxId}
              nombresBox={nombrePorId(boxes)}
              nombresProfesional={nombresProfesional}
            />
          </section>

          <section className="rc-card" aria-labelledby="rc-paso3">
            <h2 id="rc-paso3"><span className="rc-paso">3</span>Paciente</h2>
            <div className="rc-tabs" role="tablist" aria-label="Tipo de paciente">
              <button type="button" role="tab" className="rc-tab" aria-selected={modo === 'existente'} onClick={() => setModo('existente')}>Paciente existente</button>
              <button type="button" role="tab" className="rc-tab" aria-selected={modo === 'nuevo'} onClick={() => setModo('nuevo')}>Paciente nuevo</button>
            </div>
            {modo === 'existente' ? (
              elegido ? (
                <div className="rc-elegido">
                  <div>
                    <strong>{`${elegido.nombre} ${elegido.apellido}`}</strong>
                    <small>{`DNI ${elegido.documento} · ${elegido.email}`}</small>
                  </div>
                  <Boton variante="fantasma" onClick={() => setPacienteId(null)}>Cambiar</Boton>
                </div>
              ) : (
                <>
                  <Campo etiqueta="Buscar paciente" type="search" placeholder="Nombre, apellido o documento" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                  {busqueda.trim() ? (
                    <ul className="rc-resultados" aria-label="Pacientes encontrados">
                      {filtrarPacientes(pacientes, busqueda).slice(0, 6).map((p) => (
                        <li key={p.id}>
                          <button type="button" className="rc-resultado" onClick={() => setPacienteId(p.id)}>
                            {`${p.nombre} ${p.apellido} · DNI ${p.documento}`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )
            ) : (
              <div className="rc-grid-2">
                {campoNuevo('nombre', 'Nombre')}
                {campoNuevo('apellido', 'Apellido')}
                {campoNuevo('documento', 'Documento')}
                {campoNuevo('email', 'Email', 'email')}
                {campoNuevo('telefono', 'Teléfono (opcional)', 'tel')}
              </div>
            )}
          </section>

          <div className="rc-acciones">
            <Boton variante="secundario" onClick={() => navigate(`/recepcion/agenda?fecha=${fecha}`)}>Cancelar</Boton>
            <Boton type="submit" disabled={!listo} cargando={enviando} textoCargando="Guardando turno…">
              {hueco ? `Confirmar turno de las ${horaEnZona(hueco.inicio)}` : 'Elegí un hueco para confirmar'}
            </Boton>
          </div>
        </div>

        <aside className="rc-card rc-resumen" aria-label="Resumen">
          <h2>Resumen</h2>
          <dl className="rc-dl">
            <dt>Prestación</dt><dd>{prestacion ? `${prestacion.nombre} · ${prestacion.duracionMin} min` : '—'}</dd>
            <dt>Profesional</dt><dd>{hueco ? nombresProfesional.get(hueco.profesionalId) : (nombresProfesional.get(profesionalId) ?? 'Cualquiera')}</dd>
            <dt>Día</dt><dd>{etiquetaDia(fecha)}</dd>
            <dt>Horario</dt><dd>{hueco ? `${horaEnZona(hueco.inicio)}–${horaEnZona(hueco.fin)}` : 'Elegí un hueco'}</dd>
            <dt>Box</dt><dd>{boxId ? (nombrePorId(boxes).get(boxId) ?? boxId) : 'Automático'}</dd>
            <dt>Paciente</dt><dd>{modo === 'existente' ? (elegido ? `${elegido.nombre} ${elegido.apellido}` : '—') : (datosNuevosCompletos ? `${nuevo.nombre} ${nuevo.apellido} (nuevo)` : '—')}</dd>
          </dl>
        </aside>
      </form>
    </AppLayout>
  );
}
