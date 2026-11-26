import { describe, expect, it } from 'vitest';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';
import { crearNotificador } from '../../src/modules/notificaciones/adapter';
import {
  reprogramarTurno,
  type CambiosReprogramacion,
  type DepsReprogramacion,
} from '../../src/modules/turnos-reprogramacion/aplicacion/reprogramar-turno';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import type { Notificador } from '../../src/shared/puertos';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { a, AHORA, guardarTurno } from './fixtures';

const RECEPCION = SEED.usuarios.recepcion.id;
const PEREZ = SEED.profesionales.anaPerez.id;
const GOMEZ = SEED.profesionales.brunoGomez.id;
const BOX1 = SEED.boxes.box1.id;
const BOX2 = SEED.boxes.box2.id;

/** Repos en memoria con el seed (horarios incluidos), disponibilidad real de C-03 y un notificador con bandeja. */
function armar(ahora: string = AHORA, notificador: Notificador = crearNotificador()) {
  const repos = crearRepositoriosEnMemoria();
  const deps: DepsReprogramacion = {
    repos,
    clock: new FixedClock(ahora),
    conLockDeAgenda: crearLockDeAgenda(),
    disponibilidad: crearDisponibilidad(repos),
    notificador,
  };
  return deps;
}

/** Emails enviados; vacío si el notificador del test no tiene bandeja. */
function bandejaDe(deps: DepsReprogramacion) {
  const { notificador } = deps;
  return 'bandeja' in notificador && Array.isArray(notificador.bandeja)
    ? (notificador.bandeja as ReturnType<typeof crearNotificador>['bandeja'])
    : [];
}

const mover = (deps: DepsReprogramacion, turnoId: string, cambios: CambiosReprogramacion, actor = RECEPCION) =>
  reprogramarTurno({ turnoId, cambios, actor }, deps);

async function codigoDe(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa;
    return undefined;
  } catch (e) {
    return e instanceof ReglaDeNegocioError ? e.code : 'OTRO_ERROR';
  }
}

describe('reprogramarTurno: casos felices', () => {
  it('mueve el turno a otra hora: recalcula fin y conserva id, paciente, prestación y precio', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    const turno = await mover(deps, original.id, { inicio: a('11:00') });
    expect(turno).toMatchObject({ id: original.id, inicio: a('11:00'), fin: a('11:30'), profesionalId: PEREZ, boxId: BOX1 });
    expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual({ ...original, inicio: a('11:00'), fin: a('11:30') });
  });

  it('mueve el turno a otro profesional y otro box', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    const turno = await mover(deps, original.id, { inicio: a('10:00'), profesionalId: GOMEZ, boxId: BOX2 });
    expect(turno).toMatchObject({ inicio: a('10:00'), fin: a('10:30'), profesionalId: GOMEZ, boxId: BOX2 });
  });

  it('borde: mover 15 min sobre su propio horario no choca consigo mismo', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    const turno = await mover(deps, original.id, { inicio: a('10:15') });
    expect(turno).toMatchObject({ inicio: a('10:15'), fin: a('10:45') });
  });

  it('reprogramar al mismo horario, profesional y box se acepta', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    expect(await mover(deps, original.id, { inicio: a('10:00') })).toMatchObject({ inicio: a('10:00'), fin: a('10:30') });
  });

  it('mover justo a continuación de otro turno no choca ([inicio, fin))', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    await guardarTurno(deps.repos, { id: 'otro', inicio: a('11:00'), fin: a('11:30') });
    expect(await mover(deps, original.id, { inicio: a('11:30') })).toMatchObject({ inicio: a('11:30'), fin: a('12:00') });
  });

  it('un turno cancelado no ocupa el hueco', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    await guardarTurno(deps.repos, { id: 'cancelado', estado: 'cancelado', inicio: a('11:00'), fin: a('11:30') });
    expect(await mover(deps, original.id, { inicio: a('11:00') })).toMatchObject({ inicio: a('11:00') });
  });

  it('se puede mover un turno cuyo horario original ya pasó', async () => {
    const deps = armar('2026-11-24T10:40:00-03:00');
    const original = await guardarTurno(deps.repos);
    const turno = await mover(deps, original.id, { inicio: a('10:00', '2026-11-25') });
    expect(turno).toMatchObject({ inicio: a('10:00', '2026-11-25') });
  });
});

describe('reprogramarTurno: rechazos (el turno no cambia)', () => {
  async function rechazo(
    preparar: (deps: DepsReprogramacion) => Promise<unknown>,
    cambios: CambiosReprogramacion,
    cambiosTurno: Partial<Turno> = {},
    ahora?: string,
  ) {
    const deps = armar(ahora);
    const original = await guardarTurno(deps.repos, cambiosTurno);
    await preparar(deps);
    const codigo = await codigoDe(mover(deps, original.id, cambios));
    expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
    expect(await deps.repos.auditoria.listar()).toEqual([]);
    expect(bandejaDe(deps)).toEqual([]);
    return codigo;
  }
  const nada = async () => undefined;

  it('choca con otro turno del profesional → SOLAPAMIENTO_PROFESIONAL', async () => {
    const otro = (deps: DepsReprogramacion) =>
      guardarTurno(deps.repos, { id: 'otro', boxId: BOX2, inicio: a('11:00'), fin: a('11:30') });
    expect(await rechazo(otro, { inicio: a('11:15') })).toBe('SOLAPAMIENTO_PROFESIONAL');
  });

  it('choca con otro turno del box → SOLAPAMIENTO_BOX', async () => {
    const otro = (deps: DepsReprogramacion) =>
      guardarTurno(deps.repos, { id: 'otro', profesionalId: GOMEZ, inicio: a('11:00'), fin: a('11:30') });
    expect(await rechazo(otro, { inicio: a('11:00') })).toBe('SOLAPAMIENTO_BOX');
  });

  it('Chocar con otro turno activo del mismo paciente en distinto profesional y box', async () => {
    const otro = (deps: DepsReprogramacion) =>
      guardarTurno(deps.repos, {
        id: 'otro-paciente-mismo',
        profesionalId: GOMEZ,
        boxId: BOX2,
        estado: 'confirmado',
        inicio: a('11:00'),
        fin: a('11:30'),
      });
    expect(await rechazo(otro, { inicio: a('11:15') })).toBe('SOLAPAMIENTO_PACIENTE');
  });

  it('inicio fuera de la grilla → FUERA_DE_GRILLA', async () => {
    expect(await rechazo(nada, { inicio: a('10:10') })).toBe('FUERA_DE_GRILLA');
  });

  it('inicio en el pasado → EN_EL_PASADO', async () => {
    expect(await rechazo(nada, { inicio: a('10:00', '2026-11-20') })).toBe('EN_EL_PASADO');
  });

  it('fuera del horario de atención → FUERA_DE_HORARIO', async () => {
    expect(await rechazo(nada, { inicio: a('13:30') })).toBe('FUERA_DE_HORARIO');
  });

  it('dentro de un bloqueo del box → EN_BLOQUEO', async () => {
    const bloqueo = (deps: DepsReprogramacion) =>
      deps.repos.bloqueos.guardar({ id: 'mantenimiento', boxId: BOX1, inicio: a('11:00'), fin: a('12:00'), motivo: 'Mantenimiento' });
    expect(await rechazo(bloqueo, { inicio: a('11:00') })).toBe('EN_BLOQUEO');
  });

  it('box inactivo → RECURSO_INACTIVO', async () => {
    const inactivo = (deps: DepsReprogramacion) => deps.repos.boxes.guardar({ ...SEED.boxes.box2, activo: false });
    expect(await rechazo(inactivo, { inicio: a('11:00'), boxId: BOX2 })).toBe('RECURSO_INACTIVO');
  });

  it('profesional inexistente → NO_ENCONTRADO', async () => {
    expect(await rechazo(nada, { inicio: a('11:00'), profesionalId: 'no-existe' })).toBe('NO_ENCONTRADO');
  });

  it('turno inexistente → NO_ENCONTRADO', async () => {
    expect(await codigoDe(mover(armar(), 'no-existe', { inicio: a('11:00') }))).toBe('NO_ENCONTRADO');
  });

  it.each(['cancelado', 'atendido', 'ausente'] as const)('un turno %s → TRANSICION_INVALIDA', async (estado) => {
    expect(await rechazo(nada, { inicio: a('11:00') }, { estado })).toBe('TRANSICION_INVALIDA');
  });
});

describe('reprogramarTurno: estado resultante', () => {
  it('un confirmado reprogramado vuelve a reservado', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos, { estado: 'confirmado' });
    expect((await mover(deps, original.id, { inicio: a('11:00') })).estado).toBe('reservado');
    expect((await deps.repos.turnos.buscarPorId(original.id))?.estado).toBe('reservado');
  });

  it('un reservado sigue reservado', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    expect((await mover(deps, original.id, { inicio: a('11:00') })).estado).toBe('reservado');
  });
});

describe('reprogramarTurno: auditoría (RN-TU-05)', () => {
  it('deja un único registro reprogramado con actor, fecha y antes/después completos', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos, { estado: 'confirmado' });
    await mover(deps, original.id, { inicio: a('11:00'), boxId: BOX2 });
    expect(await deps.repos.auditoria.listar()).toEqual([{
      id: expect.any(String),
      turnoId: original.id,
      accion: 'reprogramado',
      actor: RECEPCION,
      fecha: new Date(AHORA),
      detalle: {
        antes: { estado: 'confirmado', inicio: a('10:00'), fin: a('10:30'), profesionalId: PEREZ, boxId: BOX1 },
        despues: { estado: 'reservado', inicio: a('11:00'), fin: a('11:30'), profesionalId: PEREZ, boxId: BOX2 },
      },
    }]);
  });

  it('C-11 puede reprogramar con el actor "paciente"', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    await mover(deps, original.id, { inicio: a('11:00') }, 'paciente');
    expect(await deps.repos.auditoria.listar()).toEqual([expect.objectContaining({ actor: 'paciente' })]);
  });

  describe('fallas de escritura: el turno nunca cambia sin su registro', () => {
    /** Rompe cada repo desde su escritura número N (1 = la primera), contando después de guardar el turno de prueba. */
    async function armarConFallas(fallas: { auditoriaFallaDesde?: number; guardarFallaDesde?: number }) {
      const deps = armar();
      const original = await guardarTurno(deps.repos);
      const auditoriaReal = deps.repos.auditoria;
      let escrituras = 0;
      deps.repos.auditoria = {
        agregar: (registro) => {
          escrituras += 1;
          if (fallas.auditoriaFallaDesde !== undefined && escrituras >= fallas.auditoriaFallaDesde) {
            return Promise.reject(new Error('auditoría caída'));
          }
          return auditoriaReal.agregar(registro);
        },
        listar: auditoriaReal.listar,
      };
      const guardarReal = deps.repos.turnos.guardar.bind(deps.repos.turnos);
      let guardados = 0;
      deps.repos.turnos.guardar = (turno) => {
        guardados += 1;
        if (fallas.guardarFallaDesde !== undefined && guardados >= fallas.guardarFallaDesde) {
          return Promise.reject(new Error('turnos caído'));
        }
        return guardarReal(turno);
      };
      return { deps, original };
    }

    it('falla la auditoría: propaga el error, el turno no cambia y no se envía email', async () => {
      const { deps, original } = await armarConFallas({ auditoriaFallaDesde: 1 });
      await expect(mover(deps, original.id, { inicio: a('11:00') })).rejects.toThrow('auditoría caída');
      expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
      expect(await deps.repos.auditoria.listar()).toEqual([]);
      expect(bandejaDe(deps)).toEqual([]);
    });

    it('falla guardar: propaga el error, el turno no cambia y queda el intento más su reversión', async () => {
      const { deps, original } = await armarConFallas({ guardarFallaDesde: 1 });
      await expect(mover(deps, original.id, { inicio: a('11:00') })).rejects.toThrow('turnos caído');
      expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
      const [intento, reversion] = await deps.repos.auditoria.listar();
      expect(intento).toMatchObject({ accion: 'reprogramado', detalle: { despues: { inicio: a('11:00') } } });
      expect(reversion).toMatchObject({
        accion: 'reprogramado',
        detalle: { antes: { inicio: a('11:00') }, despues: { inicio: a('10:00') }, revertido: true },
      });
      expect(bandejaDe(deps)).toEqual([]);
    });

    it('fallan guardar y la reversión: el turno no cambia y queda auditado el intento', async () => {
      const { deps, original } = await armarConFallas({ guardarFallaDesde: 1, auditoriaFallaDesde: 2 });
      await expect(mover(deps, original.id, { inicio: a('11:00') })).rejects.toThrow('turnos caído');
      expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
      expect(await deps.repos.auditoria.listar()).toEqual([expect.objectContaining({ accion: 'reprogramado' })]);
    });
  });
});

describe('reprogramarTurno: email de confirmación (RN-NO-01)', () => {
  it('reenvía el email con el nuevo horario y sin precio', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos);
    await mover(deps, original.id, { inicio: a('11:00') });
    const [email] = bandejaDe(deps);
    expect(email?.para).toBe('paciente1@example.com');
    for (const dato of ['24/11/2026', '11:00', 'Dra. Ana Pérez', 'Box 1', 'Consulta']) {
      expect(`${email?.asunto}\n${email?.texto}`).toContain(dato);
    }
    expect(JSON.stringify(email)).not.toContain('15000');
  });

  it('si el envío falla, la reprogramación queda hecha', async () => {
    const deps = armar(AHORA, { enviar: () => Promise.reject(new Error('SMTP caído')) });
    const original = await guardarTurno(deps.repos);
    expect(await mover(deps, original.id, { inicio: a('11:00') })).toMatchObject({ inicio: a('11:00') });
    expect((await deps.repos.turnos.buscarPorId(original.id))?.inicio).toEqual(a('11:00'));
  });
});

describe('reprogramarTurno: concurrencia', () => {
  it('dos reprogramaciones simultáneas al mismo hueco: una se aplica y la otra da SOLAPAMIENTO_PROFESIONAL', async () => {
    const deps = armar();
    await guardarTurno(deps.repos, { id: 'de-las-10' });
    await guardarTurno(deps.repos, { id: 'de-las-12', inicio: a('12:00'), fin: a('12:30') });
    const resultados = await Promise.all([
      codigoDe(mover(deps, 'de-las-10', { inicio: a('11:00') })),
      codigoDe(mover(deps, 'de-las-12', { inicio: a('11:00') })),
    ]);
    expect(resultados.sort()).toEqual(['SOLAPAMIENTO_PROFESIONAL', undefined]);
    const en11 = await deps.repos.turnos.listar((t) => t.inicio.getTime() === a('11:00').getTime());
    expect(en11).toHaveLength(1);
  });
});
