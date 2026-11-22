# Design

## Context

C-01 dejó listos los contratos que usa este change. En `src/shared/entidades.ts` están `EstadoTurno`, `Turno` y `AuditoriaTurno` (con las acciones `cancelado` y `estado_cambiado`); en `errores.ts`, `ReglaDeNegocioError` con `TRANSICION_INVALIDA` y `NO_ENCONTRADO`. `sesion.ts` trae `requireRol` y `sesionDe`, `clock.ts` trae `Clock` y `FixedClock`, y `lock.ts` trae `conLockDeAgenda`. Los repositorios `turnos` (sin borrado) y `auditoria` (append-only) también vienen de C-01. `src/app.ts` carga solo `src/modules/turnos-estados/routes.ts`, oculta los precios según el rol y traduce los errores (`ZodError → 400`, regla → `409`, `NO_ENCONTRADO → 404`).

Restricciones: `src/shared/` y `src/app.ts` están congelados (regla dura 3); el dominio es puro, sin Fastify, sin repositorios y sin `Date.now()` (regla 9); el seed de C-01 **no trae turnos**.

## Goals / Non-Goals

**Goals:**
- La regla de transiciones vive en una función pura que C-10 y C-11 importan sin pasar por HTTP.
- Cancelar es un caso de uso que recibe el actor como parámetro, para que C-11 lo llame con `"paciente"`.
- Validar, guardar y auditar ocurren dentro del lock de agenda, como una sola operación.

**Non-Goals:**
- No se comprueba de quién es el turno. C-11 verifica que sea del paciente y la regla de 24 h antes de llamar a `cancelarTurno`.
- No hay rutas de lectura (`GET` del turno ni de la auditoría; esta última es de C-07).
- No se envía email (PA-08).

## Decisions

### D1 — Estructura del módulo

```
src/modules/turnos-estados/
  dominio/estados.ts          validarTransicion(desde, hacia, { ahora, inicio }) -> void | lanza TRANSICION_INVALIDA
  aplicacion/cambiar-estado.ts cancelarTurno(...) y cambiarEstado(...): buscar -> validar -> guardar -> auditar
  routes.ts                    Zod en el borde + requireRol('profesional', 'recepcionista')
tests/turnos-estados/
  estados.test.ts              tabla de transiciones (dominio puro)
  cambiar-estado.test.ts       casos de uso con repositorios en memoria y FixedClock
  routes.test.ts               HTTP con buildApp + authDeTest
  fixtures.ts                  turnos de prueba
```

Es la estructura por módulo de DD-13. Los tests se separan por capa para que un fallo de la regla se vea sin ruido de HTTP.

### D2 — La máquina de estados es una tabla, no un `switch`

`TRANSICIONES: Record<EstadoTurno, readonly EstadoTurno[]>` (`reservado → [confirmado, cancelado]`, `confirmado → [atendido, ausente, cancelado]`, los finales con lista vacía). `validarTransicion` consulta la tabla y después aplica la regla horaria a `atendido` y `ausente`. La tabla se exporta para que C-10 pregunte "¿se puede cancelar?" (es decir, si el estado está en `reservado | confirmado`) sin duplicar la regla.
*Alternativa descartada:* un `switch` por estado. Es más largo y más difícil de recorrer exhaustivamente en los tests.

### D3 — La hora entra por parámetro

`validarTransicion` recibe `ahora` e `inicio` como `Date`. El caso de uso los obtiene de `deps.clock.ahora()` y del turno. La comparación es `ahora.getTime() >= inicio.getTime()`, en UTC: no necesita `enZonaConsultorio()`, porque no depende del día ni de la hora local, solo del orden entre dos instantes.
*Decisión del usuario (explore):* `atendido` y `ausente` antes del inicio se rechazan con el código existente `TRANSICION_INVALIDA`, no con uno nuevo. Así no hay que pedirle un código a EP. Costo: el front no distingue este caso de las demás transiciones inválidas.

### D4 — Mismo estado = transición inválida

`confirmado → confirmado` no está en la tabla y responde `409`. Así no se generan registros de auditoría vacíos y un doble clic no crea historia falsa.
*Alternativa descartada:* que sea idempotente (`200` sin cambios). Es más amigable, pero oculta errores del cliente.

### D5 — Casos de uso dentro de `conLockDeAgenda`

`cancelarTurno` y `cambiarEstado` ejecutan buscar → validar → guardar → auditar dentro del lock. Sin él, una cancelación y una reprogramación (C-10) del mismo turno podrían leer el mismo estado y pisarse.
La firma es `cancelarTurno({ turnoId, actor }, deps)`, con `deps: Pick<Deps, 'repos' | 'clock' | 'conLockDeAgenda'>`, para que C-11 la reutilice con `actor: "paciente"`.

### D6 — Auditoría

Un registro por operación exitosa: `{ id: randomUUID(), turnoId, accion, actor, fecha: clock.ahora(), detalle: { antes: { estado }, despues: { estado } } }`. El `actor` es el `usuarioId` de la sesión (o `"paciente"` cuando llama C-11). La auditoría se escribe después de guardar el turno: si guardar falla, no queda un registro de algo que no pasó.

**Ajuste por la revisión del PR (2026-11-22):** si falla la escritura de auditoría después de guardar, el caso de uso vuelve a guardar el turno original y relanza el error (compensación). Todo pasa dentro de `conLockDeAgenda`, así que nadie ve el estado intermedio. No se usa una transacción porque `src/shared/` está congelado; cuando llegue el adaptador SQLite, EP puede agregar un puerto de unidad de trabajo y reemplazar la compensación. Límite conocido: si también falla el `guardar` de compensación, el turno queda cambiado sin auditoría (con repos en memoria es prácticamente imposible). Test: `tests/turnos-estados/cambiar-estado.test.ts`, "si falla la escritura de auditoría…".

### D7 — Validación de entrada

Zod en `routes.ts`: `params = { id: string no vacío }`, `body = { estado: z.enum(['confirmado','atendido','ausente']) }`. `cancelado` y `reservado` son errores de formato (`400`), no de negocio: cancelar tiene su propia ruta (por eso no hay dos caminos para lo mismo) y `reservado` es solo el estado inicial.

### D8 — Turnos de prueba

Como el seed no trae turnos, `tests/turnos-estados/fixtures.ts` arma turnos con los profesionales, boxes, prestaciones y pacientes de `SEED`, en días hábiles entre 09:00 y 13:00 (regla dura 8), y los guarda con `repos.turnos.guardar` antes de cada test. No hace falta tocar `src/shared/seed.ts`.

### Supuestos aplicados

- **PA-08** (¿email al cancelar?): no se envía en el MVP. Si EP lo pide, se agrega en el caso de uso con `deps.notificador`, sin cambiar la spec de transiciones.
- **PA-09** (¿el profesional ve los turnos de otros?): cualquier profesional puede cambiar el estado de cualquier turno; la matriz RBAC no lo limita a los suyos.

## Risks / Trade-offs

- [El front no distingue "todavía no empezó" de "transición imposible"] → Ambos casos son `TRANSICION_INVALIDA` (D3). Si C-13 lo necesita, se le pide a EP un código nuevo y se cambia solo `validarTransicion`.
- [C-10 y C-11 importan desde `turnos-estados/`] → Se exportan solo `TRANSICIONES`, `validarTransicion` y `cancelarTurno`; su firma es parte del contrato y no se cambia sin avisar en el PR.
- [Diferencias de reloj entre recepción y servidor en el borde del inicio] → La hora es siempre la del servidor (`Clock`); el borde exacto (`ahora == inicio`) está cubierto por un test.

## UI Mockups

- Design system revision: no aplica
- Decision: no (no UI) — 2026-11-22
