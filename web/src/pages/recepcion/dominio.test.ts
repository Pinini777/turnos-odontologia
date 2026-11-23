import { describe, expect, it } from 'vitest';
import {
  accionesPara,
  agruparPorDia,
  diasDeSemana,
  etiquetaDia,
  fechaEnZona,
  filtrarPacientes,
  horaEnZona,
  rangoDia,
  rangoSemana,
  separarMananaTarde,
  sumarDias,
} from './dominio';

describe('accionesPara (tabla de acciones del spec)', () => {
  it.each([
    ['reservado', ['confirmar', 'reprogramar', 'cancelar']],
    ['confirmado', ['atendido', 'ausente', 'reprogramar', 'cancelar']],
    ['atendido', []],
    ['ausente', []],
    ['cancelado', []],
  ] as const)('%s → %j', (estado, esperadas) => {
    expect(accionesPara(estado)).toEqual(esperadas);
  });
});

describe('fechas en la zona del consultorio (UTC-3)', () => {
  it('rangoDia arma el día completo con offset -03:00', () => {
    expect(rangoDia('2026-11-24')).toEqual({
      desde: '2026-11-24T00:00:00-03:00',
      hasta: '2026-11-25T00:00:00-03:00',
    });
  });

  it('rangoSemana va del lunes al lunes siguiente, aunque se pida un martes o un domingo', () => {
    const semana = { desde: '2026-11-23T00:00:00-03:00', hasta: '2026-11-30T00:00:00-03:00' };
    expect(rangoSemana('2026-11-24')).toEqual(semana);
    expect(rangoSemana('2026-11-29')).toEqual(semana);
  });

  it('diasDeSemana devuelve los 7 días de lunes a domingo', () => {
    expect(diasDeSemana('2026-11-24')).toEqual([
      '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
    ]);
  });

  it('sumarDias cruza meses', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('horaEnZona y fechaEnZona leen un instante UTC en hora de Mendoza', () => {
    expect(horaEnZona('2026-11-24T13:30:00.000Z')).toBe('10:30');
    expect(fechaEnZona('2026-11-25T02:00:00.000Z')).toBe('2026-11-24');
  });

  it('etiquetaDia muestra día de la semana y fecha corta', () => {
    expect(etiquetaDia('2026-11-24')).toBe('Mar 24/11');
  });
});

describe('agruparPorDia', () => {
  it('agrupa por fecha local y ordena por hora de inicio', () => {
    const t = (id: string, inicio: string) => ({ id, inicio });
    const grupos = agruparPorDia([
      t('c', '2026-11-25T12:00:00.000Z'),
      t('b', '2026-11-24T14:00:00.000Z'),
      t('a', '2026-11-24T12:00:00.000Z'),
    ]);
    expect([...grupos.entries()].map(([dia, lista]) => [dia, lista.map((x) => x.id)])).toEqual([
      ['2026-11-24', ['a', 'b']],
      ['2026-11-25', ['c']],
    ]);
  });
});

describe('separarMananaTarde', () => {
  it('antes de las 14:00 es mañana; desde las 14:00, tarde', () => {
    const h = (inicio: string) => ({ inicio });
    const { manana, tarde } = separarMananaTarde([h('2026-11-24T16:30:00.000Z'), h('2026-11-24T18:00:00.000Z')]);
    expect(manana.map((x) => horaEnZona(x.inicio))).toEqual(['13:30']);
    expect(tarde.map((x) => horaEnZona(x.inicio))).toEqual(['15:00']);
  });
});

describe('filtrarPacientes', () => {
  const pacientes = [
    { nombre: 'Paciente', apellido: 'Ficticio Uno', documento: '00000001' },
    { nombre: 'Paciente', apellido: 'Ficticio Dos', documento: '00000002' },
    { nombre: 'Ramón', apellido: 'Ficticio Tres', documento: '00000003' },
  ];

  it('busca por apellido sin distinguir mayúsculas', () => {
    expect(filtrarPacientes(pacientes, 'dos').map((p) => p.apellido)).toEqual(['Ficticio Dos']);
  });

  it('busca por documento y por nombre sin tildes', () => {
    expect(filtrarPacientes(pacientes, '00000001').map((p) => p.apellido)).toEqual(['Ficticio Uno']);
    expect(filtrarPacientes(pacientes, 'ramon').map((p) => p.apellido)).toEqual(['Ficticio Tres']);
  });

  it('sin texto devuelve todos', () => {
    expect(filtrarPacientes(pacientes, '  ')).toHaveLength(3);
  });
});
