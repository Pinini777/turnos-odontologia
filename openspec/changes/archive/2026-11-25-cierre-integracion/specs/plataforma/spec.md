# Spec Delta — plataforma

## MODIFIED Requirements

### Requirement: Errores de regla de negocio
La violación de una regla de negocio SHALL responder `409` con `{"code":"<CODIGO>"}`, donde el código pertenece a la lista cerrada de `RN-EX-01` más `RECURSO_INACTIVO`, `DUPLICADO`, `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE`. El código `NO_ENCONTRADO` responde `404`. No se aceptan códigos fuera de la lista.

#### Scenario: Regla violada
- **WHEN** un caso de uso rechaza una operación con el código `SOLAPAMIENTO_BOX`
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`

#### Scenario: Recurso que no existe o no es del usuario
- **WHEN** un caso de uso rechaza una operación con el código `NO_ENCONTRADO`
- **THEN** la API responde `404` con `{"code":"NO_ENCONTRADO"}`

#### Scenario: Lista cerrada de códigos
- **WHEN** se enumeran los códigos de negocio disponibles
- **THEN** son exactamente `SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `SOLAPAMIENTO_PACIENTE`, `TURNO_PENDIENTE_EXISTENTE`, `FUERA_DE_GRILLA`, `DURACION_INVALIDA`, `EN_BLOQUEO`, `FUERA_DE_HORARIO`, `EN_EL_PASADO`, `PLAZO_VENCIDO`, `TRANSICION_INVALIDA`, `NO_ENCONTRADO`, `RECURSO_INACTIVO` y `DUPLICADO`

## ADDED Requirements

### Requirement: Semilla de demostración con turnos del día actual y un único turno futuro de Mario Santos
La semilla de demostración (`cargarSeedDemo`) SHALL incluir turnos en estado `reservado` y `confirmado` en el día hábil actual (`semana: 0`) para la Dra. Ana Pérez (Box 1) y el Dr. Bruno Gómez (Box 2) sin solapamientos de profesional, box ni paciente, y dejar a Mario Santos (`santos@example.com`) con un único turno futuro pendiente (`semana > 0`).

#### Scenario: La semilla demo carga turnos del día actual y un solo turno futuro para Mario Santos sin solapamientos
- **GIVEN** un repositorio en memoria sembrado con `cargarSeedDemo(repos, ahora)`
- **WHEN** se listan los turnos sembrados
- **THEN** existen turnos `reservado` y `confirmado` en la fecha de `semana: 0` para ambos profesionales, ningún paciente tiene turnos activos superpuestos y Mario Santos posee exactamente un turno futuro pendiente
