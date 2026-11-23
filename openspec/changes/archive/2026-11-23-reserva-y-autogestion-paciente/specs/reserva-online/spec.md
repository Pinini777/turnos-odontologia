# Spec Delta

## Purpose

Habilita la consulta de huecos disponibles en grilla de 15 minutos con boxes libres, la reserva online y autogestión de turnos del paciente (listado propio, descarga `.ics`, cancelación y reprogramación con ventana de 24 horas) y el registro asistido de turnos desde recepción para pacientes existentes o nuevos (presenciales o telefónicos).

> Convenciones de los escenarios: todos los datos de pacientes son ficticios (RN-DA-01), la zona horaria del consultorio es `America/Argentina/Mendoza` (`-03:00`) y el horario semilla de los profesionales es lunes a viernes de 09:00 a 13:00 y de 15:00 a 19:00.

## ADDED Requirements

### Requirement: Consulta pública de disponibilidad
The system SHALL expose `GET /api/public/disponibilidad` without authentication for active prestaciones with `reservableOnline: true`, returning ordered 15-minute free slots `{ inicio, fin, profesionalId, boxIds }` at or after current time with at least one free active box, and MUST NOT expose prices or patient data.

#### Scenario: Consulta pública feliz devuelve huecos con profesionales y boxes libres sin precios ni pacientes
- **GIVEN** el reloj fijado en lunes 2026-11-30T08:00:00-03:00, dos profesionales activos y dos boxes activos (`box1`, `box2`) con prestación activa reservable online `Consulta odontológica` (30 min)
- **WHEN** un cliente anónimo solicita `GET /api/public/disponibilidad?prestacionId=<consulta>&desde=2026-11-30T09:00:00-03:00&hasta=2026-11-30T10:00:00-03:00`
- **THEN** responde `200` con huecos en grilla de 15 minutos (`09:00–09:30`, `09:15–09:45`, `09:30–10:00`) para cada profesional activo incluyendo `boxIds: [<box1>, <box2>]`
- **AND** ningún objeto de la respuesta incluye `precio`, `precioAlReservar` ni datos de pacientes

#### Scenario: Excluye huecos ocupados por turnos activos y bloqueos, conservando el hueco si queda otro box libre
- **GIVEN** el reloj en 2026-11-30T08:00:00-03:00, un turno activo de Dra. Ana Pérez en `box1` de 09:00 a 09:30 y un bloqueo en `box2` de 10:00 a 10:30
- **WHEN** se consulta `GET /api/public/disponibilidad` para `Consulta odontológica` (30 min) entre 09:00 y 11:00
- **THEN** para Dra. Ana Pérez no aparecen huecos que se superpongan con `[09:00, 09:30)` (como `09:00` ni `09:15`), mientras que para Dr. Bruno Gómez el hueco `09:00–09:30` aparece con solo `box2` en `boxIds`
- **AND** en el tramo `[10:00, 10:30)` solo figura `box1` en `boxIds`

#### Scenario: Turno cancelado no descuenta disponibilidad y el borde contiguo se permite
- **GIVEN** un turno `cancelado` de Dra. Ana Pérez en `box1` de 09:00 a 09:30 y un turno `reservado` de Dra. Ana Pérez en `box1` de 10:00 a 10:30
- **WHEN** se consulta disponibilidad para una prestación de 30 min entre 09:00 y 11:00 filtrando por `profesionalId` de Dra. Ana Pérez
- **THEN** el hueco `09:00–09:30` aparece disponible con `box1` y `box2`
- **AND** el hueco contiguo `10:30–11:00` aparece disponible con `box1` y `box2` mientras que `10:15–10:45` queda excluido

#### Scenario: Excluye huecos en el pasado respecto al reloj actual
- **GIVEN** el reloj fijado en lunes 2026-11-30T09:30:00-03:00
- **WHEN** se consulta `GET /api/public/disponibilidad` con `desde=2026-11-30T09:00:00-03:00` y `hasta=2026-11-30T10:30:00-03:00` para una prestación de 30 min
- **THEN** los huecos `09:00` y `09:15` no se devuelven y el primer hueco devuelto comienza a las `09:30`

#### Scenario: Prestación inexistente o no reservable online es rechazada
- **GIVEN** la prestación semilla `Extracción simple` con `reservableOnline: false`
- **WHEN** se consulta `GET /api/public/disponibilidad` con `prestacionId` inexistente
- **THEN** responde `404` con `{ "code": "NO_ENCONTRADO" }`
- **AND** al consultar con `prestacionId` de `Extracción simple` (o una prestación inactiva) responde `409` con `{ "code": "RECURSO_INACTIVO" }`

#### Scenario: Parámetros de consulta inválidos devuelven 400
- **GIVEN** una consulta pública con `desde` posterior o igual a `hasta` o fechas sin offset
- **WHEN** se invoca `GET /api/public/disponibilidad`
- **THEN** responde `400` con `{ "code": "FORMATO_INVALIDO" }`

### Requirement: Reserva online de turno por paciente autenticado
The system SHALL expose `POST /api/paciente/turnos` for role `paciente`, deriving `pacienteId` from the session. It MUST validate active `reservableOnline: true` prestación, schedule rules and optional `boxId` (auto-assigning a free active box atomically), create `origen: 'online'` with `actor: 'paciente'` audit, omit prices and send Google Calendar + `.ics` confirmation without reverting on SMTP error.

#### Scenario: Reserva online feliz con boxId explícito crea turno, auditoría y email completo sin precio
- **GIVEN** el reloj en 2026-11-30T08:00:00-03:00 y un paciente autenticado (`Paciente Ficticio Uno`)
- **WHEN** envía `POST /api/paciente/turnos` con `{ profesionalId, boxId, prestacionId: <consulta>, inicio: '2026-11-30T10:00:00-03:00' }`
- **THEN** responde `201` con el turno en estado `reservado`, `origen: 'online'`, `pacienteId` igual al de la sesión y sin `precio` ni `precioAlReservar`
- **AND** queda un registro de auditoría `creado` con `actor: 'paciente'` y en el outbox un correo sin precio que incluye link de Google Calendar y adjunto `turno.ics`

#### Scenario: Reserva online sin boxId autoasigna el primer box activo libre
- **GIVEN** el reloj en 2026-11-30T08:00:00-03:00 y `box1` ocupado de 10:00 a 10:30 por otro profesional, quedando `box2` libre
- **WHEN** el paciente autenticado envía `POST /api/paciente/turnos` omitiendo `boxId` para Dr. Bruno Gómez a las `2026-11-30T10:00:00-03:00`
- **THEN** responde `201` con el turno asignado a `box2`

#### Scenario: Reservas concurrentes sobre el mismo hueco serializan el acceso y solo una tiene éxito
- **GIVEN** dos pacientes autenticados intentando reservar al mismo tiempo el mismo profesional y horario `2026-11-30T10:00:00-03:00`
- **WHEN** ambos envían `POST /api/paciente/turnos` en paralelo con `Promise.all`
- **THEN** exactamente una solicitud responde `201` y la otra responde `409` con `{ "code": "SOLAPAMIENTO_PROFESIONAL" }`

#### Scenario: Prestación no reservable online o inactiva se rechaza con RECURSO_INACTIVO
- **GIVEN** un paciente autenticado y la prestación `Extracción simple` (`reservableOnline: false`)
- **WHEN** envía `POST /api/paciente/turnos` con esa `prestacionId`
- **THEN** responde `409` con `{ "code": "RECURSO_INACTIVO" }` y no crea ningún turno

#### Scenario: Reglas de agenda y falta de box libre rechazan la reserva con código de negocio
- **GIVEN** un paciente autenticado con reloj en 2026-11-30T09:00:00-03:00
- **WHEN** intenta reservar fuera de grilla (`09:07`), en el pasado (`08:45`), fuera de horario (`14:00`), en un bloqueo o en un horario con todos los boxes activos ocupados
- **THEN** responde `409` con `FUERA_DE_GRILLA`, `EN_EL_PASADO`, `FUERA_DE_HORARIO`, `EN_BLOQUEO` o `SOLAPAMIENTO_BOX` respectivamente

#### Scenario: Fallo de envío SMTP no revierte la reserva online
- **GIVEN** un notificador configurado para fallar al enviar correos
- **WHEN** el paciente autenticado reserva un hueco libre por `POST /api/paciente/turnos`
- **THEN** responde `201` y el turno persiste en estado `reservado`

#### Scenario: Control de acceso en reserva online
- **GIVEN** un cliente sin token o autenticado con rol `recepcionista` o `profesional`
- **WHEN** invoca `POST /api/paciente/turnos`
- **THEN** responde `401 NO_AUTENTICADO` sin token y `403 SIN_PERMISO` para roles distintos de `paciente`

### Requirement: Consulta de turnos propios del paciente
The system SHALL expose `GET /api/paciente/turnos` restricted to role `paciente`, returning only appointments whose `pacienteId` matches the authenticated session, ordered by `inicio` ascending, without exposing `precio` or `precioAlReservar`.

#### Scenario: Lista únicamente los turnos propios ordenados por inicio y sin precios
- **GIVEN** un turno reservado y uno cancelado de `Paciente Ficticio Uno`, y otro turno perteneciente a `Paciente Ficticio Dos`
- **WHEN** `Paciente Ficticio Uno` consulta `GET /api/paciente/turnos`
- **THEN** responde `200` con solo sus dos turnos ordenados por `inicio` ascendente y sin `precio` ni `precioAlReservar`

#### Scenario: Paciente sin turnos recibe lista vacía y otros roles reciben 403
- **GIVEN** un paciente autenticado sin turnos registrados y una recepcionista autenticada
- **WHEN** ambos consultan `GET /api/paciente/turnos`
- **THEN** el paciente recibe `200 []` y la recepcionista recibe `403` con `{ "code": "SIN_PERMISO" }`

### Requirement: Descarga de archivo calendario .ics de turno propio
The system SHALL expose `GET /api/paciente/turnos/:id/calendario.ics` restricted to role `paciente`, verifying that the appointment exists and belongs to the authenticated patient (returning `404 NO_ENCONTRADO` otherwise) and returning a valid RFC 5545 `text/calendar` payload without price.

#### Scenario: Descarga feliz de calendario .ics de un turno propio sin precio
- **GIVEN** un turno perteneciente a `Paciente Ficticio Uno`
- **WHEN** `Paciente Ficticio Uno` solicita `GET /api/paciente/turnos/:id/calendario.ics`
- **THEN** responde `200` con cabecera `Content-Type` que contiene `text/calendar`, cuerpo con `BEGIN:VCALENDAR`, `BEGIN:VEVENT`, profesional, box y prestación, y sin incluir ningún precio

#### Scenario: Descarga de .ics sobre turno ajeno o inexistente devuelve 404
- **GIVEN** un turno perteneciente a `Paciente Ficticio Dos`
- **WHEN** `Paciente Ficticio Uno` solicita `GET /api/paciente/turnos/:id/calendario.ics` con ese ID o con un ID inexistente
- **THEN** responde `404` con `{ "code": "NO_ENCONTRADO" }`

### Requirement: Cancelación de turno por el paciente con ventana de 24 horas
The system SHALL expose `POST /api/paciente/turnos/:id/cancelar` restricted to role `paciente`. It MUST enforce ownership (`404 NO_ENCONTRADO`), cancellable state (`409 TRANSICION_INVALIDA`), and the 24-hour notice rule using `Clock` (`ahora > inicio - 24h` → `409 PLAZO_VENCIDO`, exact 24 hours allowed), transitioning the turno to `cancelado` without physical deletion and recording audit with `actor: 'paciente'`.

#### Scenario: Cancelación feliz con 25 horas de anticipación
- **GIVEN** un turno `reservado` de `Paciente Ficticio Uno` con inicio `2026-12-01T10:00:00-03:00` y reloj en `2026-11-30T09:00:00-03:00` (25 horas antes)
- **WHEN** el paciente invoca `POST /api/paciente/turnos/:id/cancelar`
- **THEN** responde `200` con `estado: 'cancelado'` sin precios, el turno sigue persistido y queda auditoría `cancelado` con `actor: 'paciente'`

#### Scenario: Borde exacto de 24 horas de anticipación se permite
- **GIVEN** un turno `reservado` de `Paciente Ficticio Uno` con inicio `2026-12-01T10:00:00-03:00` y reloj en `2026-11-30T10:00:00-03:00` (exactamente 24 horas antes)
- **WHEN** el paciente invoca `POST /api/paciente/turnos/:id/cancelar`
- **THEN** responde `200` con `estado: 'cancelado'`

#### Scenario: Cancelación con 23 horas de anticipación se rechaza con PLAZO_VENCIDO
- **GIVEN** un turno `reservado` de `Paciente Ficticio Uno` con inicio `2026-12-01T10:00:00-03:00` y reloj en `2026-11-30T11:00:00-03:00` (23 horas antes)
- **WHEN** el paciente invoca `POST /api/paciente/turnos/:id/cancelar`
- **THEN** responde `409` con `{ "code": "PLAZO_VENCIDO" }` y el turno permanece `reservado`

#### Scenario: Cancelar turno en estado final o turno ajeno se rechaza
- **GIVEN** un turno propio ya `cancelado` y un turno perteneciente a otro paciente
- **WHEN** `Paciente Ficticio Uno` invoca `POST /api/paciente/turnos/:id/cancelar` sobre cada uno
- **THEN** devuelve `409 TRANSICION_INVALIDA` para el turno en estado final y `404 NO_ENCONTRADO` para el turno ajeno

### Requirement: Reprogramación de turno por el paciente con ventana de 24 horas
The system SHALL expose `PATCH /api/paciente/turnos/:id/reprogramar` for role `paciente`. It MUST enforce ownership (`404`), operable state (`409 TRANSICION_INVALIDA`), 24-hour notice on original `inicio` (`409 PLAZO_VENCIDO`, exact 24h allowed), schedule rules excluding self, audit `reprogramado` with `actor: 'paciente'`, and send one confirmation email with Google Calendar link and updated `.ics` without price.

#### Scenario: Reprogramación feliz con 25 horas de anticipación actualiza el turno y envía un único email con Google Calendar e .ics
- **GIVEN** un turno `reservado` de `Paciente Ficticio Uno` el `2026-12-01T10:00:00-03:00` (30 min) y reloj en `2026-11-30T09:00:00-03:00`
- **WHEN** el paciente envía `PATCH /api/paciente/turnos/:id/reprogramar` con `{ inicio: '2026-12-01T10:15:00-03:00' }`
- **THEN** responde `200` con `inicio: 10:15`, `fin: 10:45`, `estado: 'reservado'`, sin precios, registra auditoría `reprogramado` con `actor: 'paciente'`
- **AND** el outbox contiene exactamente un correo de reprogramación sin precio con link de Google Calendar y adjunto `turno.ics` actualizado

#### Scenario: Borde exacto de 24 horas de anticipación permite reprogramar y con 23 horas rechaza con PLAZO_VENCIDO
- **GIVEN** un turno `reservado` con inicio `2026-12-01T10:00:00-03:00`
- **WHEN** el paciente reprograma a un hueco libre con reloj en `2026-11-30T10:00:00-03:00` (24 h) y en otro caso con reloj en `2026-11-30T11:00:00-03:00` (23 h)
- **THEN** con 24 horas exactas responde `200` y con 23 horas responde `409` con `{ "code": "PLAZO_VENCIDO" }`

#### Scenario: Reprogramación sobre hueco ocupado, estado final o turno ajeno se rechaza
- **GIVEN** un turno propio `reservado` con más de 24 h de anticipación, otro turno en el horario destino, un turno propio `cancelado` y un turno ajeno
- **WHEN** el paciente intenta reprogramar cada caso
- **THEN** devuelve `409 SOLAPAMIENTO_PROFESIONAL` (o `SOLAPAMIENTO_BOX`) ante choque sin modificar el original, `409 TRANSICION_INVALIDA` en estado final y `404 NO_ENCONTRADO` para turno ajeno

### Requirement: Consulta de disponibilidad asistida para recepción y profesionales
The system SHALL expose `GET /api/recepcion/disponibilidad` restricted to roles `recepcionista` and `profesional`, returning ordered free slots `{ inicio, fin, profesionalId, boxIds }` on the 15-minute grid for any active prestación (including those with `reservableOnline: false`), without exposing prices to `recepcionista`.

#### Scenario: Recepcionista consulta disponibilidad para prestación no reservable online y recibe huecos con boxes libres
- **GIVEN** una recepcionista autenticada, reloj en 2026-11-30T08:00:00-03:00 y la prestación activa `Extracción simple` (60 min, `reservableOnline: false`)
- **WHEN** solicita `GET /api/recepcion/disponibilidad?prestacionId=<extraccion>&desde=2026-11-30T09:00:00-03:00&hasta=2026-11-30T10:30:00-03:00`
- **THEN** responde `200` con huecos de 60 minutos (`09:00–10:00`, `09:15–10:15`, `09:30–10:30`) indicando profesionales activos y `boxIds` libres, sin precios

#### Scenario: Prestación inactiva, inexistente o rol paciente son rechazados
- **GIVEN** una prestación inactiva, un ID inexistente y un usuario con rol `paciente`
- **WHEN** se consulta `GET /api/recepcion/disponibilidad`
- **THEN** responde `409 RECURSO_INACTIVO` para la inactiva, `404 NO_ENCONTRADO` para la inexistente y `403 SIN_PERMISO` para el paciente

### Requirement: Registro asistido de turno por recepción para paciente existente o nuevo
The system SHALL expose `POST /api/recepcion/turnos` for roles `recepcionista` and `profesional`, accepting mutually exclusive `pacienteId` or inline `paciente`, any active prestación and optional `boxId`. It MUST atomically validate schedule and patient uniqueness (no orphan patient on failure), record `creado` audit with `actor: sesion.usuarioId`, omit prices for `recepcionista`, and send Google Calendar + `.ics` confirmation.

#### Scenario: Recepcionista agenda turno presencial para paciente existente con prestación no online y box automático
- **GIVEN** una recepcionista autenticada, reloj en 2026-11-30T08:00:00-03:00, `Paciente Ficticio Dos` y `Extracción simple` (`reservableOnline: false`)
- **WHEN** envía `POST /api/recepcion/turnos` con `{ pacienteId: <dos>, profesionalId, prestacionId: <extraccion>, inicio: '2026-11-30T09:00:00-03:00' }` sin `boxId`
- **THEN** responde `201` con `origen: 'recepcion'`, `estado: 'reservado'`, un `boxId` activo libre asignado y sin `precio` ni `precioAlReservar`
- **AND** registra auditoría `creado` con `actor` igual al `usuarioId` de la recepcionista y envía correo con link de Google Calendar y `.ics` sin precio

#### Scenario: Recepcionista registra turno presencial o telefónico creando paciente nuevo inline de forma atómica
- **GIVEN** una recepcionista autenticada y datos ficticios de un paciente no registrado (`Paciente Ficticio Tres`, DNI `00000003`, `paciente3@example.com`)
- **WHEN** envía `POST /api/recepcion/turnos` con `{ paciente: { nombre, apellido, documento, email, telefono }, profesionalId, prestacionId: <consulta>, inicio: '2026-11-30T10:00:00-03:00' }`
- **THEN** responde `201` con el turno creado (`origen: 'recepcion'`) vinculado al nuevo `pacienteId`, sin precios
- **AND** el paciente queda persistido sin `usuarioId` en el repositorio de pacientes y el correo de confirmación llega a `paciente3@example.com`

#### Scenario: Fallo de agenda durante alta inline no persiste un paciente huérfano
- **GIVEN** un turno ya reservado para Dra. Ana Pérez el `2026-11-30T10:00:00-03:00` y datos ficticios de un paciente nuevo (`DNI 00000004`, `paciente4@example.com`)
- **WHEN** la recepcionista envía `POST /api/recepcion/turnos` con ese paciente inline en el mismo horario ocupado
- **THEN** responde `409` con `{ "code": "SOLAPAMIENTO_PROFESIONAL" }`
- **AND** ningún paciente con DNI `00000004` queda guardado en el repositorio

#### Scenario: Alta inline con documento o email duplicado se rechaza con DUPLICADO
- **GIVEN** `Paciente Ficticio Uno` ya registrado con DNI `00000001` y `paciente1@example.com`
- **WHEN** la recepcionista envía `POST /api/recepcion/turnos` con datos inline que repiten ese documento o ese email
- **THEN** responde `409` con `{ "code": "DUPLICADO" }` y no crea ningún turno

#### Scenario: Validación de entrada y control de acceso en registro asistido
- **GIVEN** un payload que incluye tanto `pacienteId` como `paciente` (o ninguno de los dos), o una llamada realizada con rol `paciente`
- **WHEN** se invoca `POST /api/recepcion/turnos`
- **THEN** responde `400 FORMATO_INVALIDO` ante payload ambiguo o incompleto y `403 SIN_PERMISO` para rol `paciente`
