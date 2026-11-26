# Spec Delta — web-paciente

## ADDED Requirements

### Requirement: Bloqueo preventivo de nueva reserva cuando ya existe un turno pendiente
La pantalla `/paciente/reservar` SHALL consultar `GET /api/paciente/turnos` al iniciarse y, si el paciente ya posee un turno en estado `reservado` o `confirmado` con `inicio > ahora`, mostrar los datos de ese turno pendiente con accesos directos para **Reprogramar** (`/paciente/turnos/:id/reprogramar`) y **Cancelar** en lugar del formulario de nueva reserva, omitiendo el botón `"Reservar otro turno"` tras confirmar una reserva.

#### Scenario: Al abrir Reservar turno con un turno futuro pendiente muestra el turno con acceso a Reprogramar y Cancelar
- **GIVEN** un paciente autenticado que ya tiene un turno `confirmado` o `reservado` con `inicio > ahora` en `GET /api/paciente/turnos`
- **WHEN** abre `/paciente/reservar`
- **THEN** la pantalla informa que ya tiene un turno pendiente, muestra su fecha, horario, prestación, profesional y box, y ofrece las acciones directas para reprogramarlo o cancelarlo sin renderizar el selector de nueva reserva
