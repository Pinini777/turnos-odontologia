# Spec Delta — reserva-online

## ADDED Requirements

### Requirement: Un solo turno pendiente por paciente en la reserva online
El sistema SHALL rechazar con `409 TURNO_PENDIENTE_EXISTENTE` toda solicitud a `POST /api/paciente/turnos` cuando el paciente autenticado ya tenga un turno en estado `reservado` o `confirmado` con `inicio > ahora`, evaluado dentro de `conLockDeAgenda`, permitiendo nueva reserva una vez cancelado o alcanzado su inicio.

#### Scenario: Rechaza nueva reserva online si el paciente ya tiene un turno futuro pendiente
- **GIVEN** el reloj en `2026-11-30T08:00:00-03:00` y `Paciente Ficticio Uno` con un turno `reservado` el `2026-12-01T10:00:00-03:00`
- **WHEN** `Paciente Ficticio Uno` envía `POST /api/paciente/turnos` para reservar otro turno el `2026-12-02T10:00:00-03:00`
- **THEN** responde `409` con `{"code":"TURNO_PENDIENTE_EXISTENTE"}` y no crea ningún turno adicional

#### Scenario: Permite nueva reserva online tras cancelar el turno pendiente o cuando su inicio ya pasó
- **GIVEN** `Paciente Ficticio Uno` con un turno pasado (`inicio <= ahora`) y otro turno futuro en estado `cancelado`
- **WHEN** `Paciente Ficticio Uno` envía `POST /api/paciente/turnos` para un hueco libre futuro
- **THEN** responde `201` con el nuevo turno en estado `reservado`

### Requirement: Sin solapamiento por paciente en reserva asistida y autogestión
El sistema SHALL rechazar con `409 SOLAPAMIENTO_PACIENTE` las operaciones `POST /api/recepcion/turnos`, `POST /api/paciente/turnos` y `PATCH /api/paciente/turnos/:id/reprogramar` cuando el intervalo `[inicio, fin)` se superponga con otro turno no cancelado del mismo paciente, evaluando `profesional → box → paciente`.

#### Scenario: Recepción puede agendar otra sesión futura del mismo paciente pero no en horario superpuesto
- **GIVEN** `Paciente Ficticio Uno` tiene un turno `reservado` el `2026-11-30T10:00:00-03:00` (30 min) con Dra. Ana Pérez en `box1`
- **WHEN** la recepcionista envía `POST /api/recepcion/turnos` para `Paciente Ficticio Uno` con Dr. Bruno Gómez en `box2` primero a las `10:15` y luego a las `11:00` del mismo día
- **THEN** a las `10:15` responde `409` con `{"code":"SOLAPAMIENTO_PACIENTE"}` y a las `11:00` responde `201` creando la segunda sesión
