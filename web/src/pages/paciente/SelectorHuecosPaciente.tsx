import { useEffect, useMemo, useState } from 'react';
import type { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, AvatarIniciales, Boton, Skeleton } from '../../base/components';
import {
  aErrorApi,
  consultarDisponibilidadPublica,
  type HuecoDisponibleApi,
} from './apiPaciente';
import {
  deduplicarHuecosPorHora,
  fechaYmdDeIso,
  generarTiraDias,
  horaEnZona,
  PROFESIONALES_FILTRO,
  rangoVentanaDias,
  separarMananaTarde,
  sumarDiasIso,
} from './dominio';
import {
  IconoAtardecer,
  IconoCheck,
  IconoChevronDer,
  IconoChevronIzq,
  IconoEquipo,
  IconoSol,
} from './iconosPaciente';

const DIAS_POR_VENTANA = 7;

export interface PropsSelectorHuecosPaciente {
  readonly prestacionId: string;
  /** Vacío = cualquier profesional disponible. */
  readonly profesionalId: string;
  readonly onCambiarProfesional: (profesionalId: string) => void;
  readonly fecha: string;
  readonly onCambiarFecha: (nuevaFecha: string) => void;
  /** Fecha mínima navegable (`YYYY-MM-DD`). */
  readonly fechaMinima: string;
  /** Incrementar este contador vuelve a consultar los huecos libres (p. ej. tras un 409). */
  readonly recarga: number;
  readonly elegido: HuecoDisponibleApi | null;
  readonly onElegir: (hueco: HuecoDisponibleApi | null) => void;
  readonly deshabilitado?: boolean;
  /** Etiqueta de paso opcional para integrar la numeración en ReservarPage. */
  readonly mostrarNumeracionPasos?: boolean;
}

function esMismoHueco(a: HuecoDisponibleApi | null, b: HuecoDisponibleApi): boolean {
  return a !== null && a.inicio === b.inicio && a.profesionalId === b.profesionalId;
}

export function SelectorHuecosPaciente({
  prestacionId,
  profesionalId,
  onCambiarProfesional,
  fecha,
  onCambiarFecha,
  fechaMinima,
  recarga,
  elegido,
  onElegir,
  deshabilitado = false,
  mostrarNumeracionPasos = true,
}: PropsSelectorHuecosPaciente) {
  const [inicioVentana, setInicioVentana] = useState(fecha || fechaMinima);
  const [huecosVentana, setHuecosVentana] = useState<HuecoDisponibleApi[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [franjaActiva, setFranjaActiva] = useState<'manana' | 'tarde'>('manana');

  // Si la fecha elegida queda fuera de la ventana de 7 días visible, reencuadrar la tira.
  useEffect(() => {
    if (!fecha) return;
    const finVentana = sumarDiasIso(inicioVentana, DIAS_POR_VENTANA - 1);
    if (fecha < inicioVentana || fecha > finVentana) {
      setInicioVentana(fecha < fechaMinima ? fechaMinima : fecha);
    }
  }, [fecha, inicioVentana, fechaMinima]);

  useEffect(() => {
    if (!prestacionId || !inicioVentana || deshabilitado) return undefined;
    let vigente = true;
    setHuecosVentana(null);
    setError(null);
    onElegir(null);

    consultarDisponibilidadPublica({
      prestacionId,
      ...rangoVentanaDias(inicioVentana, DIAS_POR_VENTANA),
      ...(profesionalId ? { profesionalId } : {}),
    })
      .then((lista) => {
        if (vigente) setHuecosVentana(lista);
      })
      .catch((err: unknown) => {
        if (vigente) setError(aErrorApi(err));
      });

    return () => {
      vigente = false;
    };
    // onElegir se omite intencionalmente para no disparar consultas duplicadas en cada render.
  }, [prestacionId, profesionalId, inicioVentana, recarga, deshabilitado]);

  const diasTira = useMemo(() => generarTiraDias(inicioVentana, DIAS_POR_VENTANA), [inicioVentana]);

  const huecosPorDia = useMemo(() => {
    const mapa = new Map<string, HuecoDisponibleApi[]>();
    if (!huecosVentana) return mapa;
    for (const h of huecosVentana) {
      const ymd = fechaYmdDeIso(h.inicio);
      const lista = mapa.get(ymd);
      if (lista) lista.push(h);
      else mapa.set(ymd, [h]);
    }
    return mapa;
  }, [huecosVentana]);

  const huecosDelDia = useMemo(() => {
    const crudos = huecosPorDia.get(fecha) ?? [];
    return deduplicarHuecosPorHora(crudos);
  }, [huecosPorDia, fecha]);

  const { manana, tarde } = useMemo(() => separarMananaTarde(huecosDelDia), [huecosDelDia]);

  // Si la franja activa no tiene huecos pero la otra sí, alternar automáticamente.
  useEffect(() => {
    if (franjaActiva === 'manana' && manana.length === 0 && tarde.length > 0) {
      setFranjaActiva('tarde');
    } else if (franjaActiva === 'tarde' && tarde.length === 0 && manana.length > 0) {
      setFranjaActiva('manana');
    }
  }, [franjaActiva, manana.length, tarde.length]);

  const puedeRetrocederSemana = inicioVentana > fechaMinima;

  function handleSemanaAnterior(): void {
    if (!puedeRetrocederSemana || deshabilitado) return;
    const nuevaBase = sumarDiasIso(inicioVentana, -DIAS_POR_VENTANA);
    const acotada = nuevaBase < fechaMinima ? fechaMinima : nuevaBase;
    setInicioVentana(acotada);
    onCambiarFecha(acotada);
    onElegir(null);
  }

  function handleSemanaSiguiente(): void {
    if (deshabilitado) return;
    const nuevaBase = sumarDiasIso(inicioVentana, DIAS_POR_VENTANA);
    setInicioVentana(nuevaBase);
    onCambiarFecha(nuevaBase);
    onElegir(null);
  }

  function handleElegirDia(nuevaFecha: string): void {
    if (deshabilitado) return;
    onCambiarFecha(nuevaFecha);
    onElegir(null);
  }

  function handleProbarDiaSiguiente(): void {
    // Si hay un día posterior con disponibilidad dentro de esta tira, saltar directo a él.
    const proximoConHuecos = diasTira.find(
      (d) => d.fecha > fecha && (huecosPorDia.get(d.fecha)?.length ?? 0) > 0,
    );
    const destino = proximoConHuecos ? proximoConHuecos.fecha : sumarDiasIso(fecha, 1);
    onCambiarFecha(destino);
    onElegir(null);
  }

  const huecosVisibles = franjaActiva === 'manana' ? manana : tarde;

  return (
    <div className="pa-stack">
      <div className="pa-paso">
        <h2 className="pa-paso__label">
          {mostrarNumeracionPasos ? (
            <span className="pa-paso__num" aria-hidden="true">
              2
            </span>
          ) : null}
          Elegí el profesional y la fecha
        </h2>

        <div className="pa-subbloque">
          <span className="pa-subbloque__titulo">Profesional</span>
          <div className="pa-profesionales" role="group" aria-label="Elegir profesional">
            <button
              type="button"
              className="pa-prof-chip"
              aria-pressed={profesionalId === ''}
              disabled={deshabilitado}
              onClick={() => {
                onCambiarProfesional('');
                onElegir(null);
              }}
            >
              <span className="pa-prof-chip__icono">
                <IconoEquipo tamano={16} />
              </span>
              <span className="pa-prof-chip__texto">
                <strong>Cualquiera</strong>
                <span>Primer disponible</span>
              </span>
              {profesionalId === '' ? (
                <span className="pa-check-pill" aria-hidden="true">
                  <IconoCheck tamano={12} />
                </span>
              ) : null}
            </button>

            {PROFESIONALES_FILTRO.map((prof) => {
              const activo = profesionalId === prof.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  className="pa-prof-chip"
                  aria-pressed={activo}
                  disabled={deshabilitado}
                  onClick={() => {
                    onCambiarProfesional(prof.id);
                    onElegir(null);
                  }}
                >
                  <AvatarIniciales nombre={prof.nombre} tamano="sm" />
                  <span className="pa-prof-chip__texto">
                    <strong>{prof.nombre}</strong>
                    <span>Odontología</span>
                  </span>
                  {activo ? (
                    <span className="pa-check-pill" aria-hidden="true">
                      <IconoCheck tamano={12} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pa-subbloque">
          <div className="pa-tira-cabecera">
            <span className="pa-subbloque__titulo">Fecha</span>
            <div className="pa-tira-controles">
              <button
                type="button"
                className="pa-btn-flecha"
                aria-label="Semana anterior"
                disabled={!puedeRetrocederSemana || deshabilitado}
                onClick={handleSemanaAnterior}
              >
                <IconoChevronIzq tamano={16} />
              </button>
              <button
                type="button"
                className="pa-btn-flecha"
                aria-label="Semana siguiente"
                disabled={deshabilitado}
                onClick={handleSemanaSiguiente}
              >
                <IconoChevronDer tamano={16} />
              </button>
            </div>
          </div>

          <div className="pa-tira-dias" role="group" aria-label="Elegir fecha">
            {diasTira.map((d) => {
              const seleccionado = fecha === d.fecha;
              const tieneHuecos =
                huecosVentana !== null && (huecosPorDia.get(d.fecha)?.length ?? 0) > 0;
              const sinHuecosConfirmado = huecosVentana !== null && !tieneHuecos;
              return (
                <button
                  key={d.fecha}
                  type="button"
                  className={`pa-dia-pill${sinHuecosConfirmado && !seleccionado ? ' pa-dia-pill--vacio' : ''}`}
                  aria-pressed={seleccionado}
                  aria-label={`${d.etiquetaCompleta}${tieneHuecos ? ', con horarios disponibles' : ''}`}
                  disabled={deshabilitado}
                  onClick={() => handleElegirDia(d.fecha)}
                >
                  <span className="pa-dia-pill__sem">{d.diaSemana}</span>
                  <span className="pa-dia-pill__num">{d.diaNumero}</span>
                  <span className="pa-dia-pill__mes">{d.mesCorto}</span>
                  <span
                    className={`pa-dia-pill__punto${tieneHuecos ? ' pa-dia-pill__punto--activo' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pa-paso">
        <h2 className="pa-paso__label">
          {mostrarNumeracionPasos ? (
            <span className="pa-paso__num" aria-hidden="true">
              3
            </span>
          ) : null}
          Seleccioná un horario disponible
        </h2>

        {!prestacionId ? (
          <p className="pa-card__sub">Elegí primero una prestación para ver los horarios libres.</p>
        ) : error ? (
          <AlertaErrorNegocio code={error.code} mensaje={error.mensajeLegible} />
        ) : huecosVentana === null ? (
          <div className="pa-slots-skeleton" aria-label="Cargando horarios disponibles">
            <Skeleton alto="2.5rem" />
            <Skeleton alto="2.5rem" />
            <Skeleton alto="2.5rem" />
            <Skeleton alto="2.5rem" />
            <Skeleton alto="2.5rem" />
          </div>
        ) : huecosDelDia.length === 0 ? (
          <div className="pa-sin-huecos" role="status" aria-live="polite">
            <p>No hay horarios disponibles para esta fecha. Podés elegir otro día con punto verde.</p>
            <Boton variante="secundario" onClick={handleProbarDiaSiguiente}>
              Probar el día siguiente
            </Boton>
          </div>
        ) : (
          <div className="pa-horarios-panel">
            <div className="pa-tabs" role="tablist" aria-label="Franja horaria">
              <button
                type="button"
                role="tab"
                id="tab-manana"
                aria-selected={franjaActiva === 'manana'}
                aria-controls="panel-horarios"
                className="pa-tab"
                onClick={() => setFranjaActiva('manana')}
              >
                <IconoSol tamano={15} />
                <span>Mañana</span>
                <span className="pa-tab__count">{manana.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-tarde"
                aria-selected={franjaActiva === 'tarde'}
                aria-controls="panel-horarios"
                className="pa-tab"
                onClick={() => setFranjaActiva('tarde')}
              >
                <IconoAtardecer tamano={15} />
                <span>Tarde</span>
                <span className="pa-tab__count">{tarde.length}</span>
              </button>
            </div>

            <div
              id="panel-horarios"
              key={`${fecha}-${franjaActiva}`}
              role="tabpanel"
              aria-labelledby={franjaActiva === 'manana' ? 'tab-manana' : 'tab-tarde'}
              className="pa-tabpanel"
            >
              {huecosVisibles.length === 0 ? (
                <p className="pa-card__sub" style={{ margin: 0 }}>
                  No quedan horarios libres en la {franjaActiva === 'manana' ? 'mañana' : 'tarde'}{' '}
                  para este día.
                </p>
              ) : (
                <div
                  className="pa-slots-grid"
                  role="group"
                  aria-label={`Horarios de la ${franjaActiva === 'manana' ? 'mañana' : 'tarde'}`}
                >
                  {huecosVisibles.map((h) => {
                    const hora = horaEnZona(h.inicio);
                    return (
                      <button
                        key={`${h.inicio}-${h.profesionalId}`}
                        type="button"
                        className="pa-slot"
                        aria-pressed={esMismoHueco(elegido, h)}
                        onClick={() => onElegir(h)}
                      >
                        {hora}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
