# Spec Delta

## Purpose

Definir cómo se calculan las ganancias de un profesional en un período a partir del precio congelado de sus turnos atendidos y quién puede consultarlas.

## ADDED Requirements

### Requirement: Suma de los turnos atendidos del período
La API SHALL calcular las ganancias de un profesional como la suma de `precioAlReservar` de sus turnos en estado `atendido` cuyo `inicio` cae en el período consultado (RN-GA-01). El cálculo SHALL hacerse en cada consulta con el estado vigente del turno, sin totales persistidos ni caché (RN-GA-03). Solo SHALL contar turnos del profesional identificado por `:id` (RN-RO-02). Un período sin turnos atendidos SHALL devolver `0`, nunca un error.

#### Scenario: Suma de los turnos atendidos del período
- **GIVEN** la profesional Ana con tres turnos `atendido` en el período, con `precioAlReservar` 15000, 25000 y 10000
- **WHEN** Ana pide `GET /api/profesionales/<id-de-Ana>/ganancias?desde=2026-11-23T12:00:00Z&hasta=2026-11-23T16:00:00Z`
- **THEN** recibe `200` con `{"total":50000}`

#### Scenario: Período vacío devuelve cero
- **GIVEN** la profesional Ana sin turnos `atendido` en el período consultado
- **WHEN** Ana pide sus ganancias para ese período
- **THEN** recibe `200` con `{"total":0}`

#### Scenario: Solo cuenta los turnos del profesional dueño
- **GIVEN** Ana con dos turnos `atendido` de 15000 y 25000, y Bruno con un turno `atendido` de 40000 en el mismo período
- **WHEN** Ana pide sus propias ganancias
- **THEN** recibe `200` con `{"total":40000}` y el turno de Bruno no se suma

#### Scenario: Ignora cancelados y ausentes
- **GIVEN** un turno `atendido` de 15000, uno `cancelado` de 25000 y uno `ausente` de 40000 de la misma profesional en el período
- **WHEN** la profesional pide sus ganancias
- **THEN** recibe `200` con `{"total":15000}`

#### Scenario: Ignora reservados y confirmados
- **GIVEN** un turno `atendido` de 15000, uno `reservado` de 25000 y uno `confirmado` de 40000 de la misma profesional en el período
- **WHEN** la profesional pide sus ganancias
- **THEN** recibe `200` con `{"total":15000}`

#### Scenario: Usa el precio congelado aunque la prestación haya cambiado
- **GIVEN** un turno `atendido` con `precioAlReservar` 15000 y la prestación asociada con `precio` 20000 en la actualidad
- **WHEN** la profesional pide sus ganancias del período
- **THEN** recibe `200` con `{"total":15000}` (RN-GA-02, DD-05)

#### Scenario: Suma con decimales exacta a 2 decimales
- **GIVEN** dos turnos `atendido` con `precioAlReservar` 10000.10 y 20000.20 en el período
- **WHEN** la profesional pide sus ganancias
- **THEN** recibe `200` con `{"total":30000.30}`, sin arrastre de punto flotante

### Requirement: Período semiabierto sobre el inicio del turno
La API SHALL delimitar el período como el intervalo semiabierto `[desde, hasta)` aplicado sobre `turno.inicio`, coherente con `[inicio, fin)` de la agenda (RN-AG-04): un turno que empieza exactamente en `desde` cuenta y uno que empieza exactamente en `hasta` no. Un turno que empieza antes de `desde` y termina dentro del período SHALL NOT contar. Así un turno no se suma en dos períodos consecutivos.

#### Scenario: Turno que empieza exactamente en `desde` se incluye
- **GIVEN** un turno `atendido` de 15000 que empieza exactamente en `desde` (2026-11-23T12:00:00Z)
- **WHEN** la profesional pide sus ganancias con ese `desde` y `hasta=2026-11-23T16:00:00Z`
- **THEN** recibe `200` con `{"total":15000}`

#### Scenario: Turno que empieza exactamente en `hasta` se excluye
- **GIVEN** un turno `atendido` de 15000 que empieza exactamente en `hasta` (2026-11-23T15:00:00Z) y otro `atendido` de 10000 que empieza a las 2026-11-23T14:00:00Z
- **WHEN** la profesional pide sus ganancias con `desde=2026-11-23T12:00:00Z` y ese `hasta`
- **THEN** recibe `200` con `{"total":10000}`

#### Scenario: Turno que empieza antes de `desde` y termina dentro no se cuenta
- **GIVEN** un turno `atendido` de 15000 de 2026-11-23T12:45:00Z a 2026-11-23T13:15:00Z y el período `desde=2026-11-23T13:00:00Z`
- **WHEN** la profesional pide sus ganancias de ese período
- **THEN** recibe `200` con `{"total":0}`, porque se filtra por `inicio` y no por solapamiento

### Requirement: Acceso solo al profesional dueño
La ruta SHALL estar disponible solo para una sesión `profesional` cuyo `profesionalId` sea igual al `:id` solicitado (RN-RO-02). Cualquier otra sesión válida —otro profesional, `recepcionista` o `paciente`— SHALL recibir `403 SIN_PERMISO` (RN-RO-01). La ausencia de sesión SHALL responder `401 NO_AUTENTICADO`. Un `:id` que no existe SHALL responder `403 SIN_PERMISO`, igual que uno ajeno: la propiedad se verifica antes que la existencia para no revelar qué profesionales existen.

#### Scenario: Otro profesional no ve las ganancias ajenas
- **GIVEN** una sesión del profesional Bruno y el id de la profesional Ana
- **WHEN** Bruno pide `GET /api/profesionales/<id-de-Ana>/ganancias` con un período válido
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: La recepcionista no ve ganancias
- **GIVEN** una sesión de `recepcionista` y el id de la profesional Ana
- **WHEN** la recepcionista pide las ganancias de Ana con un período válido
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}` (RN-RO-01)

#### Scenario: El paciente no ve ganancias
- **GIVEN** una sesión de `paciente` y el id de la profesional Ana
- **WHEN** el paciente pide las ganancias de Ana con un período válido
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Sin token
- **WHEN** un cliente sin `Authorization` pide `GET /api/profesionales/<id-de-Ana>/ganancias` con un período válido
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Profesional inexistente
- **GIVEN** una sesión de la profesional Ana
- **WHEN** Ana pide las ganancias de un id que no corresponde a ningún profesional
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}` y la respuesta no revela si el id existe

### Requirement: Formato de desde y hasta
La ruta SHALL exigir `desde` y `hasta` como instantes ISO 8601 con offset. Si falta cualquiera de los dos o si un valor no es un instante ISO 8601 con offset, SHALL responder `400 FORMATO_INVALIDO` con un detalle que indique el campo. La comparación SHALL ser entre instantes, sin aritmética de zona horaria en el módulo (DD-08).

#### Scenario: Falta `desde` o `hasta`
- **WHEN** la profesional pide sus ganancias sin `desde`, o sin `hasta`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle sobre el campo faltante

#### Scenario: Valor que no es ISO 8601 con offset
- **WHEN** la profesional pide sus ganancias con `desde=2026-11-23` o `hasta=mañana`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle sobre el campo inválido

### Requirement: Período válido
La ruta SHALL rechazar con `400 FORMATO_INVALIDO`, y un detalle sobre `hasta`, un período donde `desde >= hasta`. Este change no introduce códigos de negocio nuevos: los rechazos son de formato (`400`) o de permisos (`403`), no de regla (`409`), así que no agrega códigos a RN-EX-01.

#### Scenario: `desde` mayor o igual que `hasta`
- **WHEN** la profesional pide sus ganancias con `desde=2026-11-23T16:00:00Z` y `hasta=2026-11-23T12:00:00Z`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `hasta`

### Requirement: Publicación automática de la ruta
La ruta SHALL quedar publicada bajo `/api` por el registro automático de módulos (DD-13), sin que ningún archivo central la enumere. Agregar el módulo `ganancias` no SHALL requerir editar `src/app.ts` ni ningún archivo compartido.

#### Scenario: La ruta se publica sola bajo `/api`
- **GIVEN** la API armada con el módulo `ganancias` y sin editar `src/app.ts`
- **WHEN** un cliente autenticado como la profesional dueña pide `GET /api/profesionales/<id>/ganancias` con un período válido
- **THEN** la ruta responde `200` y no `404`, porque el autoload la publicó bajo `/api`
