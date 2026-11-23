# Spec Delta

## Purpose

Consulta de la agenda del consultorio por rango, profesional y box, con el turno enriquecido para mostrarlo sin exponer precios a quien no corresponde, y consulta de solo lectura de la auditoría append-only de un turno para el profesional (US-014, US-061, RN-TU-05, RN-RO-01).

> Convenciones de los escenarios: datos semilla ficticios (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1, Box 2, "Consulta" de 30 minutos, "Paciente Ficticio Uno", "Paciente Ficticio Dos"). Horas en la zona del consultorio (UTC−3): `2026-11-23T12:00:00Z` es el lunes 23/11/2026 a las 09:00. Los turnos de prueba caen dentro del horario semilla, lunes a viernes de 09:00 a 13:00.

## ADDED Requirements

### Requirement: Consulta de la agenda por rango
El profesional y la recepcionista SHALL poder consultar `GET /api/agenda` con `desde` y `hasta`, y la respuesta SHALL incluir los turnos cuyo `inicio` cae en el intervalo semiabierto `[desde, hasta)`: uno que empieza exactamente en `desde` se incluye y uno que empieza exactamente en `hasta` se excluye.

#### Scenario: Turno que empieza exactamente en `desde` se incluye
- **GIVEN** un turno de la Dra. Pérez que empieza el lunes 23/11/2026 a las 09:00 (`desde`)
- **WHEN** la recepcionista consulta `GET /api/agenda?desde=2026-11-23T12:00:00Z&hasta=2026-11-23T16:00:00Z`
- **THEN** recibe `200` con un array que contiene ese turno

#### Scenario: Turno que empieza exactamente en `hasta` se excluye
- **GIVEN** un turno que empieza el lunes 23/11/2026 a las 13:00 (`hasta`) y otro que empieza a las 12:30
- **WHEN** la recepcionista consulta la agenda con `desde=2026-11-23T12:00:00Z` y `hasta=2026-11-23T16:00:00Z`
- **THEN** recibe `200` con un array que contiene solo el turno de las 12:30

#### Scenario: Consulta de un día completo
- **GIVEN** un turno el lunes 23/11/2026 a las 10:00 y otro el martes 24/11/2026 a las 10:00
- **WHEN** la recepcionista consulta la agenda del lunes con `desde=2026-11-23T03:00:00Z&hasta=2026-11-24T03:00:00Z`
- **THEN** recibe `200` con un array que contiene solo el turno del lunes

### Requirement: Formato y validez del rango
`desde` y `hasta` SHALL ser obligatorios e instantes ISO 8601 con offset. Si falta uno, si un valor no es un instante ISO 8601 con offset o si `desde >= hasta`, la API SHALL responder `400 FORMATO_INVALIDO` con un detalle en el campo faltante o inválido, y en `hasta` cuando el rango está invertido. Un rango mal formado NO SHALL responder `409`.

#### Scenario: Falta `desde` o `hasta`
- **WHEN** la recepcionista consulta `GET /api/agenda` sin `desde`, o sin `hasta`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle sobre el campo faltante

#### Scenario: Valor que no es ISO 8601 con offset
- **WHEN** la recepcionista consulta la agenda con `desde=2026-11-23` o `hasta=mañana`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle sobre el campo inválido

#### Scenario: Rango invertido o vacío
- **WHEN** la recepcionista consulta la agenda con `desde=2026-11-23T16:00:00Z` y `hasta=2026-11-23T12:00:00Z`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `hasta`

### Requirement: Filtros por profesional y box
`profesionalId` y `boxId` SHALL ser opcionales, se SHALL poder combinar con AND y solo SHALL acotar la lista de turnos. Sin filtros, la agenda SHALL incluir los turnos de todos los profesionales y boxes del rango. Un identificador de filtro que no corresponde a ningún recurso conocido SHALL devolver una lista vacía, nunca `404`: es un criterio de búsqueda, no un recurso solicitado.

#### Scenario: Filtro por profesional
- **GIVEN** un turno de la Dra. Pérez y otro del Dr. Gómez en el rango
- **WHEN** la recepcionista consulta la agenda con el `profesionalId` de la Dra. Pérez
- **THEN** recibe `200` con un array que contiene solo el turno de la Dra. Pérez

#### Scenario: Filtro por box
- **GIVEN** un turno en el Box 1 y otro en el Box 2 en el rango
- **WHEN** la recepcionista consulta la agenda con el `boxId` del Box 2
- **THEN** recibe `200` con un array que contiene solo el turno del Box 2

#### Scenario: Filtro por profesional y box a la vez
- **GIVEN** un turno de la Dra. Pérez en el Box 1, uno de la Dra. Pérez en el Box 2 y uno del Dr. Gómez en el Box 1
- **WHEN** la recepcionista consulta la agenda con el `profesionalId` de la Dra. Pérez y el `boxId` del Box 1
- **THEN** recibe `200` con un array que contiene solo el turno de la Dra. Pérez en el Box 1

#### Scenario: Filtro que no coincide con ningún recurso
- **GIVEN** un rango con turnos cargados
- **WHEN** la recepcionista consulta la agenda con un `profesionalId` o un `boxId` que no existe
- **THEN** recibe `200` con `[]` y no `404`

### Requirement: Turno enriquecido en la agenda
Cada elemento de la agenda SHALL ser un turno plano con todos los campos de `Turno` más los resúmenes `paciente {id, nombre, apellido}`, `profesional {id, nombre}`, `box {id, nombre}` y `prestacion {id, nombre, duracionMin}`. El resumen de la prestación NO SHALL incluir `precio`. La respuesta SHALL ser un array JSON plano, como el resto de las listas de la API.

#### Scenario: El turno trae los cuatro resúmenes
- **GIVEN** un turno de "Paciente Ficticio Uno" con la Dra. Pérez en el Box 1 por una "Consulta"
- **WHEN** la recepcionista consulta la agenda de ese rango
- **THEN** el turno incluye `paciente` con `Ficticio Uno`, `profesional` con `Dra. Ana Pérez`, `box` con `Box 1` y `prestacion` con `Consulta` y `duracionMin` 30

#### Scenario: El resumen de la prestación no trae precio
- **WHEN** el profesional consulta la agenda de un rango con turnos
- **THEN** el objeto `prestacion` de cada turno tiene `id`, `nombre` y `duracionMin`, y no tiene `precio`

### Requirement: Orden de la agenda
La agenda SHALL ordenarse por `inicio` ascendente. Dos turnos con el mismo `inicio` SHALL conservar el orden de inserción del repositorio, para que la respuesta sea determinista sin depender del identificador.

#### Scenario: Turnos ordenados por inicio
- **GIVEN** tres turnos que empiezan a las 11:00, 09:00 y 10:00 del mismo día
- **WHEN** la recepcionista consulta la agenda de ese día
- **THEN** recibe los turnos en el orden 09:00, 10:00, 11:00

#### Scenario: Empate de inicio conserva el orden de inserción
- **GIVEN** dos turnos con el mismo `inicio`, guardados primero el del Box 2 y después el del Box 1
- **WHEN** la recepcionista consulta la agenda de ese rango
- **THEN** el turno del Box 2 aparece antes que el del Box 1

### Requirement: Todos los estados y agenda vacía
La agenda SHALL incluir los turnos en todos los estados, incluidos los `cancelado`, con su `estado` en la respuesta. NO SHALL filtrar por estado ni ofrecer un parámetro para hacerlo. Si no hay turnos en el rango, SHALL responder `200` con `[]`.

#### Scenario: Los turnos cancelados aparecen con su estado
- **GIVEN** un turno `reservado` y un turno `cancelado` en el rango
- **WHEN** la recepcionista consulta la agenda de ese rango
- **THEN** recibe los dos turnos y el cancelado tiene `estado` `cancelado`

#### Scenario: Rango sin turnos devuelve una lista vacía
- **GIVEN** un rango sin turnos cargados
- **WHEN** la recepcionista consulta la agenda de ese rango
- **THEN** recibe `200` con `[]`

### Requirement: Acceso a la agenda
`GET /api/agenda` SHALL estar disponible solo para sesiones `profesional` y `recepcionista`. Un `paciente` SHALL recibir `403 SIN_PERMISO`; sin sesión, `401 NO_AUTENTICADO`. La recepcionista NO SHALL recibir `precioAlReservar` ni `precio` en ningún nivel de la respuesta; el profesional SHALL recibir `precioAlReservar` (RN-RO-01).

#### Scenario: La recepcionista no recibe precios
- **GIVEN** un turno con `precioAlReservar` 15000 de una prestación con `precio` 15000
- **WHEN** la recepcionista consulta la agenda de ese rango
- **THEN** recibe `200` y ningún turno incluye `precioAlReservar` ni `precio`, ni siquiera dentro de `prestacion`

#### Scenario: El profesional recibe el precio congelado
- **GIVEN** un turno con `precioAlReservar` 15000
- **WHEN** el profesional consulta la agenda de ese rango
- **THEN** recibe `200` y el turno incluye `precioAlReservar` 15000

#### Scenario: El paciente no accede a la agenda
- **WHEN** un paciente autenticado pide `GET /api/agenda` con un rango válido
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Sin sesión no hay agenda
- **WHEN** un cliente sin token pide `GET /api/agenda` con un rango válido
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

### Requirement: Consulta de la auditoría de un turno
`GET /api/turnos/:id/auditoria` SHALL devolver los registros append-only del turno como están guardados, con `id`, `turnoId`, `accion`, `actor`, `fecha` y `detalle`, ordenados por `fecha` ascendente y con orden estable ante empates. `actor` SHALL devolverse tal cual se guardó (un `usuarioId` o `"paciente"`) y `detalle` sin reinterpretarse. Un turno sin registros SHALL devolver `200` con `[]`; un turno inexistente, `404 NO_ENCONTRADO`.

#### Scenario: Auditoría ordenada por fecha con acción, actor y detalle
- **GIVEN** un turno con un registro `creado` a las 08:30 y uno `cancelado` a las 09:15
- **WHEN** el profesional pide `GET /api/turnos/<id>/auditoria`
- **THEN** recibe `200` con dos registros en ese orden y cada uno trae `accion`, `actor`, `fecha` y `detalle`

#### Scenario: Los registros conservan el detalle antes y después
- **GIVEN** un registro `estado_cambiado` con `detalle` `{antes:{estado:"reservado"},despues:{estado:"confirmado"}}`
- **WHEN** el profesional consulta la auditoría de ese turno
- **THEN** el registro devuelve ese mismo `detalle`, sin renombrar ni recalcular sus campos

#### Scenario: Turno sin registros devuelve una lista vacía
- **GIVEN** un turno existente sin registros de auditoría
- **WHEN** el profesional consulta su auditoría
- **THEN** recibe `200` con `[]`

#### Scenario: Turno inexistente
- **WHEN** el profesional pide `GET /api/turnos/no-existe/auditoria`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Acceso a la auditoría
Solo una sesión `profesional` SHALL poder consultar la auditoría de un turno, de cualquier profesional (PA-09). Una `recepcionista` o un `paciente` SHALL recibir `403 SIN_PERMISO`; sin sesión, `401 NO_AUTENTICADO`. La consulta NO SHALL restringirse al dueño del turno.

#### Scenario: La recepcionista no accede a la auditoría
- **GIVEN** un turno con registros de auditoría
- **WHEN** la recepcionista pide `GET /api/turnos/<id>/auditoria`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: El paciente no accede a la auditoría
- **GIVEN** el turno del propio paciente, con registros de auditoría
- **WHEN** el paciente pide `GET /api/turnos/<id>/auditoria`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Sin sesión no hay auditoría
- **WHEN** un cliente sin token pide `GET /api/turnos/<id>/auditoria`
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: El profesional consulta la auditoría de un turno de otro profesional
- **GIVEN** un turno del Dr. Gómez con registros y una sesión de la Dra. Pérez
- **WHEN** la Dra. Pérez pide la auditoría de ese turno
- **THEN** recibe `200` con los registros, sin restricción de dueño

### Requirement: Auditoría de solo lectura
La auditoría SHALL ser de solo lectura en esta capability: NO SHALL existir ninguna ruta para modificarla, borrarla ni agregar registros desde la consulta. `PATCH` y `DELETE /api/turnos/:id/auditoria` SHALL responder `404 NO_ENCONTRADO`, y los registros existentes SHALL quedar intactos.

#### Scenario: No se puede modificar la auditoría con PATCH
- **GIVEN** un turno con un registro de auditoría
- **WHEN** el profesional envía `PATCH /api/turnos/<id>/auditoria`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y el registro sigue igual

#### Scenario: No se puede borrar la auditoría con DELETE
- **GIVEN** un turno con un registro de auditoría
- **WHEN** el profesional envía `DELETE /api/turnos/<id>/auditoria`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y el registro sigue existiendo
