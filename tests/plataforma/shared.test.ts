import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../src/shared/clock';
import { CODIGOS_NEGOCIO } from '../../src/shared/errores';
import { crearLockDeAgenda } from '../../src/shared/lock';
import { sinPrecioPara } from '../../src/shared/precios';
import { crearRepositoriosEnMemoria } from '../../src/shared/repositorios';
import { SEED } from '../../src/shared/seed';
import { enZonaConsultorio } from '../../src/shared/zona';
import { crearNotificador } from '../../src/modules/notificaciones/adapter';
import { crearDisponibilidad } from '../../src/modules/configuracion/disponibilidad';

describe('Errores de regla de negocio', () => {
  it('Lista cerrada de códigos', () => {
    expect([...CODIGOS_NEGOCIO].sort()).toEqual([
      'DUPLICADO', 'DURACION_INVALIDA', 'EN_BLOQUEO', 'EN_EL_PASADO', 'FUERA_DE_GRILLA', 'FUERA_DE_HORARIO',
      'NO_ENCONTRADO', 'PLAZO_VENCIDO', 'RECURSO_INACTIVO', 'SOLAPAMIENTO_BOX', 'SOLAPAMIENTO_PROFESIONAL',
      'TRANSICION_INVALIDA',
    ]);
  });
});

describe('Precios ocultos por rol', () => {
  const prestaciones = [{ id: 'p1', nombre: 'Consulta', duracionMin: 30, precio: 15000 }];

  it('Recepcionista lista prestaciones sin precio y con el resto de los campos', () => {
    expect(sinPrecioPara('recepcionista', prestaciones)).toEqual([{ id: 'p1', nombre: 'Consulta', duracionMin: 30 }]);
  });

  it('Paciente ve un turno anidado sin precios en ningún nivel', () => {
    const turno = { turno: { precioAlReservar: 5000, prestacion: { precio: 5000, nombre: 'X' } } };
    expect(sinPrecioPara('paciente', turno)).toEqual({ turno: { prestacion: { nombre: 'X' } } });
  });

  it('Profesional ve sus precios', () => {
    expect(sinPrecioPara('profesional', prestaciones)).toEqual(prestaciones);
  });

  it('No muta el original y conserva las fechas', () => {
    const inicio = new Date('2026-11-23T12:00:00Z');
    const original = { inicio, precio: 1 };
    const limpio = sinPrecioPara('recepcionista', original);
    expect(original.precio).toBe(1);
    expect(limpio).toEqual({ inicio });
  });
});

describe('Hora y zona del consultorio', () => {
  it('Reloj fijo: devuelve siempre el instante configurado, como copia', () => {
    const clock = new FixedClock('2026-11-23T12:00:00Z');
    const a = clock.ahora();
    a.setFullYear(2000);
    expect(clock.ahora().toISOString()).toBe('2026-11-23T12:00:00.000Z');
  });

  it('Instante en UTC → lunes 09:00 en Mendoza', () => {
    expect(enZonaConsultorio(new Date('2026-11-23T12:00:00Z'))).toEqual({ fecha: '2026-11-23', diaSemana: 1, hhmm: '09:00' });
  });

  it('Cambio de día por la zona → sigue siendo lunes 23:30', () => {
    expect(enZonaConsultorio(new Date('2026-11-24T02:30:00Z'))).toEqual({ fecha: '2026-11-23', diaSemana: 1, hhmm: '23:30' });
  });

  it('Domingo es 7', () => {
    expect(enZonaConsultorio(new Date('2026-11-22T15:00:00Z')).diaSemana).toBe(7);
  });
});

describe('Datos semilla ficticios', () => {
  it('Contenido de la semilla', async () => {
    const repos = crearRepositoriosEnMemoria();
    const profesionales = (await repos.profesionales.listar()).map((p) => p.nombre).sort();
    const boxes = (await repos.boxes.listar()).map((b) => b.nombre).sort();
    const prestaciones = await repos.prestaciones.listar();
    expect(profesionales).toEqual(['Dr. Bruno Gómez', 'Dra. Ana Pérez']);
    expect(boxes).toEqual(['Box 1', 'Box 2']);
    expect(Object.fromEntries(prestaciones.map((p) => [p.nombre, p.duracionMin]))).toEqual({
      Consulta: 30, Limpieza: 45, 'Extracción simple': 60, Control: 15,
    });
    expect(prestaciones.every((p) => p.duracionMin > 0 && p.duracionMin % 15 === 0)).toBe(true);
  });

  it('Horario semilla: lunes a viernes, 09–13 y 15–19, para cada profesional', async () => {
    const horarios = await crearRepositoriosEnMemoria().horarios.listar((h) => h.profesionalId === SEED.profesionales.anaPerez.id);
    expect(horarios).toHaveLength(10);
    expect(new Set(horarios.map((h) => h.diaSemana))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(horarios.map((h) => `${h.desde}-${h.hasta}`))).toEqual(new Set(['09:00-13:00', '15:00-19:00']));
  });

  it('Pacientes y usuarios ficticios', async () => {
    const repos = crearRepositoriosEnMemoria();
    const pacientes = await repos.pacientes.listar();
    const usuarios = await repos.usuarios.listar();
    expect(pacientes.length).toBeGreaterThan(0);
    for (const p of pacientes) {
      // RN-DA-01: solo personajes de ficción aprobados por EP (amigos de Mafalda, de Quino).
      expect(['Susanita Chirusi', 'Manolito Goreiro']).toContain(`${p.nombre} ${p.apellido}`);
      expect(p.documento).toMatch(/^0000000\d$/);
      expect(p.email).toMatch(/@example\.com$/);
    }
    for (const u of usuarios) expect(u.email).toMatch(/@example\.com$/);
  });

  it('Sin contraseñas en claro: todos los usuarios guardan un hash bcrypt', async () => {
    for (const u of await crearRepositoriosEnMemoria().usuarios.listar()) {
      expect(u.hashPassword).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    }
  });

  it('Sin semilla, los repositorios arrancan vacíos', async () => {
    expect(await crearRepositoriosEnMemoria({ seed: false }).profesionales.listar()).toEqual([]);
  });
});

describe('Repositorios en memoria', () => {
  it('Dos instancias independientes', async () => {
    const a = crearRepositoriosEnMemoria();
    await a.pacientes.guardar({ ...SEED.pacientes.uno, id: 'nuevo', documento: '00000009', email: 'paciente9@example.com' });
    const b = crearRepositoriosEnMemoria();
    expect(await a.pacientes.existe('nuevo')).toBe(true);
    expect(await b.pacientes.existe('nuevo')).toBe(false);
  });

  it('Lectura devuelve copias: mutar lo leído no cambia lo guardado', async () => {
    const repos = crearRepositoriosEnMemoria();
    const box = await repos.boxes.buscarPorId(SEED.boxes.box1.id);
    if (!box) throw new Error('falta Box 1');
    box.activo = false;
    expect((await repos.boxes.buscarPorId(SEED.boxes.box1.id))?.activo).toBe(true);
  });

  it('Auditoría es append-only: solo agregar y listar', async () => {
    const repos = crearRepositoriosEnMemoria();
    await repos.auditoria.agregar({ id: 'a1', turnoId: 't1', accion: 'creado', actor: 'u1', fecha: new Date(0), detalle: {} });
    expect(await repos.auditoria.listar()).toHaveLength(1);
    expect(Object.keys(repos.auditoria).sort()).toEqual(['agregar', 'listar']);
  });
});

describe('Operaciones de agenda en exclusión mutua', () => {
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('Dos operaciones simultáneas: la segunda empieza cuando terminó la primera', async () => {
    const conLock = crearLockDeAgenda();
    const eventos: string[] = [];
    const op = (n: string) => conLock(async () => {
      eventos.push(`inicio ${n}`);
      await esperar(10);
      eventos.push(`fin ${n}`);
      return n;
    });
    expect(await Promise.all([op('A'), op('B')])).toEqual(['A', 'B']);
    expect(eventos).toEqual(['inicio A', 'fin A', 'inicio B', 'fin B']);
  });

  it('Una operación falla: el error llega y la siguiente se ejecuta igual', async () => {
    const conLock = crearLockDeAgenda();
    const falla = conLock(async () => { throw new Error('boom'); });
    const sigue = conLock(async () => 'ok');
    await expect(falla).rejects.toThrow('boom');
    await expect(sigue).resolves.toBe('ok');
  });
});

describe('Dependencias provisionales', () => {
  it('Notificación provisional: queda en la bandeja en memoria', async () => {
    const notificador = crearNotificador();
    await notificador.enviar({ para: 'paciente1@example.com', asunto: 'Turno', texto: 'Hola' });
    expect(notificador.bandeja).toEqual([{ para: 'paciente1@example.com', asunto: 'Turno', texto: 'Hola' }]);
  });

  it('Disponibilidad (C-03): acepta horario válido dentro de la grilla semilla', async () => {
    const disponibilidad = crearDisponibilidad(crearRepositoriosEnMemoria());
    const motivo = await disponibilidad.verificar({
      profesionalId: SEED.profesionales.anaPerez.id, boxId: SEED.boxes.box1.id,
      inicio: new Date('2026-11-23T12:00:00Z'), fin: new Date('2026-11-23T13:00:00Z'),
    });
    expect(motivo).toBeNull();
  });
});
