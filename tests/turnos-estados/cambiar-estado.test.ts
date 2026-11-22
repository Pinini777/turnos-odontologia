import { describe, expect, it } from 'vitest';
import { cambiarEstado, cancelarTurno } from '../../src/modules/turnos-estados/aplicacion/cambiar-estado';
import { FixedClock } from '../../src/shared/clock';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { guardarTurno, HORA } from './fixtures';

const RECEPCION = SEED.usuarios.recepcion.id;

function armar(hora: string = HORA.ochoYMedia) {
  const repos = crearRepositoriosEnMemoria();
  return { repos, clock: new FixedClock(hora), conLockDeAgenda: crearLockDeAgenda() };
}

async function codigoDe(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa;
    return undefined;
  } catch (e) {
    return e instanceof ReglaDeNegocioError ? e.code : 'OTRO_ERROR';
  }
}

describe('cancelarTurno', () => {
  it('cancela un turno reservado y lo devuelve en estado cancelado', async () => {
    const deps = armar();
    await guardarTurno(deps.repos, 'reservado');
    const turno = await cancelarTurno({ turnoId: 'turno-reservado', actor: RECEPCION }, deps);
    expect(turno.estado).toBe('cancelado');
  });

  it('no borra: el turno sigue guardado con los mismos datos y estado cancelado', async () => {
    const deps = armar();
    const original = await guardarTurno(deps.repos, 'reservado');
    await cancelarTurno({ turnoId: original.id, actor: RECEPCION }, deps);
    expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual({ ...original, estado: 'cancelado' });
  });

  it('cancela un turno confirmado que ya pasó (sin restricción horaria)', async () => {
    const deps = armar(HORA.onceYMedia);
    await guardarTurno(deps.repos, 'confirmado');
    const turno = await cancelarTurno({ turnoId: 'turno-confirmado', actor: RECEPCION }, deps);
    expect(turno.estado).toBe('cancelado');
  });

  it.each(['cancelado', 'atendido', 'ausente'] as const)('un turno %s da TRANSICION_INVALIDA y no cambia', async (estado) => {
    const deps = armar();
    await guardarTurno(deps.repos, estado);
    expect(await codigoDe(cancelarTurno({ turnoId: `turno-${estado}`, actor: RECEPCION }, deps))).toBe('TRANSICION_INVALIDA');
    expect((await deps.repos.turnos.buscarPorId(`turno-${estado}`))?.estado).toBe(estado);
  });

  it('un turno inexistente da NO_ENCONTRADO', async () => {
    expect(await codigoDe(cancelarTurno({ turnoId: 'no-existe', actor: RECEPCION }, armar()))).toBe('NO_ENCONTRADO');
  });
});

describe('cambiarEstado', () => {
  const PROFESIONAL = SEED.usuarios.anaPerez.id;

  it('confirma un turno reservado una semana antes', async () => {
    const deps = armar(HORA.unaSemanaAntes);
    await guardarTurno(deps.repos, 'reservado');
    const turno = await cambiarEstado({ turnoId: 'turno-reservado', estado: 'confirmado', actor: RECEPCION }, deps);
    expect(turno.estado).toBe('confirmado');
    expect((await deps.repos.turnos.buscarPorId('turno-reservado'))?.estado).toBe('confirmado');
  });

  it.each(['atendido', 'ausente'] as const)('marca %s un turno confirmado que ya empezó', async (estado) => {
    const deps = armar(HORA.diezYDiez);
    await guardarTurno(deps.repos, 'confirmado');
    const turno = await cambiarEstado({ turnoId: 'turno-confirmado', estado, actor: PROFESIONAL }, deps);
    expect(turno.estado).toBe(estado);
  });

  it('atender un confirmado antes del inicio da TRANSICION_INVALIDA y no cambia', async () => {
    const deps = armar(HORA.nueveCincuentaYNueve);
    await guardarTurno(deps.repos, 'confirmado');
    expect(await codigoDe(cambiarEstado({ turnoId: 'turno-confirmado', estado: 'atendido', actor: PROFESIONAL }, deps)))
      .toBe('TRANSICION_INVALIDA');
    expect((await deps.repos.turnos.buscarPorId('turno-confirmado'))?.estado).toBe('confirmado');
  });

  it('borde: marcar ausente justo a la hora de inicio se permite', async () => {
    const deps = armar(HORA.diez);
    await guardarTurno(deps.repos, 'confirmado');
    const turno = await cambiarEstado({ turnoId: 'turno-confirmado', estado: 'ausente', actor: RECEPCION }, deps);
    expect(turno.estado).toBe('ausente');
  });

  it('reservado → atendido da TRANSICION_INVALIDA aunque ya empezó', async () => {
    const deps = armar(HORA.diezYDiez);
    await guardarTurno(deps.repos, 'reservado');
    expect(await codigoDe(cambiarEstado({ turnoId: 'turno-reservado', estado: 'atendido', actor: PROFESIONAL }, deps)))
      .toBe('TRANSICION_INVALIDA');
  });

  it('un turno inexistente da NO_ENCONTRADO', async () => {
    expect(await codigoDe(cambiarEstado({ turnoId: 'no-existe', estado: 'confirmado', actor: RECEPCION }, armar())))
      .toBe('NO_ENCONTRADO');
  });
});

describe('Auditoría de cada cambio de estado (RN-TU-05)', () => {
  const auditoriaDe = (deps: ReturnType<typeof armar>, turnoId: string) =>
    deps.repos.auditoria.listar((r) => r.turnoId === turnoId);

  it('cancelar deja un registro cancelado con actor, fecha y estados antes y después', async () => {
    const deps = armar(HORA.ochoYMedia);
    await guardarTurno(deps.repos, 'confirmado');
    await cancelarTurno({ turnoId: 'turno-confirmado', actor: RECEPCION }, deps);
    expect(await auditoriaDe(deps, 'turno-confirmado')).toEqual([{
      id: expect.any(String),
      turnoId: 'turno-confirmado',
      accion: 'cancelado',
      actor: RECEPCION,
      fecha: new Date(HORA.ochoYMedia),
      detalle: { antes: { estado: 'confirmado' }, despues: { estado: 'cancelado' } },
    }]);
  });

  it('cambiar el estado deja un registro estado_cambiado con el actor que lo hizo', async () => {
    const deps = armar(HORA.unaSemanaAntes);
    const profesional = SEED.usuarios.anaPerez.id;
    await guardarTurno(deps.repos, 'reservado');
    await cambiarEstado({ turnoId: 'turno-reservado', estado: 'confirmado', actor: profesional }, deps);
    expect(await auditoriaDe(deps, 'turno-reservado')).toEqual([expect.objectContaining({
      accion: 'estado_cambiado',
      actor: profesional,
      fecha: new Date(HORA.unaSemanaAntes),
      detalle: { antes: { estado: 'reservado' }, despues: { estado: 'confirmado' } },
    })]);
  });

  it('C-11 puede cancelar con el actor "paciente"', async () => {
    const deps = armar();
    await guardarTurno(deps.repos, 'reservado');
    await cancelarTurno({ turnoId: 'turno-reservado', actor: 'paciente' }, deps);
    expect(await auditoriaDe(deps, 'turno-reservado')).toEqual([expect.objectContaining({ actor: 'paciente' })]);
  });

  it('un rechazo no deja auditoría: cancelar dos veces deja un solo registro', async () => {
    const deps = armar();
    await guardarTurno(deps.repos, 'reservado');
    await cancelarTurno({ turnoId: 'turno-reservado', actor: RECEPCION }, deps);
    expect(await codigoDe(cancelarTurno({ turnoId: 'turno-reservado', actor: RECEPCION }, deps))).toBe('TRANSICION_INVALIDA');
    expect(await auditoriaDe(deps, 'turno-reservado')).toHaveLength(1);
  });

  describe('si falla la escritura de auditoría, el turno no queda cambiado', () => {
    /** Repos en memoria reales, con una auditoría que rechaza cada escritura. */
    function armarConAuditoriaRota(hora: string = HORA.diezYDiez) {
      const deps = armar(hora);
      deps.repos.auditoria = {
        agregar: () => Promise.reject(new Error('auditoría caída')),
        listar: deps.repos.auditoria.listar,
      };
      return deps;
    }

    it('cancelarTurno propaga el error y el turno sigue reservado', async () => {
      const deps = armarConAuditoriaRota();
      const original = await guardarTurno(deps.repos, 'reservado');
      await expect(cancelarTurno({ turnoId: original.id, actor: RECEPCION }, deps)).rejects.toThrow('auditoría caída');
      expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
    });

    it('cambiarEstado propaga el error y el turno sigue confirmado', async () => {
      const deps = armarConAuditoriaRota();
      const original = await guardarTurno(deps.repos, 'confirmado');
      await expect(cambiarEstado({ turnoId: original.id, estado: 'atendido', actor: RECEPCION }, deps))
        .rejects.toThrow('auditoría caída');
      expect(await deps.repos.turnos.buscarPorId(original.id)).toEqual(original);
    });
  });

  it('un cambio de estado rechazado por la hora no deja auditoría', async () => {
    const deps = armar(HORA.nueveCincuentaYNueve);
    await guardarTurno(deps.repos, 'confirmado');
    await codigoDe(cambiarEstado({ turnoId: 'turno-confirmado', estado: 'atendido', actor: RECEPCION }, deps));
    expect(await auditoriaDe(deps, 'turno-confirmado')).toEqual([]);
  });
});
