import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import type { Turno } from '../../src/shared/entidades';
import { ReglaDeNegocioError, SinPermisoError } from '../../src/shared/errores';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import type { UsuarioSesion } from '../../src/shared/sesion';
import {
  agregarEntradaHistoria,
  listarHistoriaClinica,
} from '../../src/modules/clinica/aplicacion/historia';

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

function turnoFicticio(id: string, pacienteId: string): Turno {
  return {
    id,
    profesionalId: SEED.profesionales.anaPerez.id,
    boxId: SEED.boxes.box1.id,
    prestacionId: SEED.prestaciones.consulta.id,
    pacienteId,
    inicio: new Date('2026-11-23T12:00:00.000Z'),
    fin: new Date('2026-11-23T12:30:00.000Z'),
    estado: 'reservado',
    origen: 'profesional',
    precioAlReservar: 15000,
    creadoPor: SEED.usuarios.anaPerez.id,
    creadoEn: new Date('2026-11-23T09:00:00.000Z'),
  };
}

describe('Casos de uso de historia clínica (Task 2.1)', () => {
  it('lista arreglo vacío para paciente existente sin entradas y rechaza con NO_ENCONTRADO si el paciente no existe', async () => {
    const repos = crearRepositoriosEnMemoria();

    await expect(listarHistoriaClinica(repos, SEED.pacientes.dos.id)).resolves.toEqual([]);
    await expect(listarHistoriaClinica(repos, 'paciente-inexistente')).rejects.toThrow(
      new ReglaDeNegocioError('NO_ENCONTRADO'),
    );
  });

  it('registra evolución recortando texto, sellando profesionalId desde sesión y fecha desde clock, y lista en orden cronológico + empates', async () => {
    const repos = crearRepositoriosEnMemoria();
    let seq = 0;
    const generarId = () => `hc-ficticia-${++seq}`;

    const e2 = await agregarEntradaHistoria(
      { repos, clock: new FixedClock('2026-11-23T11:00:00.000Z'), generarId },
      SESION_ANA,
      SEED.pacientes.uno.id,
      { texto: '  Control de evolución posterior.  ' },
    );
    const e1a = await agregarEntradaHistoria(
      { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z'), generarId },
      SESION_ANA,
      SEED.pacientes.uno.id,
      { texto: 'Primera nota del mismo instante.' },
    );
    const e1b = await agregarEntradaHistoria(
      { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z'), generarId },
      SESION_BRUNO,
      SEED.pacientes.uno.id,
      { texto: 'Segunda nota del mismo instante.' },
    );

    expect(e2).toEqual({
      id: 'hc-ficticia-1',
      pacienteId: SEED.pacientes.uno.id,
      profesionalId: SEED.profesionales.anaPerez.id,
      fecha: new Date('2026-11-23T11:00:00.000Z'),
      texto: 'Control de evolución posterior.',
    });

    const lista = await listarHistoriaClinica(repos, SEED.pacientes.uno.id);
    expect(lista.map((e) => e.id)).toEqual([e1a.id, e1b.id, e2.id]);
    expect(lista.map((e) => e.profesionalId)).toEqual([
      SEED.profesionales.anaPerez.id,
      SEED.profesionales.brunoGomez.id,
      SEED.profesionales.anaPerez.id,
    ]);
  });

  it('vincula turnoId y corrigeAId válidos del mismo paciente (incluyendo correcciones de otro profesional)', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.turnos.guardar(turnoFicticio('turno-ficticio-1', SEED.pacientes.uno.id));

    const original = await agregarEntradaHistoria(
      { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z') },
      SESION_ANA,
      SEED.pacientes.uno.id,
      { texto: 'Evolución inicial vinculada al turno.', turnoId: 'turno-ficticio-1' },
    );
    expect(original.turnoId).toBe('turno-ficticio-1');

    const correccion = await agregarEntradaHistoria(
      { repos, clock: new FixedClock('2026-11-23T10:30:00.000Z') },
      SESION_BRUNO,
      SEED.pacientes.uno.id,
      { texto: 'Aclaración de pieza registrada por colega.', corrigeAId: original.id },
    );
    expect(correccion.corrigeAId).toBe(original.id);
    expect(correccion.profesionalId).toBe(SEED.profesionales.brunoGomez.id);

    const lista = await listarHistoriaClinica(repos, SEED.pacientes.uno.id);
    expect(lista).toHaveLength(2);
    expect(lista[0]?.texto).toBe('Evolución inicial vinculada al turno.');
    expect(lista[0]?.profesionalId).toBe(SEED.profesionales.anaPerez.id);
    expect(lista[1]?.corrigeAId).toBe(original.id);
  });

  it('rechaza con NO_ENCONTRADO cuando paciente, turnoId o corrigeAId no existen o pertenecen a otro paciente, sin persistir', async () => {
    const repos = crearRepositoriosEnMemoria();
    const deps = { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z') };

    await repos.turnos.guardar(turnoFicticio('turno-otro', SEED.pacientes.dos.id));
    const entradaOtro = await agregarEntradaHistoria(deps, SESION_ANA, SEED.pacientes.dos.id, {
      texto: 'Nota del paciente dos.',
    });

    await expect(
      agregarEntradaHistoria(deps, SESION_ANA, 'paciente-inexistente', { texto: 'Nota válida.' }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      agregarEntradaHistoria(deps, SESION_ANA, SEED.pacientes.uno.id, {
        texto: 'Nota con turno inexistente.',
        turnoId: 'turno-inexistente',
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      agregarEntradaHistoria(deps, SESION_ANA, SEED.pacientes.uno.id, {
        texto: 'Nota con turno ajeno.',
        turnoId: 'turno-otro',
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      agregarEntradaHistoria(deps, SESION_ANA, SEED.pacientes.uno.id, {
        texto: 'Nota con corrección inexistente.',
        corrigeAId: 'hc-inexistente',
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    await expect(
      agregarEntradaHistoria(deps, SESION_ANA, SEED.pacientes.uno.id, {
        texto: 'Nota corrigiendo entrada ajena.',
        corrigeAId: entradaOtro.id,
      }),
    ).rejects.toThrow(new ReglaDeNegocioError('NO_ENCONTRADO'));

    expect(await listarHistoriaClinica(repos, SEED.pacientes.uno.id)).toEqual([]);
  });

  it('lanza SinPermisoError defensivamente si falta profesionalId en la sesión', async () => {
    const repos = crearRepositoriosEnMemoria();
    const sesionSinProfesional: UsuarioSesion = {
      usuarioId: SEED.usuarios.anaPerez.id,
      rol: 'profesional',
    };

    await expect(
      agregarEntradaHistoria(
        { repos, clock: new FixedClock('2026-11-23T10:00:00.000Z') },
        sesionSinProfesional,
        SEED.pacientes.uno.id,
        { texto: 'Evolución sin profesionalId.' },
      ),
    ).rejects.toThrow(SinPermisoError);
  });
});
