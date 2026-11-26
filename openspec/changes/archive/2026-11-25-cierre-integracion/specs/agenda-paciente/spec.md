# agenda-paciente Specification

## Purpose

Garantizar la consistencia de agenda por paciente en todas las vías de creación y reprogramación de turnos: impedir que un mismo paciente tenga dos turnos activos superpuestos en el tiempo (`409 SOLAPAMIENTO_PACIENTE`) respetando la precedencia de validación `profesional → box → paciente`, y limitar la autogestión de reserva online del paciente a un único turno futuro pendiente de atención (`409 TURNO_PENDIENTE_EXISTENTE`).

## ADDED Requirements

### Requirement: Prevención transversal de solapamiento por paciente
El sistema SHALL rechazar con `409 SOLAPAMIENTO_PACIENTE` cualquier alta o reprogramación cuando el paciente ya posea otro turno no cancelado que se superponga en `[inicio, fin)`, evaluando dentro de `conLockDeAgenda` en orden estricto `profesional → box → paciente` y excluyendo al propio turno al reprogramar.

#### Scenario: Rechaza turno superpuesto del mismo paciente con distinto profesional y box
- **GIVEN** un paciente con un turno `reservado` de 10:00 a 10:30 con la Dra. Pérez en el Box 1
- **WHEN** se intenta agendar o mover otro turno del mismo paciente de 10:15 a 10:45 con el Dr. Gómez en el Box 2
- **THEN** la operación se rechaza con `409` y `{"code":"SOLAPAMIENTO_PACIENTE"}` sin persistir cambios

#### Scenario: Respeta precedencia profesional y box antes que paciente ante conflicto múltiple
- **GIVEN** un paciente con un turno `reservado` de 10:00 a 10:30 con la Dra. Pérez en el Box 1
- **WHEN** se intenta crear otro turno para el mismo paciente a las 10:00 con la Dra. Pérez o en el Box 1
- **THEN** la API responde `409 SOLAPAMIENTO_PROFESIONAL` si choca el profesional o `409 SOLAPAMIENTO_BOX` si solo choca el box

#### Scenario: Permite turnos contiguos o sobre hueco cancelado del mismo paciente
- **GIVEN** un paciente con un turno `cancelado` de 09:00 a 09:30 y un turno `confirmado` de 10:00 a 10:30
- **WHEN** se agenda un turno para ese paciente de 09:00 a 09:30 o de 10:30 a 11:00 con recursos libres
- **THEN** la validación por paciente aprueba ambos intervalos sin conflicto

### Requirement: Límite de un único turno futuro pendiente en la reserva online
El sistema SHALL rechazar con `409 TURNO_PENDIENTE_EXISTENTE` toda solicitud de `POST /api/paciente/turnos` cuando el paciente autenticado ya posea un turno en estado `reservado` o `confirmado` con `inicio > ahora`, sin restringir la reprogramación, la cancelación ni las altas realizadas por el personal.

#### Scenario: Paciente con turno futuro reservado o confirmado no puede crear otra reserva online
- **GIVEN** que ahora es lunes 08:00 y el paciente autenticado ya tiene un turno `reservado` el martes a las 10:00
- **WHEN** el paciente envía `POST /api/paciente/turnos` para otro horario libre
- **THEN** la API responde `409` con `{"code":"TURNO_PENDIENTE_EXISTENTE"}` y no crea el segundo turno

#### Scenario: Paciente cuyo turno pendiente ya alcanzó su horario de inicio o fue cancelado puede reservar online
- **GIVEN** que el único turno del paciente está `cancelado` o tiene `inicio <= ahora`
- **WHEN** el paciente envía `POST /api/paciente/turnos` para un hueco futuro disponible
- **THEN** la API permite la reserva y responde `201` con el nuevo turno `reservado`
