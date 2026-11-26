# Spec Delta — web-base

## MODIFIED Requirements

### Requirement: Panel de inicio diferenciado por rol y libre de jerga técnica
`InicioPage` SHALL mostrar una vista específica para cada rol conectada a datos reales de la API sin datos hardcodeados ni etiquetas `"Datos de ejemplo"`: métricas y agenda real (`GET /api/agenda`) con acciones `POST /api/turnos/:id/estado` para `profesional` y `recepcionista` (con `+ Nuevo turno` hacia `/recepcion/turnos/nuevo`), y tarjeta `Tu próximo turno` desde `GET /api/paciente/turnos` para `paciente` (`RN-RE-03`).

#### Scenario: Profesional ve métricas del día y su agenda sin jerga técnica
- **GIVEN** una sesión de `profesional` y turnos del día devueltos por `GET /api/agenda`
- **WHEN** el `profesional` accede a `/inicio`
- **THEN** visualiza "Turnos de hoy", "Próximo paciente", "Box asignado" y "Tu agenda de hoy" con los turnos reales de la API, sin etiquetas `"Datos de ejemplo"`, IDs de change, tokens ni endpoints

#### Scenario: Recepcionista ve boxes, pendientes, botón + Nuevo turno y actualiza estados en vivo
- **GIVEN** una sesión de `recepcionista` y turnos del día devueltos por `GET /api/agenda`
- **WHEN** la `recepcionista` accede a `/inicio` y pulsa `Confirmar` o `Marcar atendido` en una fila
- **THEN** visualiza el estado de Box 1 y Box 2, el botón `+ Nuevo turno` que navega a `/recepcion/turnos/nuevo`, invoca `POST /api/turnos/:id/estado` y refresca la agenda real de `GET /api/agenda`

#### Scenario: Paciente ve solo su próximo turno con bloque calendario y nunca turnos ajenos
- **GIVEN** una sesión de `paciente` cuyos turnos propios provienen de `GET /api/paciente/turnos`
- **WHEN** el `paciente` accede a `/inicio`
- **THEN** visualiza "Tu próximo turno" con los datos reales de su próximo turno activo (o estado vacío hacia `/paciente/reservar`), sin etiquetas `"Datos de ejemplo"` y sin exponer turnos de otros pacientes

## ADDED Requirements

### Requirement: Nombre real del usuario en la barra lateral y catálogo de errores
`AppLayout` SHALL resolver y mostrar el nombre real del usuario autenticado consultando `GET /api/paciente/datos` para `paciente` y `GET /api/profesionales` para `profesional` (sin cadenas fijas como `"Lucía Fernández"`), y `web/src/base/errores.ts` SHALL traducir `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE` a mensajes legibles en español rioplatense.

#### Scenario: Barra lateral muestra el nombre real del paciente desde la API y traduce nuevos códigos 409
- **GIVEN** una sesión activa de `paciente` cuyo perfil en `GET /api/paciente/datos` es `"Mario Santos"`
- **WHEN** se renderiza `AppLayout` y se consultan las traducciones de `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE`
- **THEN** la barra lateral muestra `"Mario Santos"` con iniciales `"MS"` (nunca `"Lucía Fernández"`) y ambos códigos devuelven mensajes legibles específicos en español
