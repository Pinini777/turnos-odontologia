# Spec Delta — web-recepcion

## ADDED Requirements

### Requirement: Mensaje legible ante solapamiento por paciente en recepción
Los formularios de alta asistida (`/recepcion/turnos/nuevo`) y reprogramación (`/recepcion/turnos/:id/reprogramar`) SHALL mostrar el mensaje legible de `SOLAPAMIENTO_PACIENTE` mediante `AlertaErrorNegocio` cuando la API responda `409` con `{"code":"SOLAPAMIENTO_PACIENTE"}`, conservando los datos cargados y recargando los huecos libres.

#### Scenario: El paciente ya tiene otro turno superpuesto al agendar desde recepción
- **GIVEN** la recepcionista seleccionó paciente, prestación y horario en `/recepcion/turnos/nuevo`
- **WHEN** confirma el alta y la API responde `409` con `{"code":"SOLAPAMIENTO_PACIENTE"}`
- **THEN** se muestra la alerta accesible indicando que el paciente ya tiene otro turno en ese horario y se recargan los huecos disponibles sin perder la selección del paciente
