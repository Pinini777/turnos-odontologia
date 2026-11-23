# Tasks

> TDD: en cada tarea primero el test en rojo, después el código mínimo para ponerlo en verde. Repositorios en memoria y `FixedClock`, sin mocks del dominio. Turnos de prueba en días hábiles, entre 09:00 y 13:00.

## 1. Máquina de estados (dominio puro)

- [x] 1.1 Escribir `tests/turnos-estados/estados.test.ts` con la tabla completa: las cinco transiciones válidas, el resto de los pares (incluido el mismo estado) y los estados finales. Verificar que falla porque no existe `dominio/estados.ts`.
- [x] 1.2 Implementar `TRANSICIONES` y `validarTransicion(desde, hacia, { ahora, inicio })` en `src/modules/turnos-estados/dominio/estados.ts`, sin imports de Fastify ni de repositorios. Verificar que 1.1 pasa.
- [x] 1.3 Agregar los casos horarios a `estados.test.ts`: `atendido` y `ausente` a las 09:59 de un turno de las 10:00 dan `TRANSICION_INVALIDA`, a las 10:00 exactas se permiten, y confirmar y cancelar se permiten antes del inicio. Implementar la regla y verificar que pasan.

## 2. Casos de uso (aplicación)

- [x] 2.1 Crear `tests/turnos-estados/fixtures.ts`: arma turnos `reservado`, `confirmado`, `atendido` y `cancelado` con datos de `SEED` y los guarda en `repos.turnos`. Verificar que lo usa el primer test de 2.2.
- [x] 2.2 Escribir `tests/turnos-estados/cambiar-estado.test.ts` para `cancelarTurno({ turnoId, actor }, deps)`: cancela un `reservado` y un `confirmado` que ya pasó; el turno sigue guardado con los mismos datos; un `cancelado` o un `atendido` dan `TRANSICION_INVALIDA`; un id inexistente da `NO_ENCONTRADO`. Implementar en `aplicacion/cambiar-estado.ts` dentro de `conLockDeAgenda` y verificar que pasan.
- [x] 2.3 Agregar a `cambiar-estado.test.ts` los casos de `cambiarEstado({ turnoId, estado, actor }, deps)`: confirmar, atender y marcar ausente con `FixedClock`, y rechazar `reservado → atendido`. Implementar y verificar que pasan.
- [x] 2.4 Agregar los tests de auditoría: después de cancelar o cambiar el estado hay un único registro con la acción correcta (`cancelado` o `estado_cambiado`), el actor, la fecha de `FixedClock` y `detalle.antes.estado` y `detalle.despues.estado`; un intento rechazado no agrega registros. Implementar y verificar que pasan.

## 3. Rutas HTTP

- [x] 3.1 Escribir `tests/turnos-estados/routes.test.ts` con `buildApp({ auth: authDeTest, clock: FixedClock, repos })` para `POST /api/turnos/:id/cancelar` y `POST /api/turnos/:id/estado`: `200` con el turno actualizado, `409 TRANSICION_INVALIDA` y `404 NO_ENCONTRADO`. Implementar `routes.ts` con Zod y `requireRol('profesional', 'recepcionista')`, y verificar que pasan.
- [x] 3.2 Agregar los bordes HTTP: `{"estado":"cancelado"}` y `{}` dan `400 FORMATO_INVALIDO` con un detalle sobre `estado`; el paciente recibe `403 SIN_PERMISO` y el turno no cambia; la respuesta a la recepcionista no incluye `precioAlReservar` y la del profesional sí. Verificar que pasan.

## 4. Verificación integral

- [x] 4.1 Correr `npm test`, `npm run typecheck` y `npm run lint` y verificar que están en verde, sin `any` ni `@ts-ignore`.
- [x] 4.2 Revisar con `git diff --stat main` que solo cambiaron `src/modules/turnos-estados/`, `tests/turnos-estados/` y `openspec/changes/cancelar-y-cambiar-estado/`.
- [x] 4.3 Comparar cada escenario de `specs/turnos-estados/spec.md` con al menos un test y verificar que ninguno queda sin cubrir (regla dura 8).

## Workflow follow-up

- Archivar el change en `dev-lautaro` con `/opsx:archive` una vez verificado.
- Agregar la fila de C-05 al final de `evidencias/bitacora-decisiones.md` (decisión: atendido/ausente solo después del inicio, con `TRANSICION_INVALIDA`).
- Abrir el PR de `dev-lautaro` a `main` con la plantilla; EP lo mergea y marca `[x]` en `CHANGES.md`.
