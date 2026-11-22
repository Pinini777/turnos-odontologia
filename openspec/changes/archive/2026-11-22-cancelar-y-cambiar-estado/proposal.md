# Proposal

## Why

La agenda puede crear turnos (C-02), pero todavía no puede reflejar lo que pasa con ellos después: que el paciente confirme, que se atienda, que falte o que se cancele. Sin la máquina de estados del turno (RN-TU-01), cancelar ("eliminar") no libera el horario (RN-TU-02) y no hay forma de cerrar un turno como atendido. Además, C-10 (reprogramar) y C-11 (cancelación del paciente) dependen de esta lógica, por eso entra en la ola 1.

## What Changes

- Nueva máquina de estados pura: `reservado → confirmado → atendido | ausente` y `reservado | confirmado → cancelado`. `atendido`, `ausente` y `cancelado` son finales.
- `atendido` y `ausente` solo se pueden marcar si el turno ya empezó (`ahora >= inicio`, con la hora de `Clock`). Antes de eso, la transición es inválida.
- `POST /api/turnos/:id/cancelar`: pasa el turno a `cancelado` sin borrarlo (RN-TU-03) y deja una auditoría `cancelado` con el actor, la fecha y el estado de antes y de después.
- `POST /api/turnos/:id/estado` con `{ "estado": "confirmado" | "atendido" | "ausente" }`: cambia el estado y deja una auditoría `estado_cambiado`.
- Una transición inválida responde `409 TRANSICION_INVALIDA`. Un turno inexistente responde `404 NO_ENCONTRADO`. Las dos rutas son solo para `profesional` y `recepcionista`.
- El caso de uso de cancelar y la validación de transiciones se exportan para que los reutilicen C-10 y C-11.
- Queda fuera: el email al cancelar (PA-08; supuesto del MVP: no se envía), la consulta de la auditoría (C-07) y la regla de 24 h del paciente (C-11).

## Capabilities

### New Capabilities
- `turnos-estados`: ciclo de vida de un turno ya creado. Abarca las transiciones válidas entre estados, la cancelación lógica y el registro de auditoría de cada cambio de estado.

### Modified Capabilities
<!-- Ninguna: `plataforma` ya cubre el formato de errores, los roles, el ocultamiento de precios y el lock que usa este change. -->

## Impact

- Código nuevo, solo en `src/modules/turnos-estados/` (`dominio/estados.ts`, `aplicacion/`, `routes.ts`) y en `tests/turnos-estados/`.
- API: dos rutas nuevas bajo `/api/turnos/:id/`. No cambia ninguna ruta existente.
- No modifica `src/shared/` ni agrega dependencias: usa `TRANSICION_INVALIDA`, `NO_ENCONTRADO`, `requireRol`, `Clock`, `conLockDeAgenda` y los repositorios `turnos` y `auditoria` de C-01.
- Changes que dependen de este: C-10 (reutiliza la máquina de estados) y C-11 (reutiliza cancelar con el actor `"paciente"`).
