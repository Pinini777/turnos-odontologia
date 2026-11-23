import { describe, expect, it } from 'vitest';
import { ReglaDeNegocioError } from '../../src/shared/errores';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { enZonaConsultorio } from '../../src/shared/zona';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';
import {
  esHoraEnGrilla15,
  estaDentroDeHorario,
  haySolapamientoIntervalos,
  validarDuracionPrestacion,
  validarFranjaHorarioEnGrilla,
} from '../../src/modules/configuracion/dominio/reglas';

describe('Dominio puro de configuración (reglas.ts)', () => {
  describe('validarDuracionPrestacion', () => {
    it.each([15, 30, 45, 60, 120])('acepta duración positiva múltiplo de 15 (%i min)', (duracionMin) => {
      expect(() => validarDuracionPrestacion(duracionMin)).not.toThrow();
    });

    it.each([0, -15, 10, 20, 15.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rechaza duración inválida (%s) con DURACION_INVALIDA',
      (duracionMin) => {
        expect(() => validarDuracionPrestacion(duracionMin)).toThrow(ReglaDeNegocioError);
        try {
          validarDuracionPrestacion(duracionMin);
        } catch (err) {
          expect(err).toBeInstanceOf(ReglaDeNegocioError);
          expect((err as ReglaDeNegocioError).code).toBe('DURACION_INVALIDA');
        }
      },
    );
  });

  describe('esHoraEnGrilla15 y validarFranjaHorarioEnGrilla', () => {
    it.each(['00:00', '09:00', '09:15', '12:30', '18:45', '23:45'])(
      'reconoce hora válida en grilla de 15 minutos (%s)',
      (hhmm) => {
        expect(esHoraEnGrilla15(hhmm)).toBe(true);
      },
    );

    it.each(['09:10', '12:20', '09:05', '24:00', '9:00', '25:00', 'ab:cd', ''])(
      'rechaza hora fuera de grilla o con formato inválido (%s)',
      (hhmm) => {
        expect(esHoraEnGrilla15(hhmm)).toBe(false);
      },
    );

    it('acepta una franja con ambos extremos en grilla de 15 minutos', () => {
      expect(() => validarFranjaHorarioEnGrilla('09:00', '12:30')).not.toThrow();
      expect(() => validarFranjaHorarioEnGrilla('15:15', '18:45')).not.toThrow();
    });

    it('lanza FUERA_DE_GRILLA cuando desde no está en grilla', () => {
      expect(() => validarFranjaHorarioEnGrilla('09:10', '12:30')).toThrow(
        new ReglaDeNegocioError('FUERA_DE_GRILLA'),
      );
    });

    it('lanza FUERA_DE_GRILLA cuando hasta no está en grilla', () => {
      expect(() => validarFranjaHorarioEnGrilla('09:00', '12:20')).toThrow(
        new ReglaDeNegocioError('FUERA_DE_GRILLA'),
      );
    });
  });

  describe('haySolapamientoIntervalos', () => {
    it('detecta solapamiento parcial y contenido', () => {
      const aInicio = new Date('2026-11-23T13:15:00Z');
      const aFin = new Date('2026-11-23T13:45:00Z');
      const bInicio = new Date('2026-11-23T13:00:00Z');
      const bFin = new Date('2026-11-23T14:00:00Z');

      expect(haySolapamientoIntervalos(aInicio, aFin, bInicio, bFin)).toBe(true);
      expect(haySolapamientoIntervalos(bInicio, bFin, aInicio, aFin)).toBe(true);
    });

    it('no detecta solapamiento en bordes semiabiertos contiguos [inicio, fin)', () => {
      const primeroInicio = new Date('2026-11-23T13:00:00Z');
      const primeroFin = new Date('2026-11-23T13:30:00Z');
      const segundoInicio = new Date('2026-11-23T13:30:00Z');
      const segundoFin = new Date('2026-11-23T14:00:00Z');

      expect(haySolapamientoIntervalos(primeroInicio, primeroFin, segundoInicio, segundoFin)).toBe(false);
      expect(haySolapamientoIntervalos(segundoInicio, segundoFin, primeroInicio, primeroFin)).toBe(false);
    });
  });

  describe('estaDentroDeHorario', () => {
    const franjas = [
      { desde: '09:00', hasta: '13:00' },
      { desde: '15:00', hasta: '19:00' },
    ];

    it('acepta intervalo contenido exactamente en una franja', () => {
      const inicio = new Date('2026-11-23T12:00:00Z'); // lunes 09:00 Mendoza
      const fin = new Date('2026-11-23T16:00:00Z'); // lunes 13:00 Mendoza
      expect(
        estaDentroDeHorario(inicio, fin, enZonaConsultorio(inicio), enZonaConsultorio(fin), franjas),
      ).toBe(true);
    });

    it('rechaza si fin excede el límite de la franja por segundos o milisegundos', () => {
      const inicio = new Date('2026-11-23T15:30:00Z'); // lunes 12:30:00 Mendoza
      const finConSegundo = new Date('2026-11-23T16:00:01Z'); // lunes 13:00:01 Mendoza
      const finConMilisegundo = new Date('2026-11-23T16:00:00.001Z'); // lunes 13:00:00.001 Mendoza

      expect(
        estaDentroDeHorario(
          inicio,
          finConSegundo,
          enZonaConsultorio(inicio),
          enZonaConsultorio(finConSegundo),
          franjas,
        ),
      ).toBe(false);
      expect(
        estaDentroDeHorario(
          inicio,
          finConMilisegundo,
          enZonaConsultorio(inicio),
          enZonaConsultorio(finConMilisegundo),
          franjas,
        ),
      ).toBe(false);
    });

    it('rechaza si inicio >= fin o si cruza de fecha en APP_TZ', () => {
      const mismo = new Date('2026-11-23T12:00:00Z');
      expect(
        estaDentroDeHorario(mismo, mismo, enZonaConsultorio(mismo), enZonaConsultorio(mismo), franjas),
      ).toBe(false);

      const antesMedianoche = new Date('2026-11-24T02:45:00Z'); // lunes 23:45 Mendoza
      const despuesMedianoche = new Date('2026-11-24T03:15:00Z'); // martes 00:15 Mendoza
      expect(
        estaDentroDeHorario(
          antesMedianoche,
          despuesMedianoche,
          enZonaConsultorio(antesMedianoche),
          enZonaConsultorio(despuesMedianoche),
          [{ desde: '00:00', hasta: '23:45' }],
        ),
      ).toBe(false);
    });
  });
});

describe('Verificación real de disponibilidad (crearDisponibilidad)', () => {
  const anaId = SEED.profesionales.anaPerez.id;
  const brunoId = SEED.profesionales.brunoGomez.id;
  const box1Id = SEED.boxes.box1.id;
  const box2Id = SEED.boxes.box2.id;

  it('devuelve null para un turno dentro del horario semilla (lunes 09:00–09:30 Mendoza) sin bloqueos', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T12:00:00Z'), // lunes 09:00 Mendoza
      fin: new Date('2026-11-23T12:30:00Z'), // lunes 09:30 Mendoza
    });

    expect(motivo).toBeNull();
  });

  it('devuelve null para un turno en la franja de tarde semilla (lunes 15:00–19:00 Mendoza)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T18:00:00Z'), // lunes 15:00 Mendoza
      fin: new Date('2026-11-23T22:00:00Z'), // lunes 19:00 Mendoza
    });

    expect(motivo).toBeNull();
  });

  it('devuelve FUERA_DE_HORARIO en hueco entre franjas (lunes 13:30–14:00 Mendoza)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T16:30:00Z'), // lunes 13:30 Mendoza
      fin: new Date('2026-11-23T17:00:00Z'), // lunes 14:00 Mendoza
    });

    expect(motivo).toBe('FUERA_DE_HORARIO');
  });

  it('devuelve FUERA_DE_HORARIO un domingo sin franjas configuradas', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-22T12:00:00Z'), // domingo 09:00 Mendoza
      fin: new Date('2026-11-22T12:30:00Z'), // domingo 09:30 Mendoza
    });

    expect(motivo).toBe('FUERA_DE_HORARIO');
  });

  it('evalúa cambio de día UTC vs APP_TZ y devuelve FUERA_DE_HORARIO (martes 02:00 UTC = lunes 23:00 Mendoza)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-24T02:00:00Z'), // lunes 23:00 Mendoza
      fin: new Date('2026-11-24T02:30:00Z'), // lunes 23:30 Mendoza
    });

    expect(motivo).toBe('FUERA_DE_HORARIO');
  });

  it('devuelve FUERA_DE_HORARIO si el fin excede 13:00 por un segundo (13:00:01 Mendoza)', async () => {
    const repos = crearRepositoriosEnMemoria();
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T15:30:00Z'), // lunes 12:30:00 Mendoza
      fin: new Date('2026-11-23T16:00:01Z'), // lunes 13:00:01 Mendoza
    });

    expect(motivo).toBe('FUERA_DE_HORARIO');
  });

  it('devuelve EN_BLOQUEO cuando el turno solapa con un bloqueo del profesional', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.bloqueos.guardar({
      id: 'bloq-prof-1',
      profesionalId: anaId,
      inicio: new Date('2026-11-23T13:00:00Z'), // lunes 10:00 Mendoza
      fin: new Date('2026-11-23T14:00:00Z'), // lunes 11:00 Mendoza
      motivo: 'Congreso ficticio',
    });
    const disponibilidad = crearDisponibilidad(repos);

    const motivoAna = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:15:00Z'), // 10:15 Mendoza
      fin: new Date('2026-11-23T13:45:00Z'), // 10:45 Mendoza
    });
    expect(motivoAna).toBe('EN_BLOQUEO');

    const motivoBruno = await disponibilidad.verificar({
      profesionalId: brunoId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:15:00Z'),
      fin: new Date('2026-11-23T13:45:00Z'),
    });
    expect(motivoBruno).toBeNull();
  });

  it('devuelve EN_BLOQUEO cuando el turno solapa con un bloqueo del box', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.bloqueos.guardar({
      id: 'bloq-box-1',
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:00:00Z'), // lunes 10:00 Mendoza
      fin: new Date('2026-11-23T14:00:00Z'), // lunes 11:00 Mendoza
      motivo: 'Mantenimiento de box',
    });
    const disponibilidad = crearDisponibilidad(repos);

    const motivoBox1 = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:15:00Z'), // 10:15 Mendoza
      fin: new Date('2026-11-23T13:45:00Z'), // 10:45 Mendoza
    });
    expect(motivoBox1).toBe('EN_BLOQUEO');

    const motivoBox2 = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box2Id,
      inicio: new Date('2026-11-23T13:15:00Z'),
      fin: new Date('2026-11-23T13:45:00Z'),
    });
    expect(motivoBox2).toBeNull();
  });

  it('borde [inicio, fin): turno 10:00–10:30 con bloqueo desde 10:30 (profesional y box) devuelve null', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.bloqueos.guardar({
      id: 'bloq-prof-despues',
      profesionalId: anaId,
      inicio: new Date('2026-11-23T13:30:00Z'), // 10:30 Mendoza
      fin: new Date('2026-11-23T14:00:00Z'), // 11:00 Mendoza
      motivo: 'Bloqueo profesional posterior',
    });
    await repos.bloqueos.guardar({
      id: 'bloq-box-despues',
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:30:00Z'), // 10:30 Mendoza
      fin: new Date('2026-11-23T14:00:00Z'), // 11:00 Mendoza
      motivo: 'Bloqueo box posterior',
    });
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:00:00Z'), // 10:00 Mendoza
      fin: new Date('2026-11-23T13:30:00Z'), // 10:30 Mendoza
    });

    expect(motivo).toBeNull();
  });

  it('borde [inicio, fin): turno 10:00–10:30 con bloqueo 09:30–10:00 (profesional y box) devuelve null', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.bloqueos.guardar({
      id: 'bloq-prof-antes',
      profesionalId: anaId,
      inicio: new Date('2026-11-23T12:30:00Z'), // 09:30 Mendoza
      fin: new Date('2026-11-23T13:00:00Z'), // 10:00 Mendoza
      motivo: 'Bloqueo profesional previo',
    });
    await repos.bloqueos.guardar({
      id: 'bloq-box-antes',
      boxId: box1Id,
      inicio: new Date('2026-11-23T12:30:00Z'), // 09:30 Mendoza
      fin: new Date('2026-11-23T13:00:00Z'), // 10:00 Mendoza
      motivo: 'Bloqueo box previo',
    });
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T13:00:00Z'), // 10:00 Mendoza
      fin: new Date('2026-11-23T13:30:00Z'), // 10:30 Mendoza
    });

    expect(motivo).toBeNull();
  });

  it('prioriza FUERA_DE_HORARIO antes que EN_BLOQUEO cuando el turno también cae fuera de horario', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.bloqueos.guardar({
      id: 'bloq-fuera-horario',
      profesionalId: anaId,
      inicio: new Date('2026-11-23T16:30:00Z'), // 13:30 Mendoza
      fin: new Date('2026-11-23T17:00:00Z'), // 14:00 Mendoza
      motivo: 'Almuerzo',
    });
    const disponibilidad = crearDisponibilidad(repos);

    const motivo = await disponibilidad.verificar({
      profesionalId: anaId,
      boxId: box1Id,
      inicio: new Date('2026-11-23T16:30:00Z'), // 13:30 Mendoza
      fin: new Date('2026-11-23T17:00:00Z'), // 14:00 Mendoza
    });

    expect(motivo).toBe('FUERA_DE_HORARIO');
  });
});
