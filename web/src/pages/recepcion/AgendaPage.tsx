import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ErrorApi } from '../../base/api';
import { AppLayout } from '../../base/AppLayout';
import { AlertaErrorNegocio, BadgeEstadoTurno, Boton, EstadoVacio, SkeletonTarjetas } from '../../base/components';
import { cambiarEstadoTurno, cancelarTurno, obtenerAgenda, type TurnoAgenda } from './api';
import { aErrorApi, useCatalogos } from './comun';
import {
  accionesPara,
  agruparPorDia,
  diasDeSemana,
  etiquetaDia,
  fechaEnZona,
  horaEnZona,
  rangoDia,
  rangoSemana,
  sumarDias,
  type Accion,
} from './dominio';
import { ITEMS_RECEPCION } from './menu';
import './recepcion.css';

type Vista = 'dia' | 'semana';
type AgruparPor = 'box' | 'profesional';

const ETIQUETA_ACCION: Readonly<Record<Accion, string>> = {
  confirmar: 'Confirmar',
  atendido: 'Marcar atendido',
  ausente: 'Marcar ausente',
  reprogramar: 'Reprogramar',
  cancelar: 'Cancelar turno',
};

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const nombreCompleto = (t: TurnoAgenda) => `${t.paciente.nombre} ${t.paciente.apellido}`;

/** Agenda de la recepción (spec: agenda por día y semana, filtros, contiguos, acciones). */
export function AgendaPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const fecha = params.get('fecha') ?? fechaEnZona(new Date());
  const vista: Vista = params.get('vista') === 'semana' ? 'semana' : 'dia';
  const agruparPor: AgruparPor = params.get('por') === 'profesional' ? 'profesional' : 'box';
  const filtro = params.get('filtro') ?? '';
  const { profesionales, boxes } = useCatalogos();

  const [turnos, setTurnos] = useState<TurnoAgenda[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null);
  const [errorAccion, setErrorAccion] = useState<ErrorApi | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vigente = true;
    const rango = vista === 'semana' ? rangoSemana(fecha) : rangoDia(fecha);
    const [tipo, id] = filtro.split(':');
    setTurnos(null);
    setErrorCarga(null);
    obtenerAgenda({
      ...rango,
      ...(tipo === 'p' && id ? { profesionalId: id } : {}),
      ...(tipo === 'b' && id ? { boxId: id } : {}),
    })
      .then((lista) => vigente && setTurnos(lista))
      .catch((e: unknown) => vigente && setErrorCarga(aErrorApi(e)));
    return () => {
      vigente = false;
    };
  }, [fecha, vista, filtro, recarga]);

  const cambiar = (cambios: Readonly<Record<string, string>>) => {
    const siguientes = new URLSearchParams(params);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguientes.set(clave, valor);
      else siguientes.delete(clave);
    }
    setParams(siguientes);
  };

  const ejecutar = async (turno: TurnoAgenda, accion: Accion) => {
    if (accion === 'reprogramar') {
      navigate(`/recepcion/turnos/${encodeURIComponent(turno.id)}/reprogramar?fecha=${fechaEnZona(turno.inicio)}`, {
        state: { turno },
      });
      return;
    }
    setOcupado(true);
    setErrorAccion(null);
    try {
      if (accion === 'cancelar') await cancelarTurno(turno.id);
      else await cambiarEstadoTurno(turno.id, accion === 'confirmar' ? 'confirmado' : accion);
      setRecarga((n) => n + 1);
    } catch (e: unknown) {
      setErrorAccion(aErrorApi(e));
    } finally {
      setOcupado(false);
    }
  };

  const paso = vista === 'semana' ? 7 : 1;
  const cantidad = turnos?.length ?? 0;
  const conteo = turnos === null ? 'cargando…' : `${cantidad} ${cantidad === 1 ? 'turno' : 'turnos'}`;
  const subtitulo = vista === 'semana'
    ? `Semana del ${etiquetaDia(diasDeSemana(fecha)[0] ?? fecha)} · ${conteo}`
    : `${etiquetaDia(fecha)} · ${conteo}`;
  const irANuevo = () => navigate(`/recepcion/turnos/nuevo?fecha=${fecha}`);

  return (
    <AppLayout
      titulo="Agenda del día"
      subtitulo={subtitulo}
      itemsExtra={ITEMS_RECEPCION}
      acciones={<Boton onClick={irANuevo}>+ Nuevo turno</Boton>}
    >
      <div className="rc-toolbar">
        <div className="rc-datenav">
          <button type="button" className="rc-iconbtn" aria-label="Anterior" onClick={() => cambiar({ fecha: sumarDias(fecha, -paso) })}>‹</button>
          <span>{etiquetaDia(fecha)}</span>
          <button type="button" className="rc-iconbtn" aria-label="Siguiente" onClick={() => cambiar({ fecha: sumarDias(fecha, paso) })}>›</button>
          <Boton variante="fantasma" onClick={() => cambiar({ fecha: fechaEnZona(new Date()) })}>Hoy</Boton>
        </div>
        <div className="rc-segmented" role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista === 'dia'} onClick={() => cambiar({ vista: '' })}>Día</button>
          <button type="button" aria-pressed={vista === 'semana'} onClick={() => cambiar({ vista: 'semana' })}>Semana</button>
        </div>
        {vista === 'dia' ? (
          <div className="rc-segmented" role="group" aria-label="Agrupar por">
            <button type="button" aria-pressed={agruparPor === 'box'} onClick={() => cambiar({ por: '' })}>Por box</button>
            <button type="button" aria-pressed={agruparPor === 'profesional'} onClick={() => cambiar({ por: 'profesional' })}>Por profesional</button>
          </div>
        ) : null}
        <select className="rc-select" aria-label="Filtro" value={filtro} onChange={(e) => cambiar({ filtro: e.target.value })}>
          <option value="">Todos</option>
          <optgroup label="Profesionales">
            {profesionales.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nombre}</option>)}
          </optgroup>
          <optgroup label="Boxes">
            {boxes.map((b) => <option key={b.id} value={`b:${b.id}`}>{b.nombre}</option>)}
          </optgroup>
        </select>
      </div>

      {errorAccion ? <AlertaErrorNegocio code={errorAccion.code} mensaje={errorAccion.mensajeLegible} /> : null}
      {errorCarga ? <AlertaErrorNegocio code={errorCarga.code} mensaje={errorCarga.mensajeLegible} /> : null}

      {turnos === null && !errorCarga ? <SkeletonTarjetas cantidad={3} /> : null}
      {turnos !== null && turnos.length === 0 ? (
        <EstadoVacio
          titulo={vista === 'semana' ? 'No hay turnos esta semana' : 'No hay turnos para este día'}
          descripcion="Podés dar un turno eligiendo un hueco libre."
          accion={<Boton onClick={irANuevo}>Nuevo turno</Boton>}
        />
      ) : null}
      {turnos !== null && turnos.length > 0 && vista === 'dia' ? (
        <GrillaDia turnos={turnos} agruparPor={agruparPor} filtro={filtro} columnasCatalogo={agruparPor === 'box' ? boxes : profesionales} ocupado={ocupado} onAccion={ejecutar} />
      ) : null}
      {turnos !== null && turnos.length > 0 && vista === 'semana' ? (
        <ListaSemana fecha={fecha} turnos={turnos} ocupado={ocupado} onAccion={ejecutar} />
      ) : null}
    </AppLayout>
  );
}

interface PropsGrilla {
  readonly turnos: readonly TurnoAgenda[];
  readonly agruparPor: AgruparPor;
  readonly filtro: string;
  readonly columnasCatalogo: readonly { readonly id: string; readonly nombre: string }[];
  readonly ocupado: boolean;
  readonly onAccion: (turno: TurnoAgenda, accion: Accion) => void;
}

/** Grilla de 15 minutos con una columna por box o por profesional (mockup agenda.html). */
function GrillaDia({ turnos, agruparPor, filtro, columnasCatalogo, ocupado, onAccion }: PropsGrilla) {
  const claveDe = (t: TurnoAgenda) => (agruparPor === 'box' ? t.box : t.profesional);
  const columnas = new Map<string, string>();
  const [tipoFiltro, idFiltro] = filtro.split(':');
  const filtraEstaColumna = (tipoFiltro === 'b' && agruparPor === 'box') || (tipoFiltro === 'p' && agruparPor === 'profesional');
  for (const c of columnasCatalogo) {
    if (!filtraEstaColumna || c.id === idFiltro) columnas.set(c.id, c.nombre);
  }
  for (const t of turnos) columnas.set(claveDe(t).id, claveDe(t).nombre);
  const ids = [...columnas.keys()];

  const ordenados = [...turnos].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const inicios = ordenados.map((t) => minutos(horaEnZona(t.inicio)));
  const fines = ordenados.map((t) => minutos(horaEnZona(t.fin)));
  const base = Math.floor(Math.min(9 * 60, ...inicios) / 60) * 60;
  const tope = Math.ceil(Math.max(13 * 60, ...fines) / 60) * 60;
  const filas = (tope - base) / 15;
  const horas = Array.from({ length: (tope - base) / 60 }, (_, i) => base + i * 60);
  const estilo = { '--rc-columnas': ids.length, '--rc-filas': filas } as CSSProperties;

  return (
    <div className="rc-agenda" style={estilo} aria-label={agruparPor === 'box' ? 'Agenda por box' : 'Agenda por profesional'}>
      {ids.map((id, i) => (
        <div key={id} className="rc-agenda__cab" style={{ gridColumn: i + 2 }}>{columnas.get(id)}</div>
      ))}
      {horas.map((m) => (
        <div key={m} className="rc-agenda__hora" style={{ gridRow: `${(m - base) / 15 + 2} / span 4` }}>
          {`${String(m / 60).padStart(2, '0')}:00`}
        </div>
      ))}
      {ordenados.map((t, i) => (
        <TarjetaTurno
          key={t.id}
          turno={t}
          ocupado={ocupado}
          onAccion={onAccion}
          estilo={{
            gridColumn: ids.indexOf(claveDe(t).id) + 2,
            gridRow: `${((inicios[i] ?? base) - base) / 15 + 2} / ${((fines[i] ?? base) - base) / 15 + 2}`,
          }}
        />
      ))}
    </div>
  );
}

function ListaSemana({ fecha, turnos, ocupado, onAccion }: { readonly fecha: string; readonly turnos: readonly TurnoAgenda[]; readonly ocupado: boolean; readonly onAccion: (t: TurnoAgenda, a: Accion) => void }) {
  const porDia = agruparPorDia(turnos);
  return (
    <div className="rc-card" aria-label="Agenda de la semana">
      {diasDeSemana(fecha).map((dia) => (
        <section key={dia} className="rc-semana__dia" aria-label={etiquetaDia(dia)}>
          <h3>{etiquetaDia(dia)}</h3>
          {porDia.get(dia)?.length ? (
            <div className="rc-semana__lista">
              {porDia.get(dia)?.map((t) => <TarjetaTurno key={t.id} turno={t} ocupado={ocupado} onAccion={onAccion} />)}
            </div>
          ) : (
            <p className="rc-semana__vacio">Sin turnos</p>
          )}
        </section>
      ))}
    </div>
  );
}

interface PropsTarjeta {
  readonly turno: TurnoAgenda;
  readonly ocupado: boolean;
  readonly onAccion: (turno: TurnoAgenda, accion: Accion) => void;
  readonly estilo?: CSSProperties;
}

/**
 * Un turno con su menú de acciones. Muestra solo campos explícitos (nunca el objeto completo),
 * así un precio que llegara por error no se renderiza (design D8).
 */
function TarjetaTurno({ turno, ocupado, onAccion, estilo }: PropsTarjeta) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const acciones = accionesPara(turno.estado);
  const hora = horaEnZona(turno.inicio);
  const contenido = (
    <>
      <span className="rc-turno__fila">
        <span className="rc-turno__hora">{`${hora}–${horaEnZona(turno.fin)}`}</span>
        <BadgeEstadoTurno estado={turno.estado} />
      </span>
      <span className="rc-turno__paciente">{nombreCompleto(turno)}</span>
      <span className="rc-turno__detalle">{`${turno.prestacion.nombre} · ${turno.profesional.nombre} · ${turno.box.nombre}`}</span>
    </>
  );
  const cerrar = () => {
    setAbierto(false);
    setConfirmandoCancelacion(false);
  };

  return (
    <div className={`rc-turno rc-turno--${turno.estado}`} style={estilo} data-turno-id={turno.id}>
      {acciones.length > 0 ? (
        <button
          type="button"
          className="rc-turno__cuerpo"
          aria-expanded={abierto}
          aria-label={`Turno de las ${hora} de ${nombreCompleto(turno)}`}
          onClick={() => (abierto ? cerrar() : setAbierto(true))}
        >
          {contenido}
        </button>
      ) : (
        <div className="rc-turno__cuerpo">{contenido}</div>
      )}
      {abierto ? (
        <div className="rc-menu" role="menu" aria-label={`Acciones del turno de las ${hora}`}>
          <div className="rc-menu__titulo">{`${hora} · ${nombreCompleto(turno)}`}</div>
          {confirmandoCancelacion ? (
            <>
              <p className="rc-menu__titulo">{`¿Cancelar el turno de las ${hora}? El horario queda libre.`}</p>
              <button type="button" role="menuitem" className="rc-peligro-lleno" disabled={ocupado} onClick={() => { cerrar(); onAccion(turno, 'cancelar'); }}>
                Sí, cancelar turno
              </button>
              <button type="button" role="menuitem" onClick={() => setConfirmandoCancelacion(false)}>Volver</button>
            </>
          ) : (
            acciones.map((accion) => (
              <button
                key={accion}
                type="button"
                role="menuitem"
                className={accion === 'cancelar' ? 'rc-peligro' : undefined}
                disabled={ocupado}
                onClick={() => {
                  if (accion === 'cancelar') {
                    setConfirmandoCancelacion(true);
                    return;
                  }
                  cerrar();
                  onAccion(turno, accion);
                }}
              >
                {ETIQUETA_ACCION[accion]}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
