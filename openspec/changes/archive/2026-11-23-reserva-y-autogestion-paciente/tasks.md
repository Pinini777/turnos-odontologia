# Tasks

> TDD estricto: para cada tarea escribir primero los tests que fallan (RED), luego la implementación mínima (GREEN), triangular todos los escenarios del spec y refactorizar con tests en verde. Trabajar exclusivamente en `src/modules/reserva-online/` y `tests/reserva-online/`, con `FixedClock`, repositorios en memoria y datos 100 % ficticios en horario semilla (lun–vie 09:00–13:00).

## 1. Dominio puro de disponibilidad y autogestión

- [x] 1.1 Implementar `src/modules/reserva-online/dominio/disponibilidad.ts` (`calcularHuecosDisponibles` y `seleccionarBoxLibre`) siguiendo TDD en `tests/reserva-online/dominio-disponibilidad.test.ts`; verificar en verde grilla de 15 min en `APP_TZ`, exclusión de pasado/bloqueos/turnos activos, conservación de huecos cuando queda otro box libre, borde contiguo `[inicio, fin)`, turnos cancelados que no bloquean y autoasignación determinística del primer box libre (`SOLAPAMIENTO_BOX` vs `EN_BLOQUEO` vs `RECURSO_INACTIVO`).
- [x] 1.2 Implementar `src/modules/reserva-online/dominio/autogestion.ts` (`verificarPropiedadTurno` y `verificarPlazo24h` con `VENTANA_AUTOGESTION_MS`) siguiendo TDD en `tests/reserva-online/dominio-autogestion.test.ts`; verificar en verde propiedad (`404 NO_ENCONTRADO` para ajeno/inexistente), 25 h permitido, borde exacto de 24 h permitido y 23 h rechazado (`PLAZO_VENCIDO`).

## 2. Casos de uso de disponibilidad y reserva (online y recepción)

- [x] 2.1 Implementar `src/modules/reserva-online/aplicacion/disponibilidad.ts` (`consultarDisponibilidad` con parámetro `soloReservablesOnline`) siguiendo TDD en `tests/reserva-online/disponibilidad.test.ts`; verificar en verde consulta pública solo para prestaciones activas `reservableOnline: true` (`409 RECURSO_INACTIVO` si es `false` o inactiva, `404 NO_ENCONTRADO` si no existe), filtro por `profesionalId` y modo recepción que habilita prestaciones activas con `reservableOnline: false`.
- [x] 2.2 Implementar `reservarTurnoOnline` en `src/modules/reserva-online/aplicacion/reservar-turno.ts` siguiendo TDD en `tests/reserva-online/reservar-online.test.ts`; verificar en verde reserva feliz con `boxId` explícito y con `boxId` omitido (autoasignado bajo `conLockDeAgenda`), `origen: 'online'`, auditoría `creado` con `actor: 'paciente'`, rechazo por `reservableOnline: false`, reglas `RN-AG-*`, concurrencia `Promise.all` (1 `201` + 1 `409 SOLAPAMIENTO_PROFESIONAL`), envío de email con Google Calendar + `.ics` sin precio y tolerancia a fallo SMTP (`RN-NO-02`).
- [x] 2.3 Implementar `reservarTurnoRecepcion` en `src/modules/reserva-online/aplicacion/reservar-turno.ts` reutilizando `normalizarEmail`/`normalizarDocumento`/`validarUnicidadPaciente` de C-04 siguiendo TDD en `tests/reserva-online/reservar-recepcion.test.ts`; verificar en verde alta para `pacienteId` existente con prestación no online y box automático, alta atómica con `paciente` inline nuevo (sin `usuarioId`), ausencia de paciente huérfano si el horario falla por solapamiento, rechazo `409 DUPLICADO`, `origen: 'recepcion' | 'profesional'`, auditoría `creado` con `actor: sesion.usuarioId` y correo completo C-06 sin precio.

## 3. Casos de uso de autogestión del paciente

- [x] 3.1 Implementar `listarTurnosPropios` y `obtenerIcsPropio` en `src/modules/reserva-online/aplicacion/autogestion-paciente.ts` siguiendo TDD en `tests/reserva-online/autogestion-paciente.test.ts`; verificar en verde filtrado estricto por `pacienteId` ordenado por `inicio`, generación de `.ics` vía `generarIcs` (C-06) sin precios y `404 NO_ENCONTRADO` ante turno ajeno o inexistente.
- [x] 3.2 Implementar `cancelarTurnoPaciente` y `reprogramarTurnoPaciente` en `src/modules/reserva-online/aplicacion/autogestion-paciente.ts` delegando en `cancelarTurno` (C-05) y `reprogramarTurno` (C-10 con notificador no-op + `enviarConfirmacionTurno` de C-06 `tipo: 'reprogramado'`) siguiendo TDD en `tests/reserva-online/autogestion-paciente.test.ts`; verificar en verde orden de validaciones (`404 NO_ENCONTRADO` → `409 TRANSICION_INVALIDA` → `409 PLAZO_VENCIDO`), 25 h / borde exacto 24 h / 23 h, auditoría con `actor: 'paciente'`, solapamiento en destino sin alterar original y un único correo de reprogramación con Google Calendar e `.ics` actualizado.

## 4. Rutas Fastify e integración HTTP

- [x] 4.1 Implementar `src/modules/reserva-online/routes.ts` (validación Zod en el borde, `requireRol`, cabeceras `text/calendar; charset=utf-8` para `.ics`, exclusividad mutua `pacienteId` vs `paciente` en `POST /api/recepcion/turnos`) y cubrir todos los escenarios HTTP del spec vía `app.inject()` en `tests/reserva-online/routes.test.ts`; verificar en verde códigos `200/201/400/401/403/404/409`, ausencia total de `precio`/`precioAlReservar` para público, `paciente` y `recepcionista`, y concurrencia HTTP en `POST /api/paciente/turnos`.

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm test`, `npm run typecheck` y `npm run lint` verificando salida 100 % en verde y confirmar con `git status` que no se modificó ningún archivo fuera de `src/modules/reserva-online/`, `tests/reserva-online/` y `openspec/changes/reserva-y-autogestion-paciente/`.

## Workflow follow-up

- Registrar la fila de decisión en `evidencias/bitacora-decisiones.md` al final del archivo (sin borrar filas ajenas).
- Archivar el change con `openspec archive "reserva-y-autogestion-paciente" --yes --json` en `dev-renzo` una vez completadas y verificadas todas las tareas.
- Abrir PR `dev-renzo` → `main` usando `.github/pull_request_template.md` para revisión y merge de EP.
