import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, Campo, EstadoVacio, SkeletonTabla } from '../../base/components';
import {
  actualizarBox,
  actualizarPrestacion,
  actualizarProfesional,
  crearBox,
  crearPrestacion,
  crearProfesional,
  listarBoxes,
  listarPrestaciones,
  listarProfesionales,
  type BoxApi,
  type PrestacionApi,
  type ProfesionalApi,
} from './apiProfesional';
import { formatearArs, OPCIONES_DURACION_MIN } from './formatos';
import { GuardiaProfesional } from './GuardiaProfesional';
import { MENU_PROFESIONAL } from './menuProfesional';

type TabCatalogo = 'prestaciones' | 'boxes' | 'profesionales';

function ContenidoCatalogo() {
  const [tab, setTab] = useState<TabCatalogo>('prestaciones');
  const [prestaciones, setPrestaciones] = useState<readonly PrestacionApi[]>([]);
  const [boxes, setBoxes] = useState<readonly BoxApi[]>([]);
  const [profesionales, setProfesionales] = useState<readonly ProfesionalApi[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Formulario de prestaciones
  const [editPrestId, setEditPrestId] = useState<string | null>(null);
  const [prestNombre, setPrestNombre] = useState<string>('');
  const [prestDuracion, setPrestDuracion] = useState<number>(30);
  const [prestPrecio, setPrestPrecio] = useState<string>('');
  const [prestOnline, setPrestOnline] = useState<boolean>(true);

  // Formulario de boxes
  const [editBoxId, setEditBoxId] = useState<string | null>(null);
  const [boxNombre, setBoxNombre] = useState<string>('');

  // Formulario de profesionales
  const [editProfId, setEditProfId] = useState<string | null>(null);
  const [profNombre, setProfNombre] = useState<string>('');
  const [profMatricula, setProfMatricula] = useState<string>('');
  const [profUsuarioId, setProfUsuarioId] = useState<string>('');

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setErrorApi(null);

    Promise.all([listarPrestaciones(), listarBoxes(), listarProfesionales()])
      .then(([listaPrest, listaBoxes, listaProfs]) => {
        if (!activo) return;
        setPrestaciones(listaPrest);
        setBoxes(listaBoxes);
        setProfesionales(listaProfs);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  function cambiarTab(siguiente: TabCatalogo): void {
    setTab(siguiente);
    setErrorApi(null);
    setExito(null);
  }

  function limpiarFormPrestacion(): void {
    setEditPrestId(null);
    setPrestNombre('');
    setPrestDuracion(30);
    setPrestPrecio('');
    setPrestOnline(true);
  }

  function iniciarEdicionPrestacion(item: PrestacionApi): void {
    setEditPrestId(item.id);
    setPrestNombre(item.nombre);
    setPrestDuracion(item.duracionMin);
    setPrestPrecio(String(item.precio));
    setPrestOnline(item.reservableOnline);
    setErrorApi(null);
    setExito(null);
  }

  async function handleGuardarPrestacion(e: FormEvent): Promise<void> {
    e.preventDefault();
    setErrorApi(null);
    setExito(null);
    const precioNum = Number(prestPrecio);
    if (!prestNombre.trim() || Number.isNaN(precioNum) || precioNum < 0) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }

    setGuardando(true);
    try {
      if (editPrestId) {
        const actualizada = await actualizarPrestacion(editPrestId, {
          nombre: prestNombre.trim(),
          duracionMin: prestDuracion,
          precio: precioNum,
          reservableOnline: prestOnline,
        });
        setPrestaciones((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
        setExito(`Prestación "${actualizada.nombre}" actualizada.`);
      } else {
        const creada = await crearPrestacion({
          nombre: prestNombre.trim(),
          duracionMin: prestDuracion,
          precio: precioNum,
          reservableOnline: prestOnline,
        });
        setPrestaciones((prev) => [...prev, creada]);
        setExito(`Prestación "${creada.nombre}" creada.`);
      }
      limpiarFormPrestacion();
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleTogglePrestacion(item: PrestacionApi): Promise<void> {
    setErrorApi(null);
    setExito(null);
    try {
      const actualizada = await actualizarPrestacion(item.id, { activa: !item.activa });
      setPrestaciones((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    }
  }

  function limpiarFormBox(): void {
    setEditBoxId(null);
    setBoxNombre('');
  }

  async function handleGuardarBox(e: FormEvent): Promise<void> {
    e.preventDefault();
    setErrorApi(null);
    setExito(null);
    if (!boxNombre.trim()) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }

    setGuardando(true);
    try {
      if (editBoxId) {
        const actualizado = await actualizarBox(editBoxId, { nombre: boxNombre.trim() });
        setBoxes((prev) => prev.map((b) => (b.id === actualizado.id ? actualizado : b)));
        setExito(`"${actualizado.nombre}" actualizado.`);
      } else {
        const creado = await crearBox({ nombre: boxNombre.trim() });
        setBoxes((prev) => [...prev, creado]);
        setExito(`"${creado.nombre}" creado.`);
      }
      limpiarFormBox();
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggleBox(item: BoxApi): Promise<void> {
    setErrorApi(null);
    setExito(null);
    try {
      const actualizado = await actualizarBox(item.id, { activo: !item.activo });
      setBoxes((prev) => prev.map((b) => (b.id === actualizado.id ? actualizado : b)));
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    }
  }

  function limpiarFormProfesional(): void {
    setEditProfId(null);
    setProfNombre('');
    setProfMatricula('');
    setProfUsuarioId('');
  }

  async function handleGuardarProfesional(e: FormEvent): Promise<void> {
    e.preventDefault();
    setErrorApi(null);
    setExito(null);
    if (!profNombre.trim() || !profMatricula.trim() || (!editProfId && !profUsuarioId.trim())) {
      setErrorApi(new ErrorApi(400, 'FORMATO_INVALIDO'));
      return;
    }

    setGuardando(true);
    try {
      if (editProfId) {
        const actualizado = await actualizarProfesional(editProfId, {
          nombre: profNombre.trim(),
          matricula: profMatricula.trim(),
        });
        setProfesionales((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
        setExito(`Profesional "${actualizado.nombre}" actualizado.`);
      } else {
        const creado = await crearProfesional({
          nombre: profNombre.trim(),
          matricula: profMatricula.trim(),
          usuarioId: profUsuarioId.trim(),
        });
        setProfesionales((prev) => [...prev, creado]);
        setExito(`Profesional "${creado.nombre}" agregado.`);
      }
      limpiarFormProfesional();
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    } finally {
      setGuardando(false);
    }
  }

  async function handleToggleProfesional(item: ProfesionalApi): Promise<void> {
    setErrorApi(null);
    setExito(null);
    try {
      const actualizado = await actualizarProfesional(item.id, { activo: !item.activo });
      setProfesionales((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
    } catch (err: unknown) {
      setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
    }
  }

  return (
    <AppLayout
      titulo="Catálogo y prestaciones"
      subtitulo="Administrá prestaciones con precios en ARS, boxes de atención y equipo profesional."
      itemsExtra={MENU_PROFESIONAL}
    >
      <div className="prof-stack">
        <div className="prof-tabs" role="tablist" aria-label="Secciones del catálogo">
          <button
            type="button"
            role="tab"
            id="tab-prestaciones"
            aria-selected={tab === 'prestaciones'}
            aria-controls="panel-prestaciones"
            className={['prof-tab', tab === 'prestaciones' ? 'prof-tab--activa' : ''].filter(Boolean).join(' ')}
            onClick={() => cambiarTab('prestaciones')}
          >
            Prestaciones ({prestaciones.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-boxes"
            aria-selected={tab === 'boxes'}
            aria-controls="panel-boxes"
            className={['prof-tab', tab === 'boxes' ? 'prof-tab--activa' : ''].filter(Boolean).join(' ')}
            onClick={() => cambiarTab('boxes')}
          >
            Boxes ({boxes.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-profesionales"
            aria-selected={tab === 'profesionales'}
            aria-controls="panel-profesionales"
            className={['prof-tab', tab === 'profesionales' ? 'prof-tab--activa' : ''].filter(Boolean).join(' ')}
            onClick={() => cambiarTab('profesionales')}
          >
            Profesionales ({profesionales.length})
          </button>
        </div>

        {errorApi ? (
          <AlertaErrorNegocio code={errorApi.code} detalles={errorApi.detalles} />
        ) : null}

        {exito ? (
          <div className="prof-banner-exito" role="status" aria-live="polite">
            {exito}
          </div>
        ) : null}

        {cargando ? <SkeletonTabla filas={4} /> : null}

        {!cargando && tab === 'prestaciones' ? (
          <section
            id="panel-prestaciones"
            role="tabpanel"
            aria-labelledby="tab-prestaciones"
            className="prof-grid-2"
          >
            <div className="prof-card">
              <div className="prof-card__head">
                <div>
                  <h2 className="prof-card__titulo">Prestaciones y aranceles</h2>
                  <p className="prof-card__sub">Precios visibles únicamente para el rol profesional.</p>
                </div>
              </div>

              {prestaciones.length === 0 ? (
                <EstadoVacio
                  titulo="Sin prestaciones cargadas"
                  descripcion="Creá la primera prestación desde el formulario lateral."
                />
              ) : (
                <div className="prof-tabla-wrap">
                  <table className="prof-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Prestación</th>
                        <th scope="col">Duración</th>
                        <th scope="col">Precio (ARS)</th>
                        <th scope="col">Online</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestaciones.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Prestación">{item.nombre}</td>
                          <td data-label="Duración" className="prof-num">
                            {item.duracionMin} min
                          </td>
                          <td data-label="Precio (ARS)" className="prof-num">
                            {formatearArs(item.precio)}
                          </td>
                          <td data-label="Online">{item.reservableOnline ? 'Sí' : 'No'}</td>
                          <td data-label="Estado">
                            <span
                              className={`prof-badge-estado ${item.activa ? 'prof-badge-estado--activo' : 'prof-badge-estado--inactivo'}`}
                            >
                              {item.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className="prof-acciones">
                              <Boton variante="secundario" onClick={() => iniciarEdicionPrestacion(item)}>
                                Editar
                              </Boton>
                              <Boton variante="fantasma" onClick={() => void handleTogglePrestacion(item)}>
                                {item.activa ? 'Desactivar' : 'Activar'}
                              </Boton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="prof-card">
              <div className="prof-card__head">
                <h2 className="prof-card__titulo">
                  {editPrestId ? 'Editar prestación' : 'Nueva prestación'}
                </h2>
              </div>
              <form className="prof-form" onSubmit={(e) => void handleGuardarPrestacion(e)}>
                <Campo
                  etiqueta="Nombre de la prestación"
                  value={prestNombre}
                  onChange={(e) => setPrestNombre(e.target.value)}
                  placeholder="Ej. Limpieza dental"
                  required
                />
                <div className="prof-field">
                  <label htmlFor="prest-duracion" className="prof-field__label">
                    Duración (múltiplos de 15 min)
                  </label>
                  <select
                    id="prest-duracion"
                    className="prof-select"
                    value={prestDuracion}
                    onChange={(e) => setPrestDuracion(Number(e.target.value))}
                  >
                    {OPCIONES_DURACION_MIN.map((min) => (
                      <option key={min} value={min}>
                        {min} min
                      </option>
                    ))}
                  </select>
                </div>
                <Campo
                  etiqueta="Precio en ARS"
                  type="number"
                  min={0}
                  step="0.01"
                  value={prestPrecio}
                  onChange={(e) => setPrestPrecio(e.target.value)}
                  placeholder="18000"
                  required
                />
                <label className="prof-check">
                  <input
                    type="checkbox"
                    checked={prestOnline}
                    onChange={(e) => setPrestOnline(e.target.checked)}
                  />
                  <span>Disponible para reserva online</span>
                </label>
                <div className="prof-acciones">
                  <Boton type="submit" cargando={guardando}>
                    {editPrestId ? 'Actualizar prestación' : 'Guardar prestación'}
                  </Boton>
                  {editPrestId ? (
                    <Boton variante="secundario" onClick={limpiarFormPrestacion}>
                      Cancelar
                    </Boton>
                  ) : null}
                </div>
              </form>
            </aside>
          </section>
        ) : null}

        {!cargando && tab === 'boxes' ? (
          <section id="panel-boxes" role="tabpanel" aria-labelledby="tab-boxes" className="prof-grid-2">
            <div className="prof-card">
              <div className="prof-card__head">
                <div>
                  <h2 className="prof-card__titulo">Boxes del consultorio</h2>
                  <p className="prof-card__sub">Puestos físicos habilitados para la atención odontológica.</p>
                </div>
              </div>
              {boxes.length === 0 ? (
                <EstadoVacio
                  titulo="Sin boxes registrados"
                  descripcion="Agregá el primer box para asignar turnos."
                />
              ) : (
                <div className="prof-tabla-wrap">
                  <table className="prof-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Box</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boxes.map((b) => (
                        <tr key={b.id}>
                          <td data-label="Box">{b.nombre}</td>
                          <td data-label="Estado">
                            <span
                              className={`prof-badge-estado ${b.activo ? 'prof-badge-estado--activo' : 'prof-badge-estado--inactivo'}`}
                            >
                              {b.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className="prof-acciones">
                              <Boton
                                variante="secundario"
                                onClick={() => {
                                  setEditBoxId(b.id);
                                  setBoxNombre(b.nombre);
                                  setErrorApi(null);
                                  setExito(null);
                                }}
                              >
                                Editar
                              </Boton>
                              <Boton variante="fantasma" onClick={() => void handleToggleBox(b)}>
                                {b.activo ? 'Desactivar' : 'Activar'}
                              </Boton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="prof-card">
              <div className="prof-card__head">
                <h2 className="prof-card__titulo">{editBoxId ? 'Editar box' : 'Nuevo box'}</h2>
              </div>
              <form className="prof-form" onSubmit={(e) => void handleGuardarBox(e)}>
                <Campo
                  etiqueta="Nombre del box"
                  value={boxNombre}
                  onChange={(e) => setBoxNombre(e.target.value)}
                  placeholder="Ej. Box 3"
                  required
                />
                <div className="prof-acciones">
                  <Boton type="submit" cargando={guardando}>
                    {editBoxId ? 'Actualizar box' : 'Guardar box'}
                  </Boton>
                  {editBoxId ? (
                    <Boton variante="secundario" onClick={limpiarFormBox}>
                      Cancelar
                    </Boton>
                  ) : null}
                </div>
              </form>
            </aside>
          </section>
        ) : null}

        {!cargando && tab === 'profesionales' ? (
          <section
            id="panel-profesionales"
            role="tabpanel"
            aria-labelledby="tab-profesionales"
            className="prof-grid-2"
          >
            <div className="prof-card">
              <div className="prof-card__head">
                <h2 className="prof-card__titulo">Equipo profesional</h2>
              </div>
              {profesionales.length === 0 ? (
                <EstadoVacio
                  titulo="Sin profesionales cargados"
                  descripcion="Registrá profesionales para gestionar agendas y horarios."
                />
              ) : (
                <div className="prof-tabla-wrap">
                  <table className="prof-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Profesional</th>
                        <th scope="col">Matrícula</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profesionales.map((prof) => (
                        <tr key={prof.id}>
                          <td data-label="Profesional">{prof.nombre}</td>
                          <td data-label="Matrícula" className="prof-num">
                            {prof.matricula}
                          </td>
                          <td data-label="Estado">
                            <span
                              className={`prof-badge-estado ${prof.activo ? 'prof-badge-estado--activo' : 'prof-badge-estado--inactivo'}`}
                            >
                              {prof.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className="prof-acciones">
                              <Boton
                                variante="secundario"
                                onClick={() => {
                                  setEditProfId(prof.id);
                                  setProfNombre(prof.nombre);
                                  setProfMatricula(prof.matricula);
                                  setProfUsuarioId(prof.usuarioId);
                                  setErrorApi(null);
                                  setExito(null);
                                }}
                              >
                                Editar
                              </Boton>
                              <Boton variante="fantasma" onClick={() => void handleToggleProfesional(prof)}>
                                {prof.activo ? 'Desactivar' : 'Activar'}
                              </Boton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="prof-card">
              <div className="prof-card__head">
                <h2 className="prof-card__titulo">
                  {editProfId ? 'Editar profesional' : 'Nuevo profesional'}
                </h2>
              </div>
              <form className="prof-form" onSubmit={(e) => void handleGuardarProfesional(e)}>
                <Campo
                  etiqueta="Nombre completo"
                  value={profNombre}
                  onChange={(e) => setProfNombre(e.target.value)}
                  placeholder="Ej. Dra. Ana Pérez"
                  required
                />
                <Campo
                  etiqueta="Matrícula"
                  value={profMatricula}
                  onChange={(e) => setProfMatricula(e.target.value)}
                  placeholder="Ej. MP-1003"
                  required
                />
                {!editProfId ? (
                  <Campo
                    etiqueta="ID de usuario vinculado"
                    value={profUsuarioId}
                    onChange={(e) => setProfUsuarioId(e.target.value)}
                    placeholder="Ej. u-prof-3"
                    required
                  />
                ) : null}
                <div className="prof-acciones">
                  <Boton type="submit" cargando={guardando}>
                    {editProfId ? 'Actualizar profesional' : 'Guardar profesional'}
                  </Boton>
                  {editProfId ? (
                    <Boton variante="secundario" onClick={limpiarFormProfesional}>
                      Cancelar
                    </Boton>
                  ) : null}
                </div>
              </form>
            </aside>
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function CatalogoPage() {
  return (
    <GuardiaProfesional titulo="Catálogo y prestaciones">
      <ContenidoCatalogo />
    </GuardiaProfesional>
  );
}
