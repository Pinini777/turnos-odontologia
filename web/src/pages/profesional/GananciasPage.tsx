import { useEffect, useState } from 'react';
import { AppLayout } from '../../base/AppLayout';
import { ErrorApi } from '../../base/api';
import { AlertaErrorNegocio, Boton, Campo, EstadoVacio, SkeletonTabla } from '../../base/components';
import { listarAgenda, obtenerGanancias, type TurnoAgendaApi } from './apiProfesional';
import {
  construirRangoFechasIso,
  formatearArs,
  formatearFechaHora,
  obtenerRangoMesActual,
  obtenerRangoMesAnterior,
  obtenerRangoUltimos7Dias,
} from './formatos';
import { GuardiaProfesional } from './GuardiaProfesional';
import { MENU_PROFESIONAL } from './menuProfesional';
import { useProfesionalActual } from './useProfesionalActual';

function ContenidoGanancias() {
  const { profesional, cargando: cargandoProf, error: errorProf } = useProfesionalActual();
  const mesInicial = obtenerRangoMesActual();
  const [diaDesde, setDiaDesde] = useState<string>(mesInicial.desde);
  const [diaHasta, setDiaHasta] = useState<string>(mesInicial.hasta);
  const [total, setTotal] = useState<number | null>(null);
  const [turnos, setTurnos] = useState<readonly TurnoAgendaApi[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState<boolean>(false);
  const [errorApi, setErrorApi] = useState<ErrorApi | null>(null);

  useEffect(() => {
    if (!profesional || !diaDesde || !diaHasta || diaDesde > diaHasta) return;
    let activo = true;
    const rango = construirRangoFechasIso(diaDesde, diaHasta);

    setCargandoDatos(true);
    setErrorApi(null);

    Promise.all([
      obtenerGanancias(profesional.id, rango),
      listarAgenda({ ...rango, profesionalId: profesional.id }),
    ])
      .then(([resGanancias, resAgenda]) => {
        if (!activo) return;
        setTotal(resGanancias.total);
        setTurnos(resAgenda);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setTotal(null);
        setTurnos([]);
        setErrorApi(err instanceof ErrorApi ? err : new ErrorApi(500, 'ERROR_INTERNO'));
      })
      .finally(() => {
        if (!activo) return;
        setCargandoDatos(false);
      });

    return () => {
      activo = false;
    };
  }, [profesional, diaDesde, diaHasta]);

  const atendidos = turnos.filter((t) => t.estado === 'atendido');
  const promedio = total !== null && atendidos.length > 0 ? total / atendidos.length : 0;
  const cargando = cargandoProf || cargandoDatos;
  const errorActivo = errorApi ?? errorProf;

  function aplicarAtajo(rango: { readonly desde: string; readonly hasta: string }): void {
    setDiaDesde(rango.desde);
    setDiaHasta(rango.hasta);
  }

  return (
    <AppLayout
      titulo="Mis ganancias"
      subtitulo="Resumen privado de honorarios por turnos atendidos con precio congelado al reservar."
      itemsExtra={MENU_PROFESIONAL}
      acciones={
        <span className="prof-banner-privacidad">
          Información confidencial · Solo visible para vos
        </span>
      }
    >
      <div className="prof-stack">
        <section className="prof-card" aria-label="Filtro de período">
          <div className="prof-filtros">
            <Campo
              etiqueta="Desde"
              type="date"
              value={diaDesde}
              onChange={(e) => {
                const val = e.target.value;
                setDiaDesde(val);
                if (val > diaHasta) setDiaHasta(val);
              }}
            />
            <Campo
              etiqueta="Hasta"
              type="date"
              min={diaDesde}
              value={diaHasta}
              onChange={(e) => setDiaHasta(e.target.value)}
            />
            <div className="prof-acciones">
              <Boton variante="secundario" onClick={() => aplicarAtajo(obtenerRangoMesActual())}>
                Este mes
              </Boton>
              <Boton variante="secundario" onClick={() => aplicarAtajo(obtenerRangoUltimos7Dias())}>
                Últimos 7 días
              </Boton>
              <Boton variante="secundario" onClick={() => aplicarAtajo(obtenerRangoMesAnterior())}>
                Mes anterior
              </Boton>
            </div>
          </div>
        </section>

        {errorActivo ? (
          <AlertaErrorNegocio code={errorActivo.code} detalles={errorActivo.detalles} />
        ) : null}

        {cargando ? <SkeletonTabla filas={4} /> : null}

        {!cargando && !errorActivo && total !== null ? (
          <>
            <section className="prof-kpi-grid" aria-label="Resumen de ganancias">
              <div className="prof-kpi prof-kpi--destacado">
                <span className="prof-kpi__label">Total del período</span>
                <span className="prof-kpi__valor">{formatearArs(total)}</span>
              </div>
              <div className="prof-kpi">
                <span className="prof-kpi__label">Turnos atendidos</span>
                <span className="prof-kpi__valor">{atendidos.length}</span>
              </div>
              <div className="prof-kpi">
                <span className="prof-kpi__label">Promedio por turno</span>
                <span className="prof-kpi__valor">{formatearArs(promedio)}</span>
              </div>
            </section>

            <section className="prof-card" aria-labelledby="titulo-desglose">
              <div className="prof-card__head">
                <div>
                  <h2 id="titulo-desglose" className="prof-card__titulo">
                    Desglose de turnos atendidos
                  </h2>
                  <p className="prof-card__sub">
                    Cada fila muestra el importe congelado al momento de la reserva.
                  </p>
                </div>
              </div>

              {atendidos.length === 0 ? (
                <EstadoVacio
                  titulo="Sin turnos atendidos en este período"
                  descripcion="No se registraron turnos en estado atendido dentro del rango de fechas seleccionado."
                />
              ) : (
                <div className="prof-tabla-wrap">
                  <table className="prof-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Fecha y hora</th>
                        <th scope="col">Paciente</th>
                        <th scope="col">Prestación</th>
                        <th scope="col">Box</th>
                        <th scope="col">Importe congelado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atendidos.map((turno) => (
                        <tr key={turno.id}>
                          <td data-label="Fecha y hora" className="prof-num">
                            {formatearFechaHora(turno.inicio)}
                          </td>
                          <td data-label="Paciente">
                            {turno.paciente
                              ? `${turno.paciente.nombre} ${turno.paciente.apellido}`
                              : turno.pacienteId}
                          </td>
                          <td data-label="Prestación">
                            {turno.prestacion?.nombre ?? turno.prestacionId}
                          </td>
                          <td data-label="Box">{turno.box?.nombre ?? turno.boxId}</td>
                          <td data-label="Importe congelado" className="prof-num">
                            {formatearArs(turno.precioAlReservar ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

export function GananciasPage() {
  return (
    <GuardiaProfesional titulo="Mis ganancias">
      <ContenidoGanancias />
    </GuardiaProfesional>
  );
}
