# Design

## Context

Este change implementa **C-11 (`reserva-y-autogestion-paciente`, capability `reserva-online`)**. La motivación y alcance están en `proposal.md`. Todas las dependencias del Gate 3 (`C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `C-06` y `C-10`) ya están integradas en `main`, y por la regla dura #3 de `AGENTS.md` este change solo escribe dentro de `src/modules/reserva-online/`, `tests/reserva-online/` y `openspec/changes/reserva-y-autogestion-paciente/`, importando contratos de otros módulos sin editarlos.

## Goals / Non-Goals

**Goals:**
- Calcular huecos disponibles reales en grilla de 15 minutos (`APP_TZ`) informando profesionales activos y `boxIds` libres, tanto en modo público online (`reservableOnline: true`) como en modo asistido para recepción/profesional (todas las prestaciones activas).
- Permitir al paciente autenticado reservar online (`origen: 'online'`), ver sus turnos, descargar su `.ics`, y cancelar o reprogramar respetando pertenencia (`404`) y ventana de 24 horas (`409 PLAZO_VENCIDO`, borde exacto permitido).
- Permitir a `recepcionista` y `profesional` registrar un turno presencial o telefónico en una única operación atómica para un paciente existente (`pacienteId`) o nuevo inline (`paciente`), con `boxId` opcional y confirmación completa con Google Calendar + `.ics`.
- Garantizar ausencia total de solapamientos (concurrencia protegida con `conLockDeAgenda`), ausencia de precios en respuestas/correos para paciente y recepcionista, y dominio 100 % puro sin `Date.now()`/`new Date()`.

**Non-Goals:**
- Modificar `src/shared/`, `src/app.ts`, `src/modules/turnos-alta/`, `src/modules/cuentas/`, `src/modules/turnos-reprogramacion/` ni las rutas ya archivadas de otros changes.
- Implementar pantallas de frontend (corresponden a C-13 y C-14).
- Soportar pacientes sin email (el contrato congelado `Paciente.email` en C-01 es obligatorio y requerido para vinculación PA-10 y confirmación por correo).

## Decisions

### D1 — Arquitectura hexagonal dentro de `src/modules/reserva-online/`
- `dominio/disponibilidad.ts`: funciones puras `calcularHuecosDisponibles(...)` y `seleccionarBoxLibre(...)`. Reciben `ahora: Date` y `tz: string` por parámetro; nunca leen el reloj del sistema.
- `dominio/autogestion.ts`: funciones puras `verificarPropiedadTurno(turno, pacienteId)` y `verificarPlazo24h(inicio, ahora)` con constante `VENTANA_AUTOGESTION_MS = 24 * 60 * 60 * 1000` (permite `inicio.getTime() - ahora.getTime() >= VENTANA_AUTOGESTION_MS`).
- `aplicacion/disponibilidad.ts`: `consultarDisponibilidad(consulta, deps)` parametrizada por `soloReservablesOnline: boolean` (reutilizada por `/api/public/disponibilidad` y `/api/recepcion/disponibilidad`).
- `aplicacion/reservar-turno.ts`: `reservarTurnoOnline(...)` y `reservarTurnoRecepcion(...)`, compartiendo el núcleo de validación de agenda, autoasignación de box, persistencia atómica bajo lock, auditoría y envío de confirmación vía C-06.
- `aplicacion/autogestion-paciente.ts`: `listarTurnosPropios`, `obtenerIcsPropio`, `cancelarTurnoPaciente`, `reprogramarTurnoPaciente`.
- `routes.ts`: plugin Fastify montado automáticamente bajo `/api`, con validación Zod en el borde (`400 FORMATO_INVALIDO`) y guardas `requireRol(...)`.

### D2 — Núcleo propio de reserva en vez de invocar `crearTurno` (C-02) directamente
- **Por qué**: `src/modules/turnos-alta/aplicacion/crear-turno.ts` (propiedad de C-02, no editable) fija `origen: sesion.rol === 'profesional' ? 'profesional' : 'recepcion'` (nunca `'online'`), no controla `prestacion.reservableOnline`, exige `boxId` obligatorio y dispara el correo simple `armarEmailDeAlta` sin Google Calendar ni `.ics`.
- **Alternativa descartada**: modificar C-02 (viola regla dura #3) o envolver `crearTurno` y luego sobrescribir `origen` (dejaría una auditoría `creado` inconsistente y enviaría un correo duplicado sin `.ics`).
- **Solución**: importar directamente las funciones puras `enGrilla`, `seSuperponen` y `conflictos` de `src/modules/turnos-alta/dominio/agenda.ts`, `disponibilidad.verificar` (C-03) y `enviarConfirmacionTurno` (C-06).

### D3 — Algoritmo de generación de huecos disponibles y formato de salida
- Cada hueco devuelto tiene forma `{ inicio: Date, fin: Date, profesionalId: string, boxIds: string[] }` (serializado a ISO por Fastify), ordenado por `inicio` ascendente y luego `profesionalId`.
- Dado `[desde, hasta)` y `prestacion.duracionMin`, se parte del primer instante múltiplo de 15 minutos `>= max(desde, ahora)` verificado con `enGrilla(candidato, tz)` y se avanza de a 15 minutos mientras `candidato + duracionMin <= hasta`.
- Para cada profesional activo (o solo el solicitado si viene `profesionalId`):
  1. Verifica `estaDentroDeHorario(...)` (`src/modules/configuracion/dominio/reglas.ts`) usando `enZonaConsultorio(candidato, tz)` y `enZonaConsultorio(fin, tz)`.
  2. Descarta si existe algún bloqueo de ese profesional que se superponga (`haySolapamientoIntervalos`).
  3. Descarta si existe algún turno no cancelado de ese profesional que se superponga (`seSuperponen`).
  4. Recorre todos los boxes activos (ordenados por `id`) y conserva los que no tienen bloqueo ni turno activo superpuesto en `[candidato, fin)`.
  5. Emite el hueco únicamente si `boxIds.length > 0`.
- Si se pasa `profesionalId` explícito y ese profesional no existe → `404 NO_ENCONTRADO`; si existe pero `activo === false` → `409 RECURSO_INACTIVO`.

### D4 — `boxId` opcional con autoasignación determinística dentro del lock
- En `POST /api/paciente/turnos` y `POST /api/recepcion/turnos`, `boxId` es opcional:
  - Si `boxId` viene informado: se verifica existencia (`404 NO_ENCONTRADO`), `activo` (`409 RECURSO_INACTIVO`), disponibilidad vía `deps.disponibilidad.verificar(...)` (`FUERA_DE_HORARIO` / `EN_BLOQUEO`) y `conflictos(...)` (`SOLAPAMIENTO_PROFESIONAL` / `SOLAPAMIENTO_BOX`).
  - Si `boxId` se omite: dentro de `conLockDeAgenda`, se valida primero al profesional (horario `estaDentroDeHorario` → `FUERA_DE_HORARIO`, bloqueos del profesional → `EN_BLOQUEO`, turnos activos del profesional → `SOLAPAMIENTO_PROFESIONAL`) y luego `seleccionarBoxLibre(...)` elige el primer box activo (ordenado por `id`) sin bloqueo ni turno activo superpuesto. Si no hay boxes activos → `409 RECURSO_INACTIVO`; si ningún box activo está libre, devuelve `409 SOLAPAMIENTO_BOX` si al menos uno falló por turno superpuesto, o `409 EN_BLOQUEO` si todos los boxes activos estaban bloqueados.

### D5 — Alta atómica de paciente inline en `POST /api/recepcion/turnos` sin deadlock
- **Problema detectado**: `crearPaciente` en `src/modules/cuentas/aplicacion/pacientes.ts` adquiere `conLockDeAgenda` internamente; invocarlo desde adentro de otro `conLockDeAgenda` causaría un deadlock. Crearlo *antes* del lock dejaría un paciente huérfano si luego el horario falla por solapamiento.
- **Solución**: importar las funciones puras `normalizarEmail`, `normalizarDocumento` y `validarUnicidadPaciente` de `src/modules/cuentas/dominio/reglas.ts`. Dentro de un **único** `conLockDeAgenda`:
  1. Validar unicidad del paciente inline (`409 DUPLICADO`).
  2. Validar todas las reglas de agenda, disponibilidad, box y solapamientos.
  3. Recién cuando todas las validaciones pasan, persistir el nuevo `Paciente` (sin `usuarioId`), registrar la auditoría `creado` y guardar el `Turno`.
- En el borde HTTP (Zod `.superRefine`), el body exige **exactamente uno** de `pacienteId` o `paciente` (ambos o ninguno → `400 FORMATO_INVALIDO`).

### D6 — Prestaciones con `reservableOnline: false`
- `CODIGOS_NEGOCIO` está congelado en C-01. En `GET /api/public/disponibilidad` y `POST /api/paciente/turnos`, una prestación existente con `!activa || !reservableOnline` responde `409 RECURSO_INACTIVO`. En `GET /api/recepcion/disponibilidad` y `POST /api/recepcion/turnos`, solo se requiere `prestacion.activa === true`.

### D7 — Delegación a C-05 y C-10 + correo único con Google Calendar e `.ics` en reprogramación
- `cancelarTurnoPaciente`: valida propiedad (`404 NO_ENCONTRADO`), estado operable (`reservado | confirmado`, sino `409 TRANSICION_INVALIDA`) y ventana 24 h (`409 PLAZO_VENCIDO`), luego delega en `cancelarTurno({ turnoId, actor: 'paciente' }, deps)` (C-05).
- `reprogramarTurnoPaciente`: aplica los mismos tres chequeos sobre el turno original (la ventana 24 h siempre evalúa `turno.inicio` original) y delega en `reprogramarTurno({ turnoId, cambios, actor: 'paciente' }, { ...deps, notificador: notificadorNoop })` (C-10) para suprimir el correo plano que C-10 emite internamente. Una vez persistido el cambio, invoca `enviarConfirmacionTurno` (C-06) con `tipo: 'reprogramado'` y `sequence` igual a la cantidad de eventos `reprogramado` registrados para ese turno en `deps.repos.auditoria` (envuelto en `try/catch` para cumplir `RN-NO-02`).

### D8 — Auditoría y actor
- `POST /api/paciente/turnos`: registra auditoría `creado` con `actor: 'paciente'` (consistente con `cancelar` y `reprogramar` del paciente).
- `POST /api/recepcion/turnos`: registra auditoría `creado` con `actor: sesion.usuarioId` (consistente con C-02).
- La escritura de auditoría sigue el patrón seguro de C-05/C-10 (registra antes de guardar el turno y compensa con `revertido: true` si el guardado falla).

### D9 — Privacidad, roles y descarga `.ics`
- `/api/public/disponibilidad`: sin autenticación (`esRutaPublica` en `src/app.ts`).
- `/api/paciente/*`: `requireRol('paciente')`, `pacienteId` tomado de `sesionDe(request).pacienteId` (si falta, `403 SIN_PERMISO`). Turno inexistente o de otro paciente → `404 NO_ENCONTRADO` (`RN-RE-03`).
- `/api/paciente/turnos/:id/calendario.ics`: carga `turno`, `paciente`, `profesional`, `box` y `prestacion`, llama `generarIcs(datos, deps.clock.ahora())` (C-06) y responde `200` con `Content-Type: text/calendar; charset=utf-8` y `Content-Disposition: attachment; filename="turno-<id>.ics"`.
- `/api/recepcion/*`: `requireRol('recepcionista', 'profesional')`. El hook global `preSerialization` (`sinPrecioPara`) elimina `precio` y `precioAlReservar` para `paciente`, `recepcionista` y rutas públicas (`RN-RO-01`).

### Supuestos aplicados
- **PA-05 (`knowledge-base/10_preguntas_abiertas.md`)**: sin límite máximo de anticipación para consultar disponibilidad ni para reservar online.
- **Ventana de 24 h en reprogramación (`RN-RE-02`)**: aplica sobre el `inicio` original del turno que el paciente desea modificar; el nuevo horario solicitado se rige por `RN-AG-10` (no en el pasado) y el resto de reglas de agenda.

## Risks / Trade-offs

- **Rango de fechas muy amplio en `GET /*/disponibilidad`**: iterar cada 15 minutos sobre rangos enormes (años) podría generar respuestas muy grandes → mitigación: para el MVP se cumple PA-05 sin tope de anticipación futura, manteniendo un algoritmo lineal $O(\text{slots} \times (\text{profesionales} + \text{boxes}))$ liviano sobre repositorios en memoria; un límite de ancho de ventana de consulta (p. ej. por días) puede agregarse si se detecta abuso.
- **No-op notificador al delegar a C-10**: si en el futuro EP migra C-10 a `enviarConfirmacionTurno`, C-11 seguirá enviando exactamente un correo completo sin duplicación mientras conserve el notificador no-op, o podrá retirar el envoltorio en una limpieza posterior.
- **Cambio concurrente entre chequeo previo y lock en `cancelar`/`reprogramar` del paciente**: el `pacienteId` de un turno nunca cambia y el reloj en tests/runtime avanza monotónicamente; si el estado cambiara concurrentemente a un estado final justo antes del lock de C-05/C-10, la máquina de estados dentro del lock de C-05/C-10 igual lo rechaza con `409 TRANSICION_INVALIDA`.

## UI Mockups

- Design system revision: no aplica
- Decision: no (no UI) — 2026-11-23
