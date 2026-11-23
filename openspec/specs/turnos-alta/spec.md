# turnos-alta Specification

## Purpose

Alta de turnos por el personal del consultorio (profesional o recepcionista) sin que ningún profesional ni box quede con dos turnos superpuestos, con intervalos `[inicio, fin)`, grilla de 15 minutos y sin sobreturnos (US-010, F-01).

> Convenciones de los escenarios: datos semilla ficticios (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1, Box 2, "Consulta" de 30 minutos y $15000, "Paciente Ficticio Uno"). Horas en la zona del consultorio (`America/Argentina/Mendoza`, UTC−3). Salvo que se diga otra cosa, "ahora" es el lunes 23/11/2026 a las 08:00 y los turnos son del martes 24/11/2026.

## Requirements

### Requirement: Alta de un turno válido
El profesional y la recepcionista SHALL poder crear un turno con `POST /api/turnos` y `{profesionalId, boxId, prestacionId, pacienteId, inicio}`. El turno queda `reservado`, con `fin = inicio + duración de la prestación`, el precio de la prestación congelado en `precioAlReservar`, `creadoPor` igual al usuario de la sesión y `origen` `recepcion` o `profesional` según el rol. La API responde `201` con el turno.

#### Scenario: La recepcionista crea un turno en un hueco libre
- **GIVEN** la Dra. Pérez y el Box 1 no tienen turnos el martes
- **WHEN** la recepcionista crea una "Consulta" con la Dra. Pérez en el Box 1 para "Paciente Ficticio Uno" el martes a las 10:00
- **THEN** la API responde `201` con un turno `reservado` de 10:00 a 10:30, `origen` `recepcion`
- **AND** la respuesta no incluye `precioAlReservar`
- **AND** el turno queda guardado con `precioAlReservar` 15000

#### Scenario: El profesional ve el precio congelado
- **GIVEN** la Dra. Pérez y el Box 1 están libres el martes a las 11:00
- **WHEN** la Dra. Pérez crea una "Consulta" para ese horario
- **THEN** la API responde `201` con `origen` `profesional` y `precioAlReservar` 15000

### Requirement: Sin solapamiento por profesional
Un profesional MUST NOT tener dos turnos no cancelados que se superpongan. Dos turnos `a` y `b` se superponen si `a.inicio < b.fin` y `b.inicio < a.fin`. El rechazo responde `409 SOLAPAMIENTO_PROFESIONAL` y no guarda turno, auditoría ni email.

#### Scenario: El profesional ya está ocupado en otro box
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea un turno con la Dra. Pérez en el Box 2 a las 10:15
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`
- **AND** no se guarda ningún turno nuevo, ni registro de auditoría, ni email

### Requirement: Sin solapamiento por box
Un box MUST NOT tener dos turnos no cancelados que se superpongan, con la misma definición de superposición. El rechazo responde `409 SOLAPAMIENTO_BOX`.

#### Scenario: El box ya está ocupado por otro profesional
- **GIVEN** el Dr. Gómez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea un turno con la Dra. Pérez en el Box 1 a las 10:15
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`

### Requirement: Choque con los dos recursos
Cuando el turno nuevo choca a la vez con el profesional y con el box, la API SHALL responder `409 SOLAPAMIENTO_PROFESIONAL`. Ajuste a RN-AG-03: el contrato de errores de `plataforma` devuelve un único código.

#### Scenario: Profesional y box ocupados en el mismo intervalo
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea otro turno con la Dra. Pérez en el Box 1 a las 10:00
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`

### Requirement: Intervalos semiabiertos
Los turnos SHALL ocupar el intervalo semiabierto `[inicio, fin)`: un turno que empieza exactamente cuando termina otro del mismo profesional o box no se superpone.

#### Scenario: Turno que empieza justo cuando termina otro
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea una "Consulta" con la Dra. Pérez en el Box 1 a las 10:30
- **THEN** la API responde `201` con un turno de 10:30 a 11:00

#### Scenario: Turno que termina justo cuando empieza otro
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea una "Consulta" con la Dra. Pérez en el Box 1 a las 09:30
- **THEN** la API responde `201` con un turno de 09:30 a 10:00

#### Scenario: Turno que empieza antes de que termine otro
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea una "Consulta" con la Dra. Pérez en el Box 1 a las 10:15
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`

### Requirement: Un turno cancelado libera el horario
Los turnos en estado `cancelado` MUST NOT contar para los solapamientos de profesional ni de box.

#### Scenario: Se reserva el hueco de un turno cancelado
- **GIVEN** la Dra. Pérez tiene un turno `cancelado` de 10:00 a 10:30 en el Box 1
- **WHEN** la recepcionista crea una "Consulta" con la Dra. Pérez en el Box 1 a las 10:00
- **THEN** la API responde `201`

### Requirement: Sin sobreturnos
La API MUST NOT ofrecer ninguna forma de forzar un turno superpuesto, para ningún rol. Un campo extra en el cuerpo no cambia la validación.

#### Scenario: El profesional intenta forzar un sobreturno
- **GIVEN** la Dra. Pérez tiene un turno de 10:00 a 10:30 en el Box 1
- **WHEN** la Dra. Pérez crea un turno en el Box 2 a las 10:00 con `"sobreturno": true` en el cuerpo
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`

### Requirement: Grilla de 15 minutos
El `inicio` SHALL caer en la grilla de 15 minutos de la zona del consultorio: minutos 00, 15, 30 o 45, con segundos y milisegundos en 0. Si no, la API responde `409 FUERA_DE_GRILLA`.

#### Scenario: Inicio fuera de la grilla
- **WHEN** la recepcionista crea un turno el martes a las 10:10
- **THEN** la API responde `409` con `{"code":"FUERA_DE_GRILLA"}`

#### Scenario: Inicio con segundos
- **WHEN** la recepcionista crea un turno el martes a las 10:15:30
- **THEN** la API responde `409` con `{"code":"FUERA_DE_GRILLA"}`

### Requirement: Turnos en el pasado
Un turno con `inicio` anterior al instante actual del reloj del sistema MUST ser rechazado con `409 EN_EL_PASADO`.

#### Scenario: Inicio anterior a ahora
- **GIVEN** ahora es el lunes 23/11/2026 a las 08:00
- **WHEN** la recepcionista crea un turno el viernes 20/11/2026 a las 10:00
- **THEN** la API responde `409` con `{"code":"EN_EL_PASADO"}`

### Requirement: Recursos existentes y activos
El profesional, el box, la prestación y el paciente MUST existir; si alguno no existe, la API responde `404 NO_ENCONTRADO`. El profesional, el box y la prestación MUST estar activos; si alguno está inactivo, responde `409 RECURSO_INACTIVO`.

#### Scenario: Paciente inexistente
- **WHEN** la recepcionista crea un turno con un `pacienteId` que no existe
- **THEN** la API responde `404` con `{"code":"NO_ENCONTRADO"}`

#### Scenario: Box inactivo
- **GIVEN** el Box 2 está inactivo
- **WHEN** la recepcionista crea un turno en el Box 2
- **THEN** la API responde `409` con `{"code":"RECURSO_INACTIVO"}`

### Requirement: Disponibilidad del profesional y del box
El alta SHALL consultar la disponibilidad (horario de atención y bloqueos) del profesional y del box para `[inicio, fin)`. Si la disponibilidad informa `FUERA_DE_HORARIO` o `EN_BLOQUEO`, la API responde `409` con ese código.

#### Scenario: Fuera del horario de atención
- **GIVEN** la disponibilidad informa que el intervalo está fuera del horario de la Dra. Pérez
- **WHEN** la recepcionista crea un turno con la Dra. Pérez en ese intervalo
- **THEN** la API responde `409` con `{"code":"FUERA_DE_HORARIO"}`

#### Scenario: Dentro de un bloqueo
- **GIVEN** la disponibilidad informa que el Box 1 está bloqueado en el intervalo
- **WHEN** la recepcionista crea un turno en el Box 1 en ese intervalo
- **THEN** la API responde `409` con `{"code":"EN_BLOQUEO"}`

### Requirement: Formato de la solicitud
Un cuerpo sin alguno de los cinco campos, con un identificador vacío o con un `inicio` que no es una fecha ISO 8601 con zona horaria SHALL responder `400` con `code` `FORMATO_INVALIDO`.

#### Scenario: Inicio inválido
- **WHEN** la recepcionista envía `"inicio": "mañana"`
- **THEN** la API responde `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `inicio`

### Requirement: Roles permitidos
Solo el profesional y la recepcionista SHALL poder usar `POST /api/turnos`. Sin sesión, la API responde `401`; con sesión de paciente, `403`.

#### Scenario: Un paciente intenta usar el alta del personal
- **WHEN** un paciente autenticado llama a `POST /api/turnos`
- **THEN** la API responde `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Sin sesión
- **WHEN** un cliente sin token llama a `POST /api/turnos`
- **THEN** la API responde `401` con `{"code":"NO_AUTENTICADO"}`

### Requirement: Altas simultáneas
La validación de disponibilidad y de solapamientos y el guardado del turno MUST ser atómicos: si dos altas compiten por el mismo hueco, la primera se crea y la segunda recibe `409 SOLAPAMIENTO_*`.

#### Scenario: Dos altas al mismo hueco a la vez
- **GIVEN** la Dra. Pérez y el Box 1 están libres el martes a las 10:00
- **WHEN** llegan a la vez dos altas con la Dra. Pérez en el Box 1 a las 10:00
- **THEN** una responde `201` y la otra `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`
- **AND** queda guardado un solo turno

### Requirement: Auditoría del alta
Cada turno creado SHALL dejar un registro de auditoría append-only con acción `creado`, el usuario de la sesión como actor, la fecha del reloj del sistema y el turno creado en el detalle.

#### Scenario: Registro de auditoría al crear
- **WHEN** la recepcionista crea un turno válido
- **THEN** existe un registro de auditoría `creado` para ese turno, con actor igual al usuario de la recepcionista

### Requirement: Aviso al paciente
Después de guardar el turno, el sistema SHALL enviar un email al paciente con fecha, hora, profesional, box y prestación, sin precio. Si el envío falla, el turno MUST quedar creado y la API responde `201` igual.

#### Scenario: Email de confirmación sin precio
- **WHEN** la recepcionista crea una "Consulta" para "Paciente Ficticio Uno" el martes a las 10:00
- **THEN** se envía un email a `paciente1@example.com` que menciona 24/11/2026, 10:00, Dra. Ana Pérez, Box 1 y Consulta
- **AND** el email no contiene el precio

#### Scenario: Falla el envío del email
- **GIVEN** el envío de emails falla
- **WHEN** la recepcionista crea un turno válido
- **THEN** la API responde `201` y el turno queda guardado
