# turnos-estados Specification

## Purpose

Ciclo de vida de un turno ya creado: las transiciones válidas entre estados, la cancelación lógica que libera el horario sin borrar el turno y el registro de auditoría append-only de cada cambio (RN-TU-01, RN-TU-03, RN-TU-05).

## Requirements

### Requirement: Transiciones de estado válidas
La API SHALL permitir solo estas transiciones: `reservado → confirmado`, `confirmado → atendido`, `confirmado → ausente`, `reservado → cancelado` y `confirmado → cancelado`. `atendido`, `ausente` y `cancelado` son finales. Cualquier otra transición, incluida la que deja el turno en el mismo estado, SHALL responder `409 TRANSICION_INVALIDA` y no modificar el turno.

#### Scenario: Confirmar un turno reservado
- **GIVEN** un turno en estado `reservado`
- **WHEN** una recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"confirmado"}`
- **THEN** recibe `200` con el turno en estado `confirmado`

#### Scenario: Atender un turno confirmado que ya empezó
- **GIVEN** un turno `confirmado` de 10:00 a 10:30 y la hora actual 10:10
- **WHEN** el profesional pide `POST /api/turnos/:id/estado` con `{"estado":"atendido"}`
- **THEN** recibe `200` con el turno en estado `atendido`

#### Scenario: Marcar ausente un turno confirmado que ya empezó
- **GIVEN** un turno `confirmado` de 10:00 a 10:30 y la hora actual 10:20
- **WHEN** la recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"ausente"}`
- **THEN** recibe `200` con el turno en estado `ausente`

#### Scenario: Atender un turno que nunca se confirmó
- **GIVEN** un turno `reservado` que ya empezó
- **WHEN** el profesional pide `POST /api/turnos/:id/estado` con `{"estado":"atendido"}`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}` y el turno sigue `reservado`

#### Scenario: Cambiar el estado de un turno final
- **GIVEN** un turno en estado `cancelado`
- **WHEN** el profesional pide `POST /api/turnos/:id/estado` con `{"estado":"atendido"}`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}` y el turno sigue `cancelado`

#### Scenario: Pedir el mismo estado que ya tiene
- **GIVEN** un turno en estado `confirmado`
- **WHEN** la recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"confirmado"}`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}`

### Requirement: Atendido o ausente solo después del inicio
La API SHALL permitir pasar un turno a `atendido` o `ausente` solo si la hora actual del consultorio es igual o posterior al `inicio` del turno. Antes del inicio SHALL responder `409 TRANSICION_INVALIDA`. Confirmar y cancelar no tienen restricción horaria.

#### Scenario: Atender antes de que empiece
- **GIVEN** un turno `confirmado` de 10:00 a 10:30 y la hora actual 09:59
- **WHEN** el profesional pide `POST /api/turnos/:id/estado` con `{"estado":"atendido"}`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}` y el turno sigue `confirmado`

#### Scenario: Marcar ausente justo a la hora de inicio
- **GIVEN** un turno `confirmado` de 10:00 a 10:30 y la hora actual exactamente 10:00
- **WHEN** la recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"ausente"}`
- **THEN** recibe `200` con el turno en estado `ausente`

#### Scenario: Confirmar un turno de la semana próxima
- **GIVEN** un turno `reservado` que empieza dentro de siete días
- **WHEN** la recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"confirmado"}`
- **THEN** recibe `200` con el turno en estado `confirmado`

### Requirement: Cancelación lógica
`POST /api/turnos/:id/cancelar` SHALL pasar a `cancelado` un turno `reservado` o `confirmado`, sin borrarlo: el turno sigue existiendo con todos sus datos y deja de ocupar el horario. Cancelar un turno en un estado final SHALL responder `409 TRANSICION_INVALIDA`.

#### Scenario: Cancelar un turno reservado
- **GIVEN** un turno en estado `reservado`
- **WHEN** una recepcionista pide `POST /api/turnos/:id/cancelar`
- **THEN** recibe `200` con el turno en estado `cancelado`
- **AND** el turno sigue guardado con el mismo profesional, box, paciente, inicio y fin

#### Scenario: Cancelar un turno confirmado que ya pasó
- **GIVEN** un turno `confirmado` que terminó hace una hora
- **WHEN** el profesional pide `POST /api/turnos/:id/cancelar`
- **THEN** recibe `200` con el turno en estado `cancelado`

#### Scenario: Cancelar un turno ya cancelado
- **GIVEN** un turno en estado `cancelado`
- **WHEN** una recepcionista pide `POST /api/turnos/:id/cancelar`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}`

#### Scenario: Cancelar un turno atendido
- **GIVEN** un turno en estado `atendido`
- **WHEN** el profesional pide `POST /api/turnos/:id/cancelar`
- **THEN** recibe `409` con `{"code":"TRANSICION_INVALIDA"}` y el turno sigue `atendido`

### Requirement: Estados aceptados por la ruta de estado
`POST /api/turnos/:id/estado` SHALL aceptar solo un cuerpo `{"estado": "confirmado" | "atendido" | "ausente"}`. Cualquier otro valor, incluidos `reservado` y `cancelado`, o un cuerpo sin `estado`, SHALL responder `400 FORMATO_INVALIDO` con un detalle sobre el campo `estado`.

#### Scenario: Intentar cancelar por la ruta de estado
- **WHEN** una recepcionista pide `POST /api/turnos/:id/estado` con `{"estado":"cancelado"}`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `estado`

#### Scenario: Cuerpo sin estado
- **WHEN** el profesional pide `POST /api/turnos/:id/estado` con `{}`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO`

### Requirement: Auditoría de cada cambio de estado
Cada cancelación o cambio de estado exitoso SHALL agregar un registro de auditoría append-only con el turno, la acción (`cancelado` o `estado_cambiado`), el usuario que lo hizo, la fecha y hora y el estado de antes y de después. Un intento rechazado SHALL NOT agregar registros.

#### Scenario: Auditoría de una cancelación
- **GIVEN** un turno `confirmado` y la hora actual 08:30
- **WHEN** la recepcionista lo cancela
- **THEN** existe un registro con acción `cancelado`, el usuario de la recepcionista como actor, fecha 08:30, estado anterior `confirmado` y estado nuevo `cancelado`

#### Scenario: Auditoría de un cambio de estado
- **GIVEN** un turno `reservado`
- **WHEN** el profesional lo pasa a `confirmado`
- **THEN** existe un registro con acción `estado_cambiado`, el usuario del profesional como actor, estado anterior `reservado` y estado nuevo `confirmado`

#### Scenario: Un rechazo no deja auditoría
- **GIVEN** un turno `cancelado` con un registro de auditoría
- **WHEN** alguien intenta cancelarlo otra vez y recibe `409`
- **THEN** el turno sigue teniendo un solo registro de auditoría

### Requirement: Acceso a las rutas de estado
Las rutas `POST /api/turnos/:id/cancelar` y `POST /api/turnos/:id/estado` SHALL estar disponibles solo para las sesiones `profesional` y `recepcionista`. Una sesión `paciente` SHALL recibir `403 SIN_PERMISO`. Un turno inexistente SHALL responder `404 NO_ENCONTRADO`. La respuesta exitosa SHALL incluir el turno actualizado, sin precio para la recepcionista.

#### Scenario: Un paciente usa la ruta de recepción
- **GIVEN** un turno `reservado` del propio paciente
- **WHEN** el paciente pide `POST /api/turnos/:id/cancelar`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}` y el turno sigue `reservado`

#### Scenario: Turno inexistente
- **WHEN** una recepcionista pide `POST /api/turnos/no-existe/estado` con `{"estado":"confirmado"}`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

#### Scenario: La recepcionista no ve el precio
- **WHEN** una recepcionista cancela un turno
- **THEN** la respuesta no incluye `precioAlReservar`
