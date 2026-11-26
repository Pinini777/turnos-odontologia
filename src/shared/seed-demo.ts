import type {
  AuditoriaTurno, CaraPieza, EntradaHistoriaClinica, EstadoDePieza, EstadoPieza, EstadoTurno, Paciente, Turno, Usuario,
} from './entidades';
import type { Repositorios } from './repositorios';
import { SEED } from './seed';

/**
 * Pacientes de demostración para explorar la web (RN-DA-01: personajes de ficción, DNI 000001xx y
 * emails @example.com). Solo los carga `src/server.ts`; los tests usan únicamente `SEED`.
 * Las fechas son relativas a `ahora`, así siempre hay historial pasado y turnos próximos.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const usuarioSantos: Usuario = {
  id: id(7001), email: 'santos@example.com', rol: 'paciente', activo: true,
  // bcrypt (cost 10) de "simulador-ejemplo".
  hashPassword: '$2b$10$G9dlGi3n/9ecW74EbAB3K.0a/wpu.ZYFgKLEYuEZ9QTERQtBQDrXW',
};

const pacientes = {
  santos: { id: id(7101), usuarioId: usuarioSantos.id, nombre: 'Mario', apellido: 'Santos', documento: '00000101',
    email: 'santos@example.com', telefono: '0000-000101', obraSocial: 'Obra Social Ficticia', plan: 'Plan Simulación' },
  ravenna: { id: id(7102), nombre: 'Emilio', apellido: 'Ravenna', documento: '00000102',
    email: 'ravenna@example.com', telefono: '0000-000102', obraSocial: 'Particular' },
  medina: { id: id(7103), nombre: 'Gabriel', apellido: 'Medina', documento: '00000103',
    email: 'medina@example.com', telefono: '0000-000103', obraSocial: 'Obra Social Ficticia', plan: 'Plan Joven' },
  lamponne: { id: id(7104), nombre: 'Pablo', apellido: 'Lamponne', documento: '00000104',
    email: 'lamponne@example.com', telefono: '0000-000104', obraSocial: 'Obra Social Ficticia' },
  mafalda: { id: id(7105), nombre: 'Mafalda', apellido: 'de Quino', documento: '00000105',
    email: 'mafalda@example.com', obraSocial: 'Particular' },
  felipe: { id: id(7106), nombre: 'Felipe', apellido: 'de Quino', documento: '00000106',
    email: 'felipe@example.com', obraSocial: 'Particular' },
} satisfies Record<string, Paciente>;

type Hallazgo = readonly [pieza: number, estado: EstadoDePieza, cara?: CaraPieza];

interface Visita {
  readonly paciente: Paciente;
  readonly profesional: 'anaPerez' | 'brunoGomez';
  readonly prestacion: keyof typeof SEED.prestaciones;
  /** Semanas hacia atrás (negativo) o hacia adelante (positivo), siempre distintas entre visitas. */
  readonly semana: number;
  readonly hora: string;
  readonly estado: EstadoTurno;
  readonly nota?: string;
  readonly odontograma?: readonly Hallazgo[];
}

const { santos, ravenna, medina, lamponne, mafalda, felipe } = pacientes;

/** Cada visita cae en un horario sin solapamientos de profesional, box ni paciente; hoy (semana 0) tiene turnos para ambos profesionales y Mario Santos tiene un solo turno futuro. */
const VISITAS: readonly Visita[] = [
  // Turnos del día actual (semana: 0) para Dra. Ana Pérez (Box 1) y Dr. Bruno Gómez (Box 2).
  { paciente: ravenna, profesional: 'anaPerez', prestacion: 'consulta', semana: 0, hora: '09:00', estado: 'confirmado' },
  { paciente: mafalda, profesional: 'anaPerez', prestacion: 'control', semana: 0, hora: '10:30', estado: 'reservado' },
  { paciente: lamponne, profesional: 'brunoGomez', prestacion: 'consulta', semana: 0, hora: '09:30', estado: 'confirmado' },
  { paciente: medina, profesional: 'brunoGomez', prestacion: 'control', semana: 0, hora: '11:00', estado: 'reservado' },

  // Mario Santos: caries tratadas en dos consultas, controles al día y un único turno futuro pendiente.
  { paciente: santos, profesional: 'anaPerez', prestacion: 'consulta', semana: -20, hora: '09:00', estado: 'atendido',
    nota: 'Primera consulta. Refiere sensibilidad al frío en el sector superior derecho. Caries en 16 (oclusal) y 26 (mesial). Corona antigua en 36 en buen estado. 48 ausente.',
    odontograma: [[16, 'caries', 'oclusal'], [26, 'caries', 'mesial'], [36, 'corona'], [48, 'ausente']] },
  { paciente: santos, profesional: 'anaPerez', prestacion: 'consulta', semana: -17, hora: '10:30', estado: 'atendido',
    nota: 'Obturación de 16 oclusal con resina. Sin dolor posoperatorio inmediato.',
    odontograma: [[16, 'obturado', 'oclusal']] },
  { paciente: santos, profesional: 'anaPerez', prestacion: 'limpieza', semana: -9, hora: '11:15', estado: 'atendido',
    nota: 'Obturación de 26 mesial y limpieza completa. Buena higiene; control en seis meses.',
    odontograma: [[26, 'obturado', 'mesial']] },
  { paciente: santos, profesional: 'anaPerez', prestacion: 'control', semana: 1, hora: '09:45', estado: 'confirmado' },

  // Emilio Ravenna: tratamiento de conducto en 21, corona y extracción de cordal.
  { paciente: ravenna, profesional: 'anaPerez', prestacion: 'consulta', semana: -19, hora: '11:30', estado: 'atendido',
    nota: 'Dolor espontáneo en 21 tras un golpe. Indica endodoncia. Cordales 18 y 28 semiincluidos: evaluar extracción.',
    odontograma: [[21, 'caries', 'vestibular'], [18, 'a_extraer'], [28, 'a_extraer'], [11, 'obturado', 'distal']] },
  { paciente: ravenna, profesional: 'anaPerez', prestacion: 'consulta', semana: -15, hora: '09:00', estado: 'atendido',
    nota: 'Endodoncia de 21 terminada. Próximo paso: corona.',
    odontograma: [[21, 'endodoncia']] },
  { paciente: ravenna, profesional: 'anaPerez', prestacion: 'extraccion', semana: -11, hora: '10:00', estado: 'atendido',
    nota: 'Extracción de 18 sin complicaciones. Corona provisoria en 21.',
    odontograma: [[18, 'ausente'], [21, 'corona']] },
  { paciente: ravenna, profesional: 'anaPerez', prestacion: 'extraccion', semana: 3, hora: '11:00', estado: 'reservado' },

  // Gabriel Medina: caries profunda en 46 que terminó en conducto y corona.
  { paciente: medina, profesional: 'brunoGomez', prestacion: 'consulta', semana: -18, hora: '09:30', estado: 'atendido',
    nota: 'Caries profunda en 46 (oclusal y distal). Caries incipiente en 37 oclusal.',
    odontograma: [[46, 'caries', 'oclusal'], [46, 'caries', 'distal'], [37, 'caries', 'oclusal']] },
  { paciente: medina, profesional: 'brunoGomez', prestacion: 'consulta', semana: -14, hora: '11:00', estado: 'atendido',
    nota: 'Compromiso pulpar en 46: endodoncia. Obturación de 37 oclusal.',
    odontograma: [[46, 'endodoncia'], [37, 'obturado', 'oclusal']] },
  { paciente: medina, profesional: 'brunoGomez', prestacion: 'consulta', semana: -6, hora: '10:15', estado: 'atendido',
    nota: 'Corona definitiva en 46. Oclusión controlada.',
    odontograma: [[46, 'corona']] },
  { paciente: medina, profesional: 'brunoGomez', prestacion: 'control', semana: 4, hora: '12:00', estado: 'reservado' },

  // Pablo Lamponne: varias piezas perdidas, una extracción y un turno al que no vino.
  { paciente: lamponne, profesional: 'brunoGomez', prestacion: 'consulta', semana: -16, hora: '10:00', estado: 'atendido',
    nota: 'Ausencia de 36 y 37. Resto radicular en 47: indica extracción. Caries en 15 distal y 24 oclusal.',
    odontograma: [[36, 'ausente'], [37, 'ausente'], [47, 'a_extraer'], [15, 'caries', 'distal'], [24, 'caries', 'oclusal']] },
  { paciente: lamponne, profesional: 'brunoGomez', prestacion: 'extraccion', semana: -13, hora: '09:00', estado: 'ausente' },
  { paciente: lamponne, profesional: 'brunoGomez', prestacion: 'extraccion', semana: -10, hora: '09:30', estado: 'atendido',
    nota: 'Extracción de 47. Obturación de 15 distal en la misma sesión.',
    odontograma: [[47, 'ausente'], [15, 'obturado', 'distal']] },
  { paciente: lamponne, profesional: 'brunoGomez', prestacion: 'consulta', semana: 2, hora: '11:30', estado: 'confirmado' },

  // Mafalda: dentición mixta, caries en temporales.
  { paciente: mafalda, profesional: 'anaPerez', prestacion: 'consulta', semana: -12, hora: '09:15', estado: 'atendido',
    nota: 'Dentición mixta. Incisivos temporales 51 y 61 ya exfoliados; erupcionan 11 y 21. Caries en 54 oclusal y 74 oclusal. Se niega a hablar de la sopa.',
    odontograma: [[51, 'ausente'], [61, 'ausente'], [11, 'sano'], [21, 'sano'], [16, 'sano'], [26, 'sano'],
      [36, 'sano'], [46, 'sano'], [54, 'caries', 'oclusal'], [74, 'caries', 'oclusal']] },
  { paciente: mafalda, profesional: 'anaPerez', prestacion: 'consulta', semana: -8, hora: '10:45', estado: 'atendido',
    nota: 'Obturación de 54 y 74. Refuerzo de técnica de cepillado.',
    odontograma: [[54, 'obturado', 'oclusal'], [74, 'obturado', 'oclusal']] },
  { paciente: mafalda, profesional: 'anaPerez', prestacion: 'control', semana: 5, hora: '09:15', estado: 'reservado' },

  // Felipe: dentición mixta, resto radicular en 85 y un turno cancelado.
  { paciente: felipe, profesional: 'anaPerez', prestacion: 'consulta', semana: -7, hora: '12:00', estado: 'atendido',
    nota: 'Dentición mixta. Resto radicular en 85: indica extracción. Caries en 84 distal. 31 y 41 en erupción.',
    odontograma: [[85, 'a_extraer'], [84, 'caries', 'distal'], [31, 'sano'], [41, 'sano'], [36, 'sano'], [46, 'sano']] },
  { paciente: felipe, profesional: 'anaPerez', prestacion: 'extraccion', semana: -5, hora: '11:00', estado: 'cancelado' },
  { paciente: felipe, profesional: 'anaPerez', prestacion: 'extraccion', semana: -3, hora: '10:00', estado: 'atendido',
    nota: 'Extracción de 85 y obturación de 84 distal. Muy colaborador después de la anestesia.',
    odontograma: [[85, 'ausente'], [84, 'obturado', 'distal']] },
];

// shortcut: arma las fechas con offset fijo -03:00 (Argentina no usa horario de verano); revisar si APP_TZ cambia de país.
const OFFSET = '-03:00';

/** Día hábil (lunes a viernes) a `semanas` del día de `ahora`; el fin de semana se corre al lunes. */
function fechaVisita(ahora: Date, semanas: number, hora: string): Date {
  const hoyLocal = new Date(ahora.getTime() - 3 * 3600_000);
  const dia = new Date(Date.UTC(hoyLocal.getUTCFullYear(), hoyLocal.getUTCMonth(), hoyLocal.getUTCDate() + semanas * 7));
  const semana = dia.getUTCDay();
  if (semana === 6) dia.setUTCDate(dia.getUTCDate() + 2);
  if (semana === 0) dia.setUTCDate(dia.getUTCDate() + 1);
  return new Date(`${dia.toISOString().slice(0, 10)}T${hora}:00${OFFSET}`);
}

export const SEED_DEMO = { usuarios: [usuarioSantos], pacientes };

export function cargarSeedDemo(repos: Repositorios, ahora: Date): void {
  let n = 7200;
  const siguienteId = () => id(++n);
  const recepcion = SEED.usuarios.recepcion.id;

  // EnMemoria.guardar escribe de forma sincrónica antes de su primer await.
  void repos.usuarios.guardar(usuarioSantos);
  for (const p of Object.values(pacientes)) void repos.pacientes.guardar(p);

  const odontogramas = new Map<string, string>();
  for (const v of VISITAS) {
    const profesional = SEED.profesionales[v.profesional];
    const prestacion = SEED.prestaciones[v.prestacion];
    const inicio = fechaVisita(ahora, v.semana, v.hora);
    const fin = new Date(inicio.getTime() + prestacion.duracionMin * 60_000);
    const creadoEn = new Date(inicio.getTime() - 10 * 24 * 3600_000);
    const turno: Turno = {
      id: siguienteId(), profesionalId: profesional.id, pacienteId: v.paciente.id, prestacionId: prestacion.id,
      boxId: v.profesional === 'anaPerez' ? SEED.boxes.box1.id : SEED.boxes.box2.id,
      inicio, fin, estado: v.estado, origen: v.paciente.usuarioId ? 'online' : 'recepcion',
      precioAlReservar: prestacion.precio, creadoPor: v.paciente.usuarioId ?? recepcion, creadoEn,
    };
    void repos.turnos.guardar(turno);

    const auditoria: AuditoriaTurno[] = [
      { id: siguienteId(), turnoId: turno.id, accion: 'creado', actor: turno.creadoPor, fecha: creadoEn,
        detalle: { despues: { ...turno, estado: 'reservado' } } },
    ];
    if (v.estado === 'cancelado') {
      auditoria.push({ id: siguienteId(), turnoId: turno.id, accion: 'cancelado', actor: recepcion,
        fecha: new Date(inicio.getTime() - 2 * 24 * 3600_000),
        detalle: { antes: { estado: 'reservado' }, despues: { estado: 'cancelado' } } });
    } else if (v.estado !== 'reservado') {
      auditoria.push({ id: siguienteId(), turnoId: turno.id, accion: 'estado_cambiado',
        actor: v.estado === 'confirmado' ? recepcion : profesional.usuarioId,
        fecha: v.estado === 'confirmado' ? new Date(creadoEn.getTime() + 24 * 3600_000) : fin,
        detalle: { antes: { estado: 'reservado' }, despues: { estado: v.estado } } });
    }
    for (const a of auditoria) void repos.auditoria.agregar(a);

    if (v.nota) {
      const entrada: EntradaHistoriaClinica = {
        id: siguienteId(), pacienteId: v.paciente.id, profesionalId: profesional.id, fecha: fin, texto: v.nota, turnoId: turno.id,
      };
      void repos.historiaClinica.agregar(entrada);
    }

    if (v.odontograma) {
      let odontogramaId = odontogramas.get(v.paciente.id);
      if (!odontogramaId) {
        odontogramaId = siguienteId();
        odontogramas.set(v.paciente.id, odontogramaId);
      }
      // Mismo instante para toda la visita: la máquina del tiempo la muestra como una consulta.
      for (const [pieza, estado, cara] of v.odontograma) {
        const registro: EstadoPieza = {
          id: siguienteId(), odontogramaId, pieza, estado, registradoPor: profesional.id, fecha: fin,
          ...(cara ? { cara } : {}),
        };
        void repos.estadosPieza.agregar(registro);
      }
      void repos.odontogramas.guardar({ id: odontogramaId, pacienteId: v.paciente.id, actualizadoEn: fin });
    }
  }
}
