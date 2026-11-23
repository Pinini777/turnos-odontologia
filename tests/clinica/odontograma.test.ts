import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import { ReglaDeNegocioError, SinPermisoError } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { UsuarioSesion } from '../../src/shared/sesion';
import {
  actualizarOdontograma,
  obtenerOdontograma,
} from '../../src/modules/clinica/aplicacion/odontograma';

const SESION_ANA: UsuarioSesion = {
  usuarioId: SEED.usuarios.anaPerez.id,
  rol: 'profesional',
  profesionalId: SEED.profesionales.anaPerez.id,
};

const SESION_BRUNO: UsuarioSesion = {
  usuarioId: SEED.usuarios.brunoGomez.id,
  rol: 'profesional',
  profesionalId: SEED.profesionales.brunoGomez.id,
};

describe('Casos de uso de odontograma (Task 3.1)', () => {
  it('consulta sin efectos secundarios cuando el paciente no tiene odontograma y lanza NO_ENCONTRADO si el paciente no existe', async () => {
    const repos = crearRepositoriosEnMemoria();

    const vista = await obtenerOdontograma(repos, SEED.pacientes.uno.id);
    expect(vista).toEqual({
      odontogramaId: null,
      pacienteId: SEED.pacientes.uno.id,
      actualizadoEn: null,
      piezas: [],
      historial: [],
    });
    expect(await repos.odontogramas.listar()).toEqual([]);

    await expect(obtenerOdontograma(repos, 'paciente-inexistente')).rejects.toThrow(
      new ReglaDeNegocioError('NO_ENCONTRADO'),
    );
  });

  it('crea el odontograma 1 a 1 en la primera actualización y actualiza incrementalmente preservando otras piezas y autores', async () => {
    const repos = crearRepositoriosEnMemoria();
    const conLockDeAgenda = crearLockDeAgenda();

    const v1 = await actualizarOdontograma(
      { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z'), conLockDeAgenda },
      SESION_ANA,
      SEED.pacientes.uno.id,
      {
        piezas: [
          { pieza: 16, cara: 'oclusal', estado: 'caries' },
          { pieza: 21, estado: 'sano' },
        ],
      },
    );

    expect(v1.odontogramaId).not.toBeNull();
    expect(v1.actualizadoEn).toEqual(new Date('2026-11-23T10:00:00.000Z'));
    expect(v1.piezas).toHaveLength(2);
    expect(v1.historial).toHaveLength(2);
    expect(v1.historial.every((e) => e.registradoPor === SEED.profesionales.anaPerez.id)).toBe(true);

    const v2 = await actualizarOdontograma(
      { repos, clock: new FixedClock('2026-11-23T11:00:00.000Z'), conLockDeAgenda },
      SESION_BRUNO,
      SEED.pacientes.uno.id,
      {
        piezas: [{ pieza: 16, cara: 'oclusal', estado: 'obturado' }],
      },
    );

    expect(v2.odontogramaId).toBe(v1.odontogramaId);
    expect(v2.actualizadoEn).toEqual(new Date('2026-11-23T11:00:00.000Z'));
    expect(v2.piezas.map((p) => ({ pieza: p.pieza, cara: p.cara, estado: p.estado }))).toEqual([
      { pieza: 16, cara: 'oclusal', estado: 'obturado' },
      { pieza: 21, cara: undefined, estado: 'sano' },
    ]);
    expect(v2.historial).toHaveLength(3);
    expect(v2.historial.map((h) => h.registradoPor)).toEqual([
      SEED.profesionales.anaPerez.id,
      SEED.profesionales.anaPerez.id,
      SEED.profesionales.brunoGomez.id,
    ]);
    expect(await repos.odontogramas.listar()).toHaveLength(1);
  });

  it('rechaza actualizarOdontograma con NO_ENCONTRADO si el paciente no existe y con SinPermisoError si falta profesionalId', async () => {
    const repos = crearRepositoriosEnMemoria();
    const deps = {
      repos,
      clock: new FixedClock('2026-11-23T10:00:00.000Z'),
      conLockDeAgenda: crearLockDeAgenda(),
    };

    await expect(
      actualizarOdontograma(deps, SESION_ANA, 'paciente-inexistente', {
        piezas: [{ pieza: 16, estado: 'sano' }],
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    const sesionSinProf: UsuarioSesion = {
      usuarioId: SEED.usuarios.anaPerez.id,
      rol: 'profesional',
    };
    await expect(
      actualizarOdontograma(deps, sesionSinProf, SEED.pacientes.uno.id, {
        piezas: [{ pieza: 16, estado: 'sano' }],
      }),
    ).rejects.toThrow(SinPermisoError);

    expect(await repos.odontogramas.listar()).toEqual([]);
  });

  it('serializa con conLockDeAgenda dos actualizaciones simultáneas sin odontograma previo creando exactamente 1 Odontograma', async () => {
    const repos = crearRepositoriosEnMemoria();
    // Demora artificial en listar para exponer cualquier carrera TOCTOU si faltara el lock
    const listarOriginal = repos.odontogramas.listar.bind(repos.odontogramas);
    repos.odontogramas.listar = async (filtro) => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return listarOriginal(filtro);
    };

    const conLockDeAgenda = crearLockDeAgenda();
    const deps = {
      repos,
      clock: new FixedClock('2026-11-23T10:00:00.000Z'),
      conLockDeAgenda,
    };

    const [r1, r2] = await Promise.all([
      actualizarOdontograma(deps, SESION_ANA, SEED.pacientes.uno.id, {
        piezas: [{ pieza: 16, estado: 'caries' }],
      }),
      actualizarOdontograma(deps, SESION_BRUNO, SEED.pacientes.uno.id, {
        piezas: [{ pieza: 21, estado: 'obturado' }],
      }),
    ]);

    expect(r1.odontogramaId).not.toBeNull();
    expect(r2.odontogramaId).toBe(r1.odontogramaId);

    const odontogramas = await repos.odontogramas.listar(
      (o) => o.pacienteId === SEED.pacientes.uno.id,
    );
    expect(odontogramas).toHaveLength(1);

    const vistaFinal = await obtenerOdontograma(repos, SEED.pacientes.uno.id);
    expect(vistaFinal.piezas.map((p) => ({ pieza: p.pieza, estado: p.estado }))).toEqual([
      { pieza: 16, estado: 'caries' },
      { pieza: 21, estado: 'obturado' },
    ]);
    expect(vistaFinal.historial).toHaveLength(2);
  });
});
