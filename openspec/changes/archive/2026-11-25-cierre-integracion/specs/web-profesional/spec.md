# Spec Delta — web-profesional

## MODIFIED Requirements

### Requirement: Agenda profesional y auditoría append-only de turnos
`/profesional/agenda` y `/profesional/turnos/:id/auditoria` SHALL listar turnos vía `GET /api/agenda`, cambiar el estado con `POST /api/turnos/:id/estado` (`reservado` → `"Confirmar"`; `confirmado` → `"Marcar atendido"` y `"Marcar ausente"`), y mostrar desde `"Ver historial"` los movimientos legibles (`GET /api/turnos/:id/auditoria`) en lenguaje clínico sin JSON crudo ni jerga técnica.

#### Scenario: Listado de turnos en agenda profesional mediante GET /api/agenda
- **GIVEN** una sesión activa de `profesional` en `/profesional/agenda`
- **WHEN** se carga la agenda del rango seleccionado y se aplican filtros de profesional o box
- **THEN** se invoca `GET /api/agenda` con los parámetros correspondientes y se listan los turnos con su `BadgeEstadoTurno` y botón "Ver historial"

#### Scenario: Panel de auditoría muestra cronología append-only de un turno
- **GIVEN** un turno `turno-1` seleccionado desde `/profesional/agenda` o navegado directamente en `/profesional/turnos/turno-1/auditoria`
- **WHEN** responde `GET /api/turnos/turno-1/auditoria` con registros `creado` y `estado_cambiado`
- **THEN** se muestra el historial ordenado con títulos legibles ("Turno reservado", "Cambio de estado"), responsable legible ("Paciente (reserva online)", "Recepción") y badges de estado antes/después sin JSON crudo ni botones de edición o borrado

#### Scenario: Profesional confirma o marca atendido o ausente un turno desde su agenda
- **GIVEN** una sesión activa de `profesional` en `/profesional/agenda` con un turno `reservado` y otro `confirmado`
- **WHEN** pulsa `"Confirmar"` en el turno `reservado` y `"Marcar atendido"` en el turno `confirmado`
- **THEN** se invoca `POST /api/turnos/:id/estado` con `{"estado":"confirmado"}` y `{"estado":"atendido"}` respectivamente y se vuelve a consultar `GET /api/agenda`
