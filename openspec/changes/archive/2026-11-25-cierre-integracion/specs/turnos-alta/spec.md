# Spec Delta — turnos-alta

## ADDED Requirements

### Requirement: Sin solapamiento por paciente en el alta del personal
El sistema SHALL rechazar con `409 SOLAPAMIENTO_PACIENTE` el alta en `POST /api/turnos` si el paciente ya tiene otro turno no cancelado superpuesto en `[inicio, fin)`, evaluando `profesional → box → paciente` dentro de `conLockDeAgenda` y permitiendo múltiples turnos futuros no superpuestos.

#### Scenario: El paciente ya tiene un turno en ese horario con otro profesional y otro box
- **GIVEN** "Paciente Ficticio Uno" tiene un turno `reservado` de 10:00 a 10:30 con la Dra. Pérez en el Box 1
- **WHEN** la recepcionista crea una "Consulta" para "Paciente Ficticio Uno" con el Dr. Gómez en el Box 2 el mismo día a las 10:15
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PACIENTE"}` y no guarda turno, auditoría ni email

#### Scenario: El personal agenda una segunda sesión futura del mismo paciente en otro horario
- **GIVEN** "Paciente Ficticio Uno" tiene un turno `reservado` de 10:00 a 10:30 con la Dra. Pérez en el Box 1
- **WHEN** la recepcionista crea otro turno para "Paciente Ficticio Uno" el mismo día a las 10:30 con la Dra. Pérez en el Box 1
- **THEN** la API responde `201` y ambos turnos quedan guardados para el paciente
