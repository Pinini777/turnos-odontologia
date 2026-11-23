# Tasks

> TDD: en cada tarea primero el test en rojo, después el código mínimo para ponerlo en verde. Repositorios en memoria y `FixedClock`, sin mocks del dominio. Turnos de prueba el martes 24/11/2026, dentro del horario semilla (09:00–13:00). Solo se escribe en `src/modules/turnos-reprogramacion/`, `tests/turnos-reprogramacion/` y este change; C-02 y C-05 se importan, no se editan.

## 1. Reglas puras (dominio)

- [x] 1.1 Escribir `tests/turnos-reprogramacion/reprogramacion.test.ts`: `esReprogramable` acepta `reservado` y `confirmado` y rechaza `cancelado`, `atendido` y `ausente`; `intervaloNuevo(inicio, 30)` da `fin = inicio + 30 min`; `sinElPropio` saca de la lista solo el turno con ese id. Verificar que falla porque no existe `dominio/reprogramacion.ts`.
- [x] 1.2 Implementar `src/modules/turnos-reprogramacion/dominio/reprogramacion.ts` sin imports de Fastify, repositorios ni `Date.now()`. Verificar que 1.1 pasa y que el borde "10:00–10:30 movido a 10:15 no choca consigo mismo" da `conflictos(sinElPropio(...))` sin choques usando `conflictos` de `turnos-alta`.

## 2. Caso de uso `reprogramarTurno` (aplicación)

- [x] 2.1 Crear `tests/turnos-reprogramacion/fixtures.ts`: arma turnos del martes con datos de `SEED` en cualquier estado, profesional, box y horario, y los guarda en `repos.turnos`. Verificar que lo usa el primer test de 2.2.
- [x] 2.2 Escribir `tests/turnos-reprogramacion/reprogramar-turno.test.ts` con los casos felices: mover a otra hora (fin recalculado, mismo id, paciente, prestación y `precioAlReservar`), a otro profesional y box, 15 minutos sobre su propio horario, al mismo horario, justo a continuación de otro turno, a un hueco con un turno cancelado y un turno cuyo horario original ya pasó. Implementar `aplicacion/reprogramar-turno.ts` dentro de `conLockDeAgenda` (design D3, D4) y verificar que pasan.
- [x] 2.3 Agregar los rechazos con su código y verificar que el turno no cambia: `SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `FUERA_DE_GRILLA`, `EN_EL_PASADO`, `FUERA_DE_HORARIO`, `EN_BLOQUEO`, `RECURSO_INACTIVO`, `NO_ENCONTRADO` (turno y profesional) y `TRANSICION_INVALIDA` para `cancelado`, `atendido` y `ausente`. Implementar y verificar que pasan.
- [x] 2.4 Agregar el estado resultante: un `confirmado` reprogramado queda `reservado` y un `reservado` sigue `reservado`. Verificar que pasan.
- [x] 2.5 Agregar la auditoría: un único registro `reprogramado` con actor, fecha de `FixedClock` y `antes`/`despues` con estado, inicio, fin, profesional y box; un rechazo no agrega registros; C-11 puede llamar con actor `"paciente"`. Implementar auditando antes de guardar (design D5) y verificar que pasan.
- [x] 2.6 Agregar las fallas inyectadas (mismo helper de contadores que C-05): falla la auditoría → el turno no cambia, sin email; falla guardar → el turno no cambia y hay intento más reversión con `revertido: true`; fallan guardar y la reversión → el turno no cambia y queda el intento. Verificar que primero fallan y después pasan.
- [x] 2.7 Agregar el email: se envía a `paciente1@example.com` con la nueva fecha, hora, profesional, box y prestación y sin precio; si el notificador falla, la reprogramación queda hecha; un rechazo no envía email. Implementar con `armarEmailDeAlta` fuera del lock (design D6) y verificar que pasan.
- [x] 2.8 Agregar la concurrencia: dos reprogramaciones simultáneas al mismo hueco con `Promise.all` → una se aplica y la otra da `SOLAPAMIENTO_PROFESIONAL`. Verificar que pasa.

## 3. Ruta HTTP

- [x] 3.1 Escribir `tests/turnos-reprogramacion/routes.test.ts` con `buildApp({ auth: authDeTest, clock: FixedClock, repos })` para `PATCH /api/turnos/:id/reprogramar`: `200` con el turno movido, `409 SOLAPAMIENTO_PROFESIONAL`, `409 TRANSICION_INVALIDA` para un cancelado y `404 NO_ENCONTRADO`. Implementar `routes.ts` con Zod y `requireRol('profesional', 'recepcionista')` (design D7) y verificar que pasan.
- [x] 3.2 Agregar los bordes HTTP: `{}` da `400 FORMATO_INVALIDO` con detalle sobre `inicio`; un `inicio` sin zona da `400`; el paciente recibe `403 SIN_PERMISO` y el turno no cambia; sin token da `401`; la respuesta a la recepcionista no incluye `precioAlReservar` y la del profesional sí; la auditoría usa el `usuarioId` de la sesión. Verificar que pasan.

## 4. Verificación integral

- [x] 4.1 Correr `npm test`, `npm run typecheck` y `npm run lint` y verificar que están en verde, sin `any` ni `@ts-ignore`.
- [x] 4.2 Revisar con `git diff --stat origin/main` que solo cambiaron `src/modules/turnos-reprogramacion/`, `tests/turnos-reprogramacion/` y `openspec/changes/reprogramar-turno/`.
- [x] 4.3 Comparar cada escenario de `specs/turnos-reprogramacion/spec.md` con al menos un test y verificar que ninguno queda sin cubrir (regla dura 8).

## Workflow follow-up

- Archivar el change en `dev-lautaro` una vez verificado.
- Agregar la fila de C-10 al final de `evidencias/bitacora-decisiones.md` (decisión: un `confirmado` reprogramado vuelve a `reservado`; reutiliza las funciones puras de C-02 sin editarlas).
- Abrir el PR de `dev-lautaro` a `main` con la plantilla. En el PR, avisar a EP que C-02 audita después de guardar y que el email pasa a `enviarConfirmacionTurno` cuando C-06 esté en `main`.
