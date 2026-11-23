import { describe, expect, it } from 'vitest';
import { consultarAuditoria } from '../../src/modules/agenda/aplicacion/consultar-auditoria';
import type { AuditoriaTurno, Turno } from '../../src/shared/entidades';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { lunes, registro, turno } from './fixtures';

async function reposCon(turnos: Turno[], registros: AuditoriaTurno[]) {
  const repos = crearRepositoriosEnMemoria();
  for (const t of turnos) await repos.turnos.guardar(t);
  for (const r of registros) await repos.auditoria.agregar(r);
  return repos;
}

describe('consultarAuditoria (repositorios en memoria)', () => {
  it('Auditoría ordenada por fecha con acción, actor y detalle', async () => {
    const repos = await reposCon(
      [turno()],
      [
        registro({ id: 'cancelado', accion: 'cancelado', fecha: lunes('09:15'), actor: SEED.usuarios.anaPerez.id }),
        registro({ id: 'creado' }),
        registro({ id: 'de-otro-turno', turnoId: 'otro-turno' }),
      ],
    );
    const registros = await consultarAuditoria({ turnoId: 'turno-agenda-base' }, { repos });

    expect(registros.map((r) => [r.id, r.accion, r.actor])).toEqual([
      ['creado', 'creado', SEED.usuarios.recepcion.id],
      ['cancelado', 'cancelado', SEED.usuarios.anaPerez.id],
    ]);
  });

  it('Los registros conservan el detalle antes y después', async () => {
    const detalle = { antes: { estado: 'reservado' }, despues: { estado: 'confirmado' } };
    const repos = await reposCon([turno()], [registro({ accion: 'estado_cambiado', detalle })]);
    const [r] = await consultarAuditoria({ turnoId: 'turno-agenda-base' }, { repos });

    expect(r?.detalle).toEqual(detalle);
  });

  it('Turno sin registros devuelve una lista vacía', async () => {
    const repos = await reposCon([turno()], []);
    expect(await consultarAuditoria({ turnoId: 'turno-agenda-base' }, { repos })).toEqual([]);
  });

  it('Turno inexistente', async () => {
    const repos = await reposCon([], [registro({ turnoId: 'no-existe' })]);
    await expect(consultarAuditoria({ turnoId: 'no-existe' }, { repos })).rejects.toMatchObject({
      code: 'NO_ENCONTRADO',
    });
  });

  it('El profesional consulta la auditoría de un turno de otro profesional', async () => {
    const deBruno = turno({ id: 'turno-bruno', profesionalId: SEED.profesionales.brunoGomez.id });
    const repos = await reposCon([deBruno], [registro({ id: 'r-bruno', turnoId: 'turno-bruno' })]);

    // El caso de uso no recibe la sesión: no hay restricción de dueño (PA-09, D5).
    expect((await consultarAuditoria({ turnoId: 'turno-bruno' }, { repos })).map((r) => r.id)).toEqual(['r-bruno']);
  });
});
