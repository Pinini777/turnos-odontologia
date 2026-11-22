# Spec Delta

## Purpose

Definir los requisitos del módulo `configuracion` (`C-03`): administración de profesionales, boxes, prestaciones, catálogo público reservable, horarios de atención, bloqueos de agenda y la implementación real de `DisponibilidadPort` que reemplaza el stub permisivo de `C-01`.

## ADDED Requirements

### Requirement: Gestión de profesionales
La API SHALL permitir listar, crear, editar y desactivar profesionales mediante `GET /api/profesionales`, `POST /api/profesionales` y `PATCH /api/profesionales/:id`. Solo el rol `profesional` puede crear o modificar; `recepcionista` solo puede listar. La `matricula` debe ser única y se respeta el uso exclusivo de datos ficticios (`RN-DA-01`).

#### Scenario: Alta de profesional válido
- **WHEN** un `profesional` autenticado envía `POST /api/profesionales` con nombre, matrícula única y `usuarioId` válidos
- **THEN** responde `201` con el profesional creado (`activo: true`) y queda disponible en `GET /api/profesionales`

#### Scenario: Desactivación de profesional
- **WHEN** un `profesional` envía `PATCH /api/profesionales/:id` con `{"activo": false}`
- **THEN** responde `200` con `activo: false` sin borrar el registro físicamente

#### Scenario: Matrícula duplicada
- **WHEN** un `profesional` intenta crear o editar un profesional usando una `matricula` ya asignada a otro
- **THEN** responde `400` con `code: "FORMATO_INVALIDO"` indicando el campo `matricula`

#### Scenario: Recepcionista intenta modificar profesionales
- **WHEN** una `recepcionista` envía `POST /api/profesionales` o `PATCH /api/profesionales/:id`
- **THEN** responde `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Profesional inexistente al editar
- **WHEN** un `profesional` envía `PATCH /api/profesionales/:id` con un `id` inexistente
- **THEN** responde `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Gestión de boxes
La API SHALL permitir listar, crear, editar y desactivar boxes mediante `GET /api/boxes`, `POST /api/boxes` y `PATCH /api/boxes/:id`, utilizando siempre el término `box`. Solo el rol `profesional` puede crear o modificar; `recepcionista` solo puede listar. El `nombre` del box debe ser único.

#### Scenario: Alta y desactivación de box
- **WHEN** un `profesional` crea un box con `POST /api/boxes` (`{"nombre":"Box 3"}`) y luego lo desactiva con `PATCH /api/boxes/:id` (`{"activo":false}`)
- **THEN** la creación responde `201` y la desactivación responde `200` con `activo: false`

#### Scenario: Nombre de box duplicado
- **WHEN** un `profesional` intenta crear o renombrar un box con un `nombre` ya existente en otro box
- **THEN** responde `400` con `code: "FORMATO_INVALIDO"` indicando el campo `nombre`

#### Scenario: Recepcionista lista pero no crea boxes
- **WHEN** una `recepcionista` consulta `GET /api/boxes` recibe `200`, y cuando intenta `POST /api/boxes`
- **THEN** el `POST` responde `403` con `{"code":"SIN_PERMISO"}`

### Requirement: Gestión de prestaciones y visibilidad de precios
La API SHALL permitir listar, crear y editar prestaciones mediante `GET /api/prestaciones`, `POST /api/prestaciones` y `PATCH /api/prestaciones/:id` con `duracionMin > 0` múltiplo de 15 (`RN-AG-06`), `precio >= 0` y `reservableOnline`. Solo `profesional` crea o modifica y ve `precio`; `recepcionista` nunca ve `precio` (`RN-RO-01`). Cambiar el `precio` de una prestación SHALL mantener intacto el `precioAlReservar` de los turnos ya existentes (`RN-GA-02`).

#### Scenario: Alta de prestación válida y listado según rol
- **WHEN** un `profesional` crea una prestación con `duracionMin: 30` y `precio: 18000`
- **THEN** responde `201` incluyendo `precio` para `profesional`, mientras que al consultar `GET /api/prestaciones` como `recepcionista` cada elemento omite `precio` y conserva el resto de campos

#### Scenario: Duración inválida no múltiplo de 15 o no positiva
- **WHEN** un `profesional` envía `POST /api/prestaciones` o `PATCH /api/prestaciones/:id` con `duracionMin: 20` o `duracionMin: 0`
- **THEN** responde `409` con `{"code":"DURACION_INVALIDA"}`

#### Scenario: Modificar precio de prestación no altera turnos existentes
- **WHEN** existe un turno guardado con `precioAlReservar: 15000` para una prestación y un `profesional` actualiza su `precio` a `22000` vía `PATCH /api/prestaciones/:id`
- **THEN** la prestación refleja `precio: 22000` y el turno existente conserva `precioAlReservar: 15000`

### Requirement: Catálogo público de prestaciones
La API SHALL exponer `GET /api/public/prestaciones` sin autenticación, devolviendo únicamente prestaciones activas (`activa: true`) y habilitadas para reserva online (`reservableOnline: true`), sin incluir el campo `precio` (`RN-RO-01`).

#### Scenario: Consulta pública filtra inactivas, no reservables y oculta precios
- **WHEN** un cliente sin token consulta `GET /api/public/prestaciones` habiendo prestaciones activas reservables, activas no reservables (`Extracción simple`) e inactivas
- **THEN** responde `200` solo con las prestaciones activas con `reservableOnline: true` y ningún elemento contiene `precio`

### Requirement: Horarios de atención por profesional
La API SHALL permitir consultar y reemplazar los horarios de atención de un profesional mediante `GET /api/profesionales/:id/horarios` y `POST /api/profesionales/:id/horarios`. Solo el propio profesional puede modificar sus horarios (`DD-11`), cada franja debe cumplir `desde < hasta` en formato `HH:mm` y ambos extremos deben caer en la grilla de 15 minutos (`RN-AG-05`).

#### Scenario: Profesional reemplaza sus propios horarios
- **WHEN** el profesional autenticado envía `POST /api/profesionales/:id/horarios` sobre su propio `profesionalId` con franjas válidas en múltiplos de 15 minutos (ej. `09:00` a `12:30`)
- **THEN** responde `200` y reemplaza sus franjas anteriores por las nuevas

#### Scenario: Profesional intenta modificar horarios de otro profesional
- **WHEN** un `profesional` envía `POST /api/profesionales/:otroId/horarios` con el ID de otro profesional
- **THEN** responde `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Horario fuera de la grilla de 15 minutos
- **WHEN** un `profesional` intenta guardar un horario propio con `desde: "09:10"` o `hasta: "12:20"`
- **THEN** responde `409` con `{"code":"FUERA_DE_GRILLA"}`

#### Scenario: Franja con inicio mayor o igual a fin
- **WHEN** un `profesional` envía una franja con `desde: "13:00"` y `hasta: "12:00"`
- **THEN** responde `400` con `code: "FORMATO_INVALIDO"`

### Requirement: Bloqueos de agenda de profesional y de box
La API SHALL permitir listar, crear y eliminar bloqueos mediante `GET /api/bloqueos`, `POST /api/bloqueos` y `DELETE /api/bloqueos/:id`. Un bloqueo debe referenciar exactamente un `profesionalId` o un `boxId` (XOR) con `inicio < fin` en ISO 8601 con zona horaria. Solo el profesional dueño puede crear o borrar sus bloqueos personales, mientras que cualquier profesional puede crear o borrar bloqueos de un box (`DD-11`).

#### Scenario: Bloqueo propio de profesional y bloqueo de box
- **WHEN** un `profesional` crea un bloqueo con su `profesionalId` y otro profesional crea un bloqueo sobre un `boxId`
- **THEN** ambos responden `201` y pueden listarse en `GET /api/bloqueos` y eliminarse con `DELETE /api/bloqueos/:id` (`200` o `204`)

#### Scenario: Profesional intenta bloquear o borrar bloqueo de otro profesional
- **WHEN** un `profesional` envía `POST /api/bloqueos` con el `profesionalId` de otro profesional o `DELETE /api/bloqueos/:id` sobre un bloqueo personal ajeno
- **THEN** responde `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Bloqueo inválido sin XOR o con inicio mayor o igual a fin
- **WHEN** se envía `POST /api/bloqueos` con `profesionalId` y `boxId` simultáneos, sin ninguno de los dos, o con `inicio >= fin`
- **THEN** responde `400` con `code: "FORMATO_INVALIDO"`

#### Scenario: Eliminar bloqueo inexistente
- **WHEN** un `profesional` envía `DELETE /api/bloqueos/:id` con un ID inexistente
- **THEN** responde `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Verificación real de disponibilidad
El adaptador `crearDisponibilidad(repos)` en `src/modules/configuracion/disponibilidad.ts` SHALL validar horario de atención en `APP_TZ` (`RN-AG-09`) y bloqueos del profesional y del box bajo intervalos semiabiertos `[inicio, fin)` (`RN-AG-04`, `RN-AG-08`), devolviendo `null` cuando está disponible, `'FUERA_DE_HORARIO'` cuando el intervalo no está contenido en una franja del día del profesional o `'EN_BLOQUEO'` cuando solapa con un bloqueo.

#### Scenario: Turno dentro de horario de atención y sin bloqueos
- **WHEN** se consulta disponibilidad para `Dra. Ana Pérez` y `Box 1` el lunes `2026-11-23` de `09:00` a `09:30` (zona `APP_TZ`) sin bloqueos
- **THEN** devuelve `null`

#### Scenario: Turno fuera del horario de atención
- **WHEN** se consulta disponibilidad para un día u horario fuera de las franjas del profesional en `APP_TZ` (por ejemplo lunes `13:30` a `14:00` o domingo)
- **THEN** devuelve `'FUERA_DE_HORARIO'`

#### Scenario: Turno dentro de un bloqueo del profesional
- **WHEN** el profesional tiene un bloqueo de `10:00` a `11:00` y se consulta disponibilidad de `10:15` a `10:45`
- **THEN** devuelve `'EN_BLOQUEO'`

#### Scenario: Turno dentro de un bloqueo del box
- **WHEN** `Box 1` tiene un bloqueo de `10:00` a `11:00` y se consulta disponibilidad para `Dra. Ana Pérez` en `Box 1` de `10:15` a `10:45`
- **THEN** devuelve `'EN_BLOQUEO'`

#### Scenario: Borde semiabierto donde turno termina justo al iniciar un bloqueo
- **WHEN** existe un bloqueo (del profesional o del box) que inicia a las `10:30` y se consulta disponibilidad de `10:00` a `10:30`
- **THEN** el intervalo `[10:00, 10:30)` no solapa con `[10:30, ...)` y la verificación devuelve `null`

#### Scenario: Borde semiabierto donde turno empieza justo al finalizar un bloqueo
- **WHEN** existe un bloqueo (del profesional o del box) de `09:30` a `10:00` y se consulta disponibilidad de `10:00` a `10:30`
- **THEN** el intervalo `[10:00, 10:30)` no solapa y la verificación devuelve `null`
