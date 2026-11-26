# Tasks — `C-17 cierre-integracion`

> **Governance**: `ALTO` (toca reglas de agenda del change evaluado `C-02`). **Puerta obligatoria**: EP aprueba el spec y el diseño antes de ejecutar `apply`.
> **Regla de oro sobre suites existentes**: los tests existentes de `C-02` (`tests/turnos-alta/`), `C-10` (`tests/turnos-reprogramacion/`) y `C-11` (`tests/reserva-online/`) **no se modifican** y deben seguir en verde. Cada escenario nuevo de las specs lleva su test `it('<Nombre exacto del Scenario>', ...)` siguiendo TDD estricto (`RED → GREEN → REFACTOR`).

## 0. Gate de gobernanza ALTO y línea base

- [x] 0.1 Confirmar aprobación explícita de EP sobre `proposal.md`, `design.md`, `tasks.md` y las delta specs de `cierre-integracion`, y verificar la línea base previa con `npm test` antes de iniciar `apply`.

## 1. Códigos de negocio y regla sin solapamiento por paciente (`C-02` y `C-10`)

- [x] 1.1 Agregar `'SOLAPAMIENTO_PACIENTE'` y `'TURNO_PENDIENTE_EXISTENTE'` a `CODIGOS_NEGOCIO` en `src/shared/errores.ts`, actualizar el test de lista cerrada de códigos en `tests/plataforma/` (`RED → GREEN → REFACTOR`) y documentar `RN-AG-11`, `RN-RE-06` y `RN-EX-01` en `knowledge-base/05_reglas_de_negocio.md`.
- [x] 1.2 Extender `conflictos()` en `src/modules/turnos-alta/dominio/agenda.ts` con `{ profesional, box, paciente }` y validar `SOLAPAMIENTO_PACIENTE` dentro de `conLockDeAgenda` en `src/modules/turnos-alta/aplicacion/crear-turno.ts` respetando el orden estricto `profesional → box → paciente`. Agregar en `tests/turnos-alta/` los tests de los escenarios nuevos (`"El paciente ya tiene un turno en ese horario con otro profesional y otro box"` y `"El personal agenda una segunda sesión futura del mismo paciente en otro horario"`) sin tocar los `it` existentes.
- [x] 1.3 Validar `SOLAPAMIENTO_PACIENTE` dentro de `conLockDeAgenda` en `src/modules/turnos-reprogramacion/aplicacion/reprogramar-turno.ts` incluyendo los turnos del paciente en la consulta, excluyendo el propio turno con `sinElPropio` y manteniendo el orden `profesional → box → paciente`. Agregar en `tests/turnos-reprogramacion/` el test `"Chocar con otro turno activo del mismo paciente en distinto profesional y box"` sin modificar los `it` existentes.

## 2. Un solo turno pendiente y sin solapamiento por paciente en `C-11` (`reserva-online`)

- [x] 2.1 Validar en `src/modules/reserva-online/aplicacion/reservar-turno.ts` dentro de `conLockDeAgenda`: (a) `SOLAPAMIENTO_PACIENTE` en `reservarTurnoOnline` y `reservarTurnoRecepcion` después de profesional y box, y (b) `TURNO_PENDIENTE_EXISTENTE` exclusivamente en `reservarTurnoOnline` (`POST /api/paciente/turnos`) cuando el paciente ya tiene un turno `reservado` o `confirmado` con `inicio > ahora`. Agregar en `tests/reserva-online/` los tests de los 3 escenarios nuevos sin modificar los `it` existentes.

## 3. Semilla demo con turnos de hoy (`semana: 0`) y un solo turno futuro de Mario Santos

- [x] 3.1 Actualizar `src/shared/seed-demo.ts` para incluir turnos `reservado` y `confirmado` en `semana: 0` para Dra. Ana Pérez (Box 1) y Dr. Bruno Gómez (Box 2) sin solapamientos y dejar a Mario Santos (`santos@example.com`) con un único turno futuro pendiente (`semana: 1`). Actualizar `tests/plataforma/seed-demo.test.ts` verificando ausencia de solapamiento por paciente, presencia de turnos en `semana: 0` y 1 solo turno futuro pendiente para Mario Santos.

## 4. Traducción de errores web, nombre real en `AppLayout` e `/inicio` conectado a la API (`web-base`)

- [x] 4.1 Agregar los mensajes legibles de `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE` en `web/src/base/errores.ts` y actualizar `web/src/base/AppLayout.tsx` para resolver dinámicamente el nombre real del usuario desde `GET /api/paciente/datos` (rol `paciente`) o `GET /api/profesionales` (rol `profesional`) con fallback al email, eliminando `"Lucía Fernández"` y el ternario fijo por email.
- [x] 4.2 Conectar `web/src/base/InicioPage.tsx` 100 % a datos reales de la API (`GET /api/agenda` del día actual en `America/Argentina/Mendoza` y `POST /api/turnos/:id/estado` para `profesional` y `recepcionista` con `"+ Nuevo turno"` hacia `/recepcion/turnos/nuevo`; `GET /api/paciente/turnos` y `GET /api/public/prestaciones` para `paciente`), eliminando `AGENDA_PROFESIONAL_INICIAL`, `AGENDA_RECEPCION_INICIAL`, la tarjeta hardcodeada del paciente y todas las etiquetas `"Datos de ejemplo"`. Actualizar `web/src/base/base.test.tsx` (`RED → GREEN → REFACTOR`).

## 5. Bloqueo preventivo en `/paciente/reservar`, error en recepción y cambio de estado en `/profesional/agenda`

- [x] 5.1 Actualizar `web/src/pages/paciente/ReservarPage.tsx` y `web/src/pages/paciente/dominio.ts` para consultar `GET /api/paciente/turnos` al montar `/paciente/reservar`, mostrar la tarjeta del turno pendiente (`reservado` o `confirmado` con `inicio > ahora`) con acciones directas a Reprogramar y Cancelar en lugar del asistente de nueva reserva, quitar `"Reservar otro turno"` de la vista de confirmación e incluir `SOLAPAMIENTO_PACIENTE` en `CODIGOS_CONFLICTO_HUECO`. Agregar el test del escenario en `web/src/pages/paciente/paciente.test.tsx`.
- [x] 5.2 Verificar y probar en `web/src/pages/recepcion/` que ante `409 SOLAPAMIENTO_PACIENTE` al crear o reprogramar un turno se muestre `AlertaErrorNegocio` con el mensaje legible y se recarguen los huecos libres conservando el paciente seleccionado, agregando el test del escenario en `web/src/pages/recepcion/recepcion.test.tsx`.
- [x] 5.3 Agregar `cambiarEstadoTurnoProfesional` en `web/src/pages/profesional/apiProfesional.ts`, los botones `"Confirmar"`, `"Marcar atendido"` y `"Marcar ausente"` y el enlace `"Ver historial"` en `web/src/pages/profesional/AgendaAuditoriaPage.tsx` contra `POST /api/turnos/:id/estado` con recarga de `GET /api/agenda`, manejo de `409` en `AlertaErrorNegocio` y vista de `"Historial del turno"` en español claro sin JSON crudo ni jerga técnica. Agregar y actualizar los tests en `web/src/pages/profesional/profesional.test.tsx`.

## 6. Verificación integral

- [x] 6.1 Ejecutar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build -w web` y `openspec validate cierre-integracion --strict`, confirmando que todas las suites de API y web pasen en verde sin regresiones.
