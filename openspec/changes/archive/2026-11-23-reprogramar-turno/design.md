# Design

## Context

Ver `proposal.md` (Why). C-10 llega con dos módulos ya mergeados de los que depende:

- **C-02 `turnos-alta`**: la validación del alta **no es una función reutilizable**; vive dentro de `crearTurno` (`aplicacion/crear-turno.ts`). Lo que sí se puede importar son las funciones puras de `dominio/agenda.ts`: `seSuperponen`, `conflictos(turnos, nuevo)` (que ya ignora cancelados y devuelve `{ profesional, box }`) y `enGrilla(inicio)`. También `armarEmailDeAlta` de `aplicacion/email.ts`. El orden de los rechazos en el alta es: grilla → pasado → recursos (`NO_ENCONTRADO` / `RECURSO_INACTIVO`) → `disponibilidad.verificar` → solapamiento de profesional → de box.
- **C-05 `turnos-estados`**: dejó el patrón de "auditar antes de guardar, con registro de reversión si falla guardar" después de la revisión del PR #2.

De C-01: `Deps` (repos, clock, `conLockDeAgenda`, `disponibilidad`, `notificador`), la acción de auditoría `reprogramado`, los códigos de RN-EX-01 y el hook `sinPrecioPara` de `app.ts`, que oculta `precioAlReservar` a la recepcionista en cualquier respuesta.

Restricciones: regla dura 3 (solo se escribe en `src/modules/turnos-reprogramacion/`, `tests/turnos-reprogramacion/` y este change; C-02 y C-05 se importan, no se editan) y regla 9 (dominio puro, la hora por `Clock`).

## Goals / Non-Goals

**Goals:**
- Una sola función de aplicación, `reprogramarTurno`, que C-11 pueda llamar con `actor: "paciente"`.
- Reutilizar las funciones puras de C-02 en vez de copiar la lógica de solapamientos.
- Que ninguna combinación de fallas deje el turno movido sin auditoría.

**Non-Goals:**
- No se comprueba de quién es el turno ni la regla de 24 h (C-11).
- No se cambia la prestación ni se recotiza el precio.
- No se arma el link de Google Calendar ni el `.ics` (C-06, todavía no está en `main`).
- No se corrige el orden de auditoría de C-02 (ver Riesgos).

## Decisions

### D1 — Estructura del módulo

```
src/modules/turnos-reprogramacion/
  dominio/reprogramacion.ts       esReprogramable(estado), intervaloNuevo(inicio, duracionMin),
                                  sinElPropio(turnos, turnoId)
  aplicacion/reprogramar-turno.ts reprogramarTurno({ turnoId, cambios, actor }, deps)
  routes.ts                       PATCH /turnos/:id/reprogramar, Zod + requireRol
tests/turnos-reprogramacion/
  reprogramacion.test.ts          dominio puro
  reprogramar-turno.test.ts       caso de uso con repos en memoria, FixedClock y fallas inyectadas
  routes.test.ts                  HTTP con buildApp + authDeTest
  fixtures.ts                     turnos de prueba del martes 24/11/2026
```

### D2 — Reutilizar C-02 sin editarlo

Se importan `conflictos` y `enGrilla` de `turnos-alta/dominio/agenda.ts`. Para excluir al propio turno, antes de llamar a `conflictos` se filtra la lista con `t.id !== turnoId` (`sinElPropio`). `conflictos` ya descarta los cancelados, así que RN-TU-02 se cumple igual que en el alta.
*Alternativa descartada:* extraer en C-02 una función `validarIntervalo` compartida. Sería lo más limpio, pero obliga a editar `turnos-alta/`, que es de EP (regla dura 3). Se puede proponer como refactor después de la entrega.
*Alternativa descartada:* copiar la lógica de solapamiento. Dos copias de la regla central del producto pueden divergir.

### D3 — Orden de las validaciones

Todo ocurre dentro de `conLockDeAgenda`, porque hay que leer el turno para saber su prestación y sus recursos actuales:

```
buscar turno            -> 404 NO_ENCONTRADO
esReprogramable(estado) -> 409 TRANSICION_INVALIDA     (antes que el resto: un turno final no se mueve)
enGrilla(inicio)        -> 409 FUERA_DE_GRILLA
inicio < clock.ahora()  -> 409 EN_EL_PASADO
profesional y box       -> 404 NO_ENCONTRADO / 409 RECURSO_INACTIVO
prestacion, paciente    -> se leen para fin y el email (no se valida que la prestación siga activa)
disponibilidad.verificar(nuevo intervalo) -> 409 FUERA_DE_HORARIO / EN_BLOQUEO
conflictos(sinElPropio(turnos), nuevo)    -> 409 SOLAPAMIENTO_PROFESIONAL, luego SOLAPAMIENTO_BOX
auditar 'reprogramado' -> guardar           (D5)
```

Después del grilla, el orden es el mismo del alta, para que crear y reprogramar respondan igual al mismo problema.
*Por qué no se valida que la prestación siga activa:* la prestación no cambia; desactivarla después de reservar no debería impedir mover un turno ya dado.

### D4 — Estado y campos del turno reprogramado

`{ ...turno, inicio, fin: inicio + prestacion.duracionMin, profesionalId, boxId, estado: 'reservado' }`. Se conservan `id`, `pacienteId`, `prestacionId`, `precioAlReservar` (RN-GA-02), `origen`, `creadoPor` y `creadoEn`.
*Decisión del usuario (explore):* un `confirmado` vuelve a `reservado`. No se usa la tabla `TRANSICIONES` de C-05, porque `confirmado → reservado` no es una transición manual válida en `POST /estado`; reprogramar tiene su propia regla (`esReprogramable`: `reservado` o `confirmado`).
*`fin` con la duración actual de la prestación*, igual que en el alta (F-02: "recalcula `fin`").

### D5 — Auditar antes de guardar

Mismo criterio que C-05 tras la revisión del PR #2: se agrega el registro `reprogramado` y recién después se guarda el turno. Si falla la auditoría, el turno no se tocó. Si falla guardar, se agrega un registro de reversión (`detalle.revertido: true`, con `antes` y `despues` invertidos) y se relanza el error; si eso también falla, queda auditado un intento no aplicado (registra de más, nunca de menos).
`detalle = { antes: { estado, inicio, fin, profesionalId, boxId }, despues: { … } }`.

### D6 — Email fuera del lock

El email se envía después de liberar el lock, con `armarEmailDeAlta(turnoActualizado, { paciente, profesional, box, prestacion })`, y un fallo se ignora (RN-NO-02), igual que en el alta. El asunto de C-02 ("Turno confirmado: …") sirve también para la reprogramación, porque informa el horario vigente.
*Cuando C-06 esté en `main`:* se reemplaza por `enviarConfirmacionTurno` de `notificaciones`, que agrega el link de Google Calendar y el `.ics`. Es un cambio de una línea en el caso de uso y no cambia el spec.

### D7 — Ruta y validación de entrada

`PATCH /api/turnos/:id/reprogramar`, `preHandler: requireRol('profesional', 'recepcionista')`. Zod: `params = { id: string no vacío }`, `body = { inicio: z.string().datetime({ offset: true }), profesionalId?: string no vacío, boxId?: string no vacío }`, el mismo formato de `inicio` que el alta. Responde `200` con el turno; el hook de `app.ts` oculta el precio a la recepcionista.

### D8 — Contrato para C-11

`reprogramarTurno({ turnoId, cambios: { inicio: Date, profesionalId?, boxId? }, actor }, deps)` con `deps: Pick<Deps, 'repos' | 'clock' | 'conLockDeAgenda' | 'disponibilidad' | 'notificador'>`. `actor` es el `usuarioId` de la sesión o `"paciente"`. C-11 verifica que el turno sea del paciente y la regla de 24 h (`PLAZO_VENCIDO`) antes de llamarla.

### Supuestos aplicados

- **Mismo horario y mismos recursos**: se acepta, se audita y se reenvía el email. No hay un código de RN-EX-01 para "sin cambios" y no se justifica pedir uno.
- **Horario original ya pasado**: se puede mover; RN-AG-10 solo controla el nuevo `inicio`.
- **PA-09**: cualquier profesional puede reprogramar cualquier turno (la matriz RBAC no lo limita).

## Risks / Trade-offs

- [C-02 cambia la firma de `conflictos` o `enGrilla`] → Los tests de C-10 fallan en CI y se ve en el PR. Son funciones puras y chicas; si cambian, el ajuste es local.
- [C-02 audita después de guardar, con el mismo hueco que se corrigió en C-05] → Fuera del alcance de este change (regla dura 3). Se le avisa a EP en el PR.
- [El email no trae el link de Google Calendar ni el `.ics` hasta que C-06 se mergee] → D6 deja el reemplazo en una línea; se anota en el PR.
- [Un `confirmado` reprogramado obliga a volver a confirmarlo] → Es la decisión del usuario (D4); el email nuevo avisa el horario y la recepción vuelve a confirmar.

## UI Mockups

- Design system revision: no aplica
- Decision: no (no UI) — 2026-11-23
