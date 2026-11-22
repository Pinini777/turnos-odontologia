# Design

## Context

C-01 dejó congelados los contratos que este change usa sin modificarlos (ver `explore.md`, "Estado del código"): entidades, `ReglaDeNegocioError` y su mapeo a `409 {code}`, `Clock`, `enZonaConsultorio()`, repositorios en memoria con seeds, `conLockDeAgenda`, `requireRol`, el hook global que oculta precios y los puertos `DisponibilidadPort` y `Notificador` con stubs. El módulo se registra solo al existir `src/modules/turnos-alta/routes.ts`. Motivación y alcance: `proposal.md`. Comportamiento: `specs/turnos-alta/spec.md`.

## Goals / Non-Goals

**Goals:**
- Dominio puro y reutilizable: C-10 (reprogramar) importa la detección de solapamientos sin copiarla.
- Que cada escenario del spec tenga su test de Vitest, con `FixedClock` y repositorios en memoria, sin mocks del dominio.

**Non-Goals:**
- Validar horarios y bloqueos: se delega en el puerto de disponibilidad (stub permisivo hasta C-03).
- Armar el email final con Google Calendar e `.ics` (C-06).
- Índices o consultas optimizadas: decenas de turnos por día (03, volumen).

## Decisions

### D-1. Estructura del módulo (DD-13, hexagonal)
```
src/modules/turnos-alta/
  dominio/agenda.ts         seSuperponen, conflictos, enGrilla        (puro: sin Fastify, repos ni Date.now)
  aplicacion/crear-turno.ts crearTurno(deps, sesion, solicitud)       (orquesta puertos, lock y auditoría)
  aplicacion/email.ts       armarEmailDeAlta(turno, datos)            (texto plano sin precio)
  routes.ts                 POST /turnos: Zod + requireRol + 201
tests/turnos-alta/
  agenda.test.ts            unidad del dominio
  crear-turno.test.ts       escenarios del spec por HTTP con buildApp
```
*Alternativa descartada*: un solo archivo. Separar dominio deja a C-10 importar `conflictos` sin arrastrar Fastify.

### D-2. Funciones de dominio
- `seSuperponen(a, b)`: `a.inicio < b.fin && b.inicio < a.fin` (DD-02). Con `<` estricto, los turnos contiguos no chocan.
- `conflictos(turnos, nuevo)`: ignora los `cancelado` y devuelve `{ profesional: boolean, box: boolean }`. No excluye por id: C-10 filtra el turno propio antes de llamarla (RN-TU-04).
- `enGrilla(inicio, tz)`: usa los minutos de `enZonaConsultorio()` y exige segundos y milisegundos en 0. Mendoza no tiene offsets de media hora, pero así no depende de eso.
- El "ahora" entra por parámetro desde `Clock`; el dominio nunca crea fechas del sistema (regla dura 9).

### D-3. Caso de uso `crearTurno` y orden de validación
1. **Fuera del lock**: grilla → pasado (`inicio < ahora`) → recursos: buscar profesional, box, prestación y paciente (`404 NO_ENCONTRADO` si falta alguno) y luego verificar que profesional, box y prestación estén activos (`409 RECURSO_INACTIVO`). Calcula `fin = inicio + duracionMin`.
2. **Dentro de `conLockDeAgenda`**: disponibilidad → turnos del profesional o del box (`repos.turnos.listar(filtro)`) → `conflictos` → si `profesional` lanza `SOLAPAMIENTO_PROFESIONAL`, si no y `box` lanza `SOLAPAMIENTO_BOX` (decisión H-1) → guarda el turno → agrega la auditoría `creado`.
3. **Después del lock**: envía el email dentro de un `try/catch` que no relanza (RN-NO-02).

*Por qué la disponibilidad va dentro del lock*: un bloqueo creado entre la verificación y el guardado no debe colarse. Grilla, pasado y recursos no dependen de la agenda y quedan afuera para que el lock dure lo mínimo.
*Alternativa descartada*: un `409` con varios códigos. Rompe el contrato de `plataforma` (ver `explore.md`, H-1).

### D-4. Datos del turno
- `id`: `randomUUID()` de `node:crypto`, en `aplicacion/` (no en el dominio).
- `estado` `reservado`, `precioAlReservar` = `prestacion.precio` (DD-05), `creadoPor` = `sesion.usuarioId`, `creadoEn` = `clock.ahora()`.
- `origen`: `profesional` si el rol es profesional; `recepcion` si es recepcionista.
- Auditoría: `{ accion: 'creado', actor: sesion.usuarioId, fecha: clock.ahora(), detalle: { despues: turno } }`.

### D-5. HTTP
- `POST /turnos` (prefijo `/api` lo pone `app.ts`), `preHandler: requireRol('profesional', 'recepcionista')`.
- Zod: cinco campos `string` no vacíos e `inicio` con `z.string().datetime({ offset: true })`. Sin `.strict()`: un campo extra como `sobreturno` se ignora y no puede forzar nada (RN-AG-07).
- Responde `reply.code(201)` con el turno. El hook global de `app.ts` quita `precioAlReservar` para la recepcionista; el módulo no lo duplica.

### D-6. Email mínimo (decisión H-2)
`para`: email del paciente. `asunto`: `Turno confirmado: 24/11/2026 10:00`. `texto`: fecha y hora en la zona del consultorio, nombre del profesional, box y prestación. Nunca incluye precio (RN-NO-03). C-06 reemplaza el transporte y puede ofrecer después un armador propio para C-10.

### D-7. Tests
- HTTP con `buildApp({ repos: crearRepositoriosEnMemoria(), clock: new FixedClock('2026-11-23T08:00:00-03:00'), auth: authDeTest, notificador })`, importando `authDeTest` de `tests/plataforma/helpers.ts` (importar sí, editar no).
- Turnos previos: se guardan directo en `repos.turnos`.
- Disponibilidad y fallo de email: se inyecta un `DisponibilidadPort` que devuelve el código y un `Notificador` que lanza. Son puertos de infraestructura, no del dominio.
- Concurrencia: `Promise.all` de dos `app.inject` al mismo hueco.

## Risks / Trade-offs

- [Choque doble responde solo `SOLAPAMIENTO_PROFESIONAL`] → `conflictos` devuelve los dos recursos y un test de dominio lo verifica. Si EP amplía el contrato de errores más adelante, solo cambia `crearTurno`.
- [Lectura completa de turnos en memoria] → `shortcut: listar() recorre todos los turnos; con SQLite pasa a una consulta por profesional, box y rango.`
- [El lock es de un solo proceso] → ya documentado en `src/shared/lock.ts`; suficiente para el MVP.
- [El stub de disponibilidad acepta todo] → los tests usan fechas dentro del horario semilla (martes 09:00–13:00) para seguir en verde cuando C-03 lo reemplace.
- [El email lo arma C-02 y no C-06] → queda aislado en `aplicacion/email.ts`, fácil de reemplazar.

## UI Mockups

- Design system revision: 1 (no aplica)
- Decision: no (no UI) — 2026-11-22
