# Spec Delta — turnos-reprogramacion

## ADDED Requirements

### Requirement: Sin solapamiento por paciente al reprogramar
El sistema SHALL rechazar con `409 SOLAPAMIENTO_PACIENTE` la reprogramación en `PATCH /api/turnos/:id/reprogramar` si el nuevo intervalo `[inicio, fin)` se superpone con otro turno no cancelado del mismo paciente distinto del que se reprograma, evaluando `profesional → box → paciente` bajo `conLockDeAgenda`.

#### Scenario: Chocar con otro turno activo del mismo paciente en distinto profesional y box
- **GIVEN** "Paciente Ficticio Uno" tiene el turno a reprogramar de 10:00 a 10:30 con la Dra. Pérez en el Box 1 y otro turno `confirmado` de 11:00 a 11:30 con el Dr. Gómez en el Box 2
- **WHEN** la recepcionista mueve el primer turno a las 11:15 con la Dra. Pérez en el Box 1
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PACIENTE"}` y el turno original permanece de 10:00 a 10:30 sin nueva auditoría ni email
