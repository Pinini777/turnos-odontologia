import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { FixedClock } from '../../src/shared/clock';
import { SEED } from '../../src/shared/seed';
import { authDeTest } from '../plataforma/helpers';

describe('Autoload real de src/modules/configuracion/routes.ts', () => {
  it('registra automáticamente todas las rutas de configuración bajo /api', async () => {
    const app = await buildApp({
      auth: authDeTest,
      clock: new FixedClock('2026-11-23T12:00:00Z'),
    });

    try {
      const headersProf = { authorization: 'Bearer prof' };
      const headersRecep = { authorization: 'Bearer recep' };

      const resProfesionales = await app.inject({
        method: 'GET',
        url: '/api/profesionales',
        headers: headersProf,
      });
      expect(resProfesionales.statusCode).toBe(200);
      expect(resProfesionales.json()).toHaveLength(2);

      const resBoxes = await app.inject({
        method: 'GET',
        url: '/api/boxes',
        headers: headersProf,
      });
      expect(resBoxes.statusCode).toBe(200);
      expect(resBoxes.json()).toHaveLength(2);

      const resPrestacionesProf = await app.inject({
        method: 'GET',
        url: '/api/prestaciones',
        headers: headersProf,
      });
      expect(resPrestacionesProf.statusCode).toBe(200);
      expect(resPrestacionesProf.json()).toHaveLength(4);
      expect(resPrestacionesProf.json()[0]).toHaveProperty('precio');

      const resPrestacionesRecep = await app.inject({
        method: 'GET',
        url: '/api/prestaciones',
        headers: headersRecep,
      });
      expect(resPrestacionesRecep.statusCode).toBe(200);
      for (const item of resPrestacionesRecep.json() as Array<Record<string, unknown>>) {
        expect(item).not.toHaveProperty('precio');
      }

      const resPublicas = await app.inject({
        method: 'GET',
        url: '/api/public/prestaciones',
      });
      expect(resPublicas.statusCode).toBe(200);
      const publicas = resPublicas.json() as Array<Record<string, unknown>>;
      expect(publicas).toHaveLength(3);
      for (const item of publicas) {
        expect(item).not.toHaveProperty('precio');
        expect(item.reservableOnline).toBe(true);
        expect(item.activa).toBe(true);
      }

      const resHorarios = await app.inject({
        method: 'GET',
        url: `/api/profesionales/${SEED.profesionales.anaPerez.id}/horarios`,
        headers: headersProf,
      });
      expect(resHorarios.statusCode).toBe(200);
      expect(resHorarios.json()).toHaveLength(10);

      const resBloqueos = await app.inject({
        method: 'GET',
        url: '/api/bloqueos',
        headers: headersProf,
      });
      expect(resBloqueos.statusCode).toBe(200);
      expect(resBloqueos.json()).toEqual([]);

      const fueraDeHorario = await app.deps.disponibilidad.verificar({
        profesionalId: SEED.profesionales.anaPerez.id,
        boxId: SEED.boxes.box1.id,
        inicio: new Date('2026-11-22T12:00:00Z'), // domingo 09:00 Mendoza
        fin: new Date('2026-11-22T12:30:00Z'),
      });
      expect(fueraDeHorario).toBe('FUERA_DE_HORARIO');
    } finally {
      await app.close();
    }
  });
});
