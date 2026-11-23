# Proposal

## Why

Hoy la agenda puede crear turnos sin solapamientos (C-02) y cancelarlos o cambiarles el estado (C-05), pero no puede moverlos. Si un paciente pide otro horario, la recepción tiene que cancelar y crear un turno nuevo: pierde el historial del turno y el precio congelado al reservar. US-012 pide mover un turno a otro horario, box o profesional con las mismas garantías que el alta (RN-TU-04). C-11 lo necesita para que el paciente reprograme su propio turno.

## What Changes

- `PATCH /api/turnos/:id/reprogramar` con `{ "inicio", "profesionalId"?, "boxId"? }`: mueve el turno al nuevo intervalo y, si se indican, a otro profesional o box. `fin` se recalcula con la duración de la prestación. La prestación y `precioAlReservar` no cambian.
- Aplica las mismas validaciones que el alta (grilla de 15 minutos, en el pasado, recursos existentes y activos, horario y bloqueos, solapamiento de profesional y de box), con los mismos códigos de error, **excluyendo al propio turno** de la comparación de solapamientos. Todo dentro de `conLockDeAgenda`.
- Solo se reprograman turnos `reservado` o `confirmado`. Cualquier otro estado responde `409 TRANSICION_INVALIDA`.
- Un turno reprogramado queda siempre en `reservado`: si estaba `confirmado`, el paciente había confirmado el horario viejo y hay que volver a confirmarlo.
- Cada reprogramación exitosa deja una auditoría `reprogramado` con el estado, el intervalo, el profesional y el box de antes y de después, escrita antes de guardar el turno (mismo criterio que C-05).
- Después de reprogramar se reenvía el email de confirmación al paciente, sin precio. Si el envío falla, el turno no se revierte (RN-NO-02).
- Solo para `profesional` y `recepcionista`; el paciente recibe `403` y reprograma por C-11.
- El caso de uso `reprogramarTurno` se exporta con un `actor` para que C-11 lo reutilice con `"paciente"` y le agregue la regla de 24 h.
- Queda fuera: cambiar la prestación (eso es cancelar y crear otro turno), la regla de 24 h del paciente (C-11) y el link de Google Calendar y el `.ics` en el email (C-06; se suman cuando C-06 esté en `main`).

## Capabilities

### New Capabilities
- `turnos-reprogramacion`: mover un turno existente a otro intervalo, profesional o box, con las validaciones de agenda del alta, sin chocar consigo mismo, con auditoría y reenvío del email.

### Modified Capabilities
<!-- Ninguna: turnos-alta y turnos-estados no cambian sus requisitos; este change solo reutiliza sus funciones. -->

## Impact

- Código nuevo, solo en `src/modules/turnos-reprogramacion/` (`dominio/`, `aplicacion/`, `routes.ts`) y en `tests/turnos-reprogramacion/`.
- API: una ruta nueva, `PATCH /api/turnos/:id/reprogramar`. No cambia ninguna ruta existente.
- Importa sin editar: `conflictos` y `enGrilla` de `turnos-alta/dominio/agenda.ts` y `armarEmailDeAlta` de `turnos-alta/aplicacion/email.ts` (C-02).
- No modifica `src/shared/` ni agrega dependencias: usa los códigos de RN-EX-01 existentes, la acción de auditoría `reprogramado`, `requireRol`, `Clock`, `conLockDeAgenda`, `DisponibilidadPort` y `Notificador` de C-01.
- Change que depende de este: C-11 (reprogramación del paciente).
