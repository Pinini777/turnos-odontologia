# Spec Delta

## Purpose

Mover un turno existente a otro horario, profesional o box (US-012, F-02) con las mismas garantías de agenda que el alta, sin que el turno choque consigo mismo, con auditoría y reenvío del email de confirmación.

> Convenciones de los escenarios: datos semilla ficticios (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1, Box 2, "Consulta" de 30 minutos y $15000, "Paciente Ficticio Uno"). Horas en la zona del consultorio (`America/Argentina/Mendoza`, UTC−3). Salvo que se diga otra cosa, "ahora" es el lunes 23/11/2026 a las 08:00, los turnos son del martes 24/11/2026 y el turno a mover es una "Consulta" `reservado` de la Dra. Pérez en el Box 1 de 10:00 a 10:30.

## ADDED Requirements

### Requirement: Reprogramar un turno a un hueco libre
El profesional y la recepcionista SHALL poder mover un turno con `PATCH /api/turnos/:id/reprogramar` y `{inicio, profesionalId?, boxId?}`. Sin `profesionalId` o `boxId`, se conserva el actual. `fin` se recalcula como `inicio + duración de la prestación`. La prestación, el paciente, `precioAlReservar`, `creadoPor` y `creadoEn` no cambian. La API responde `200` con el turno actualizado.

#### Scenario: Mover el turno a otra hora del mismo día
- **GIVEN** la Dra. Pérez y el Box 1 están libres el martes a las 11:00
- **WHEN** la recepcionista pide `PATCH /api/turnos/:id/reprogramar` con `{"inicio":"2026-11-24T11:00:00-03:00"}`
- **THEN** la API responde `200` con el turno de 11:00 a 11:30, con la Dra. Pérez en el Box 1
- **AND** el turno guardado conserva su `id`, su paciente, su prestación y `precioAlReservar` 15000

#### Scenario: Mover el turno a otro profesional y otro box
- **GIVEN** el Dr. Gómez y el Box 2 están libres el martes a las 10:00
- **WHEN** la recepcionista lo reprograma con `{"inicio":"2026-11-24T10:00:00-03:00","profesionalId":"<Dr. Gómez>","boxId":"<Box 2>"}`
- **THEN** la API responde `200` con el turno de 10:00 a 10:30 con el Dr. Gómez en el Box 2

#### Scenario: La recepcionista no ve el precio
- **WHEN** la recepcionista reprograma el turno a un hueco libre
- **THEN** la respuesta no incluye `precioAlReservar`

### Requirement: Sin chocar consigo mismo
La comparación de solapamientos MUST excluir al propio turno que se reprograma: su intervalo actual no cuenta como ocupado.

#### Scenario: Mover 15 minutos un turno sobre su propio horario
- **GIVEN** la Dra. Pérez no tiene otros turnos el martes
- **WHEN** la recepcionista mueve el turno de 10:00–10:30 a las 10:15
- **THEN** la API responde `200` con el turno de 10:15 a 10:45

#### Scenario: Reprogramar al mismo horario
- **WHEN** la recepcionista reprograma el turno de las 10:00 a las 10:00, con el mismo profesional y box
- **THEN** la API responde `200` con el turno de 10:00 a 10:30

### Requirement: Sin solapamiento con otros turnos
El nuevo intervalo MUST NOT superponerse con otro turno no cancelado del mismo profesional (`409 SOLAPAMIENTO_PROFESIONAL`) ni del mismo box (`409 SOLAPAMIENTO_BOX`), con intervalos `[inicio, fin)`. Si chocan los dos recursos, responde `SOLAPAMIENTO_PROFESIONAL`. Un rechazo no modifica el turno ni agrega auditoría ni email.

#### Scenario: Chocar con otro turno del profesional
- **GIVEN** la Dra. Pérez tiene otro turno de 11:00 a 11:30 en el Box 2
- **WHEN** la recepcionista mueve el turno a las 11:15 en el Box 1
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`
- **AND** el turno sigue de 10:00 a 10:30, sin registros de auditoría nuevos ni emails

#### Scenario: Chocar con otro turno del box
- **GIVEN** el Dr. Gómez tiene un turno de 11:00 a 11:30 en el Box 1
- **WHEN** la recepcionista mueve el turno de la Dra. Pérez a las 11:00 en el Box 1
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`

#### Scenario: Mover justo a continuación de otro turno
- **GIVEN** la Dra. Pérez tiene otro turno de 11:00 a 11:30 en el Box 1
- **WHEN** la recepcionista mueve el turno a las 11:30
- **THEN** la API responde `200` con el turno de 11:30 a 12:00

#### Scenario: Un turno cancelado no ocupa el hueco
- **GIVEN** la Dra. Pérez tiene un turno `cancelado` de 11:00 a 11:30 en el Box 1
- **WHEN** la recepcionista mueve el turno a las 11:00
- **THEN** la API responde `200`

### Requirement: Validaciones de agenda del nuevo intervalo
El nuevo intervalo MUST cumplir las mismas reglas que el alta, con los mismos códigos: `inicio` en la grilla de 15 minutos (`409 FUERA_DE_GRILLA`), no anterior a ahora (`409 EN_EL_PASADO`), profesional y box existentes (`404 NO_ENCONTRADO`) y activos (`409 RECURSO_INACTIVO`), dentro del horario de atención (`409 FUERA_DE_HORARIO`) y fuera de bloqueos (`409 EN_BLOQUEO`). Un rechazo no modifica el turno.

#### Scenario: Nuevo inicio fuera de la grilla
- **WHEN** la recepcionista mueve el turno a las 10:10
- **THEN** la API responde `409` con `{"code":"FUERA_DE_GRILLA"}`

#### Scenario: Nuevo inicio en el pasado
- **WHEN** la recepcionista mueve el turno al viernes 20/11/2026 a las 10:00
- **THEN** la API responde `409` con `{"code":"EN_EL_PASADO"}`

#### Scenario: Turno cuyo horario original ya pasó
- **GIVEN** ahora es el martes 24/11/2026 a las 10:40 y el turno de 10:00 a 10:30 sigue `reservado`
- **WHEN** la recepcionista lo mueve al miércoles 25/11/2026 a las 10:00
- **THEN** la API responde `200`

#### Scenario: Fuera del horario de atención
- **WHEN** la recepcionista mueve el turno al martes a las 13:30
- **THEN** la API responde `409` con `{"code":"FUERA_DE_HORARIO"}`

#### Scenario: Box inactivo
- **GIVEN** el Box 2 está inactivo
- **WHEN** la recepcionista mueve el turno al Box 2
- **THEN** la API responde `409` con `{"code":"RECURSO_INACTIVO"}`

#### Scenario: Profesional inexistente
- **WHEN** la recepcionista mueve el turno a un `profesionalId` que no existe
- **THEN** la API responde `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Estados que se pueden reprogramar
Solo se SHALL reprogramar un turno `reservado` o `confirmado`. Un turno `cancelado`, `atendido` o `ausente` MUST responder `409 TRANSICION_INVALIDA` sin cambios. Un turno inexistente responde `404 NO_ENCONTRADO`.

#### Scenario: Reprogramar un turno cancelado
- **GIVEN** el turno está `cancelado`
- **WHEN** la recepcionista lo mueve a las 11:00
- **THEN** la API responde `409` con `{"code":"TRANSICION_INVALIDA"}`
- **AND** el turno sigue `cancelado` de 10:00 a 10:30

#### Scenario: Reprogramar un turno atendido
- **GIVEN** el turno está `atendido`
- **WHEN** el profesional lo mueve a las 11:00
- **THEN** la API responde `409` con `{"code":"TRANSICION_INVALIDA"}`

#### Scenario: Turno inexistente
- **WHEN** la recepcionista pide `PATCH /api/turnos/no-existe/reprogramar`
- **THEN** la API responde `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Un turno reprogramado vuelve a reservado
Un turno reprogramado SHALL quedar en estado `reservado`, aunque antes estuviera `confirmado`: la confirmación del paciente era para el horario anterior.

#### Scenario: Reprogramar un turno confirmado
- **GIVEN** el turno está `confirmado`
- **WHEN** la recepcionista lo mueve a las 11:00
- **THEN** la API responde `200` con el turno `reservado` de 11:00 a 11:30

### Requirement: Auditoría de la reprogramación
Cada reprogramación exitosa SHALL agregar un registro append-only con acción `reprogramado`, el usuario de la sesión como actor, la fecha del reloj y el estado, `inicio`, `fin`, profesional y box de antes y de después. El turno MUST cambiar solo si su registro ya existe: si falla la auditoría, el turno no cambia; si falla guardar, se agrega un registro de reversión (`revertido: true`). Un rechazo no agrega registros.

#### Scenario: Registro de auditoría al reprogramar
- **GIVEN** el turno está `confirmado`
- **WHEN** la recepcionista lo mueve a las 11:00
- **THEN** existe un registro `reprogramado` con actor igual al usuario de la recepcionista, `antes` con estado `confirmado` e inicio 10:00, y `despues` con estado `reservado` e inicio 11:00

#### Scenario: Falla la escritura de auditoría
- **GIVEN** el repositorio de auditoría rechaza la escritura
- **WHEN** la recepcionista mueve el turno a las 11:00
- **THEN** la operación falla, el turno sigue de 10:00 a 10:30 y no se envía email

#### Scenario: Falla guardar el turno después de auditar
- **GIVEN** el repositorio de turnos rechaza la escritura
- **WHEN** la recepcionista mueve el turno a las 11:00
- **THEN** la operación falla, el turno sigue de 10:00 a 10:30 y hay dos registros: el intento y su reversión con `revertido: true`

### Requirement: Reenvío del email de confirmación
Después de reprogramar, el sistema SHALL enviar al paciente un email con la nueva fecha, hora, profesional, box y prestación, sin precio. Si el envío falla, la reprogramación MUST quedar hecha y la API responde `200` igual.

#### Scenario: Se reenvía el email con el nuevo horario
- **WHEN** la recepcionista mueve el turno de "Paciente Ficticio Uno" a las 11:00
- **THEN** se envía un email a `paciente1@example.com` que menciona 24/11/2026, 11:00, Dra. Ana Pérez, Box 1 y Consulta
- **AND** el email no contiene el precio

#### Scenario: Falla el envío del email
- **GIVEN** el envío de emails falla
- **WHEN** la recepcionista mueve el turno a las 11:00
- **THEN** la API responde `200` y el turno queda de 11:00 a 11:30

### Requirement: Formato de la solicitud
El cuerpo SHALL tener `inicio` como fecha ISO 8601 con zona horaria y, opcionalmente, `profesionalId` y `boxId` como textos no vacíos. Cualquier otro formato responde `400 FORMATO_INVALIDO` sin cambios.

#### Scenario: Cuerpo sin inicio
- **WHEN** la recepcionista pide la reprogramación con `{}`
- **THEN** la API responde `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `inicio`

#### Scenario: Inicio sin zona horaria
- **WHEN** la recepcionista pide la reprogramación con `{"inicio":"2026-11-24T11:00:00"}`
- **THEN** la API responde `400` con `code` `FORMATO_INVALIDO`

### Requirement: Roles permitidos
`PATCH /api/turnos/:id/reprogramar` SHALL estar disponible solo para `profesional` y `recepcionista`. Un `paciente` MUST recibir `403 SIN_PERMISO` y reprograma por su propia ruta (C-11). Sin sesión, `401 NO_AUTENTICADO`.

#### Scenario: Un paciente usa la ruta del personal
- **WHEN** un paciente autenticado pide `PATCH /api/turnos/:id/reprogramar`
- **THEN** la API responde `403` con `{"code":"SIN_PERMISO"}` y el turno no cambia

#### Scenario: Sin sesión
- **WHEN** un cliente sin token pide `PATCH /api/turnos/:id/reprogramar`
- **THEN** la API responde `401` con `{"code":"NO_AUTENTICADO"}`

### Requirement: Reprogramaciones simultáneas
La validación del nuevo intervalo y el guardado MUST ser atómicos respecto de las altas y otras reprogramaciones: si compiten por el mismo hueco, gana la primera y la otra recibe `409 SOLAPAMIENTO_*`.

#### Scenario: Dos reprogramaciones al mismo hueco a la vez
- **GIVEN** dos turnos de la Dra. Pérez, a las 10:00 y a las 12:00, y el hueco de las 11:00 libre
- **WHEN** llegan a la vez dos reprogramaciones de esos turnos a las 11:00 en el Box 1
- **THEN** una responde `200` y la otra `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`
