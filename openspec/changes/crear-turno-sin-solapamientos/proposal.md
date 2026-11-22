# Proposal

## Why

Elegimos "Crear un turno sin solapamientos" (US-010) porque es el núcleo del MVP que recomendamos en la sección D.3 del discovery y el diferencial del producto: ningún profesional ni box puede quedar con dos turnos superpuestos. Sus reglas son verificables con tests (RN-AG-02 a RN-AG-07 y RN-AG-10), incluido el borde de un turno que empieza justo cuando termina otro. Es una sola funcionalidad, que solo depende de los contratos de C-01, y por eso se puede terminar en un día.

Hoy la API no permite cargar turnos: C-01 dejó los contratos, pero ningún módulo valida la agenda. Sin esta funcionalidad no hay reprogramación (C-10), reserva online (C-11) ni agenda (C-07) que tengan sentido.

## What Changes

- Nuevo endpoint `POST /api/turnos` para el profesional y la recepcionista, con `{profesionalId, boxId, prestacionId, pacienteId, inicio}`.
- El fin del turno se calcula con la duración de la prestación, y el precio de la prestación queda congelado en el turno.
- Rechazos con `409`: solapamiento de profesional o de box, fuera de la grilla de 15 minutos, inicio en el pasado, recurso inactivo, y fuera de horario o en un bloqueo según el puerto de disponibilidad. `404` si un recurso no existe y `400` si el formato es inválido.
- Un turno cancelado no bloquea el horario. No hay ningún parámetro para forzar un sobreturno.
- La validación y el guardado son atómicos: de dos altas simultáneas al mismo hueco, solo una se crea.
- Cada alta deja un registro de auditoría `creado` y envía un email mínimo de confirmación, sin precio. Si el email falla, el turno no se revierte.

## Capabilities

### New Capabilities
- `turnos-alta`: alta de turnos por el personal del consultorio con las reglas de agenda (grilla, pasado, recursos, disponibilidad y solapamientos por profesional y por box), auditoría del alta y aviso al paciente.

### Modified Capabilities
<!-- Ninguna: no cambia ningún requisito de `plataforma`. -->

## Impact

- **Código nuevo**: solo `src/modules/turnos-alta/` (`dominio/`, `aplicacion/`, `routes.ts`) y `tests/turnos-alta/`. No se toca `src/shared/`, `src/app.ts` ni `package.json`.
- **API**: agrega `POST /api/turnos`. Sin dependencias nuevas.
- **Otros changes**: C-10 (reprogramar) va a importar la detección de solapamientos de este módulo. C-03 y C-06 reemplazan sus stubs sin tocar este módulo.
- **Ajuste a la KB**: cuando chocan profesional y box a la vez, la API responde `SOLAPAMIENTO_PROFESIONAL` (ver `explore.md`, H-1).
- **Governance**: MEDIO. Checkpoint con EP después de `propose` (revisión del spec) y antes de `archive`.
