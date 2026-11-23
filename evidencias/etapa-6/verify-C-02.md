# Verify C-02 — crear turno sin solapamientos

Fecha: 2026-11-22.

**Resultado actualizado:** los comandos de la verificación integral y el health check terminaron correctamente. Se agregaron las aserciones de inicio y fin que faltaban en los dos escenarios de turnos contiguos. Los 24 escenarios están vinculados a tests, y la verificación independiente posterior pasó sobre una copia aislada.

Los datos empleados por los tests son ficticios. El servidor de la prueba de salud se detuvo al terminar.

## Salidas observadas

### `npm test` — código de salida 0

```text
> test
> vitest run && npm test -w web


 RUN  v3.2.7 C:/UTN/UTN/TERCER ANIO/DESARROLLO DE SOFTWARE/GLOBAL/turnos-odontologia

 ✓ tests/turnos-alta/agenda.test.ts (13 tests) 201ms
 ✓ tests/plataforma/shared.test.ts (21 tests) 132ms
 ✓ tests/plataforma/app.test.ts (17 tests) 973ms
   ✓ Chequeo de salud > La API está viva: GET /api/health sin token → 200  767ms
 ✓ tests/turnos-alta/crear-turno.test.ts (24 tests) 1043ms
   ✓ POST /api/turnos > rechaza un inicio inválido  776ms

 Test Files  4 passed (4)
      Tests  75 passed (75)
   Start at  21:48:58
   Duration  3.79s (transform 816ms, setup 0ms, collect 3.35s, tests 2.35s, environment 1ms, prepare 2.73s)


> test
> vitest run


 RUN  v3.2.7 C:/UTN/UTN/TERCER ANIO/DESARROLLO DE SOFTWARE/GLOBAL/turnos-odontologia/web

 ✓ src/rutas.test.ts (2 tests) 3ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  21:49:04
   Duration  3.45s (transform 52ms, setup 0ms, collect 54ms, tests 3ms, environment 2.39s, prepare 333ms)
```

### `npm run typecheck` — código de salida 0

```text
> typecheck
> tsc && npm run typecheck -w web


> typecheck
> tsc
```

### `npm run lint` — código de salida 0

```text
> lint
> eslint .
```

### Health check — código de salida 0

Se inició el mismo comando de aplicación definido por `npm start` (`tsx src/server.ts`), se consultó `GET http://127.0.0.1:3000/api/health` y se cerró el proceso.

```text
HTTP 200 {"status":"ok"}
```

## Trazabilidad: escenarios del spec y tests

Los tests HTTP de esta tabla están en `tests/turnos-alta/crear-turno.test.ts`. En los casos parametrizados, se indica el valor de la fila de `it.each`.

| Escenario del spec | Test correspondiente | Alcance observado |
|---|---|---|
| La recepcionista crea un turno en un hueco libre | `la recepcionista crea un turno sin ver el precio congelado` | Comprueba 201, estado, origen, actor, inicio, fin y precio oculto y guardado. |
| El profesional ve el precio congelado | `el profesional ve el precio congelado al crear un turno` | Comprueba 201, origen y precio; usa las 10:00 en lugar de las 11:00 del ejemplo. |
| El profesional ya está ocupado en otro box | `rechaza profesional ocupado en otro box` | Comprueba 409, código y ausencia de nuevos turnos, auditorías y emails. |
| El box ya está ocupado por otro profesional | `rechaza box ocupado por otro profesional` | Comprueba 409 y código; intercambia los profesionales del ejemplo. |
| Profesional y box ocupados en el mismo intervalo | `rechaza ambos recursos ocupados` | Comprueba 409 y prioridad del código de profesional. |
| Turno que empieza justo cuando termina otro | `acepta un turno contiguo que empieza a 2026-11-24T10:30:00-03:00` | Comprueba 201, inicio, fin 11:00 y persistencia. |
| Turno que termina justo cuando empieza otro | `acepta un turno contiguo que empieza a 2026-11-24T09:30:00-03:00` | Comprueba 201, inicio, fin 10:00 y persistencia. |
| Turno que empieza antes de que termine otro | `rechaza turno que empieza antes de que termine otro` | Comprueba 409 y código de profesional para las 10:15. |
| Se reserva el hueco de un turno cancelado | `acepta un turno en el hueco de uno cancelado` | Comprueba 201 y persistencia. |
| El profesional intenta forzar un sobreturno | `rechaza intento de forzar un sobreturno` | Comprueba 409 con rol profesional y el campo extra. |
| Inicio fuera de la grilla | `rechaza inicio fuera de la grilla` | Comprueba 409 y `FUERA_DE_GRILLA`. |
| Inicio con segundos | `rechaza inicio con segundos` | Comprueba 409 y `FUERA_DE_GRILLA`. |
| Inicio anterior a ahora | `rechaza inicio anterior a ahora` | Comprueba 409 y `EN_EL_PASADO`. |
| Paciente inexistente | `rechaza un paciente inexistente` | Comprueba 404 y `NO_ENCONTRADO`. |
| Box inactivo | `rechaza un box inactivo` | Comprueba 409 y `RECURSO_INACTIVO`. |
| Fuera del horario de atención | `rechaza disponibilidad FUERA_DE_HORARIO` | Comprueba 409 y los datos consultados al puerto. |
| Dentro de un bloqueo | `rechaza disponibilidad EN_BLOQUEO` | Comprueba 409 y los datos consultados al puerto. |
| Inicio inválido | `rechaza un inicio inválido` | Comprueba 400, código y detalle del campo `inicio`. |
| Un paciente intenta usar el alta del personal | `rechaza el alta del personal si la solicita un paciente` | Comprueba 403 y `SIN_PERMISO`. |
| Sin sesión | `rechaza una solicitud sin sesión` | Comprueba 401 y `NO_AUTENTICADO`. |
| Dos altas al mismo hueco a la vez | `crea solo un turno cuando llegan dos altas simultáneas al mismo hueco` | Comprueba una respuesta 201, una 409 y un solo turno guardado. |
| Registro de auditoría al crear | `registra la auditoría del alta con actor, fecha y turno creado` | Comprueba la acción, actor, fecha y detalle. |
| Email de confirmación sin precio | `envía una confirmación al paciente sin precio` | Comprueba destinatario, fecha, hora, recursos y ausencia de precio. |
| Falla el envío del email | `mantiene el turno creado si falla el envío del email` | Comprueba intento de envío, respuesta 201 y persistencia del turno. |

Como cobertura adicional de dominio, `tests/turnos-alta/agenda.test.ts` comprueba la contigüidad en ambos órdenes, el solapamiento a las 10:15, conflictos por recurso, cancelaciones y grilla de 15 minutos.

## Límites de la revisión independiente

La revisión independiente no identificó bloqueantes en permisos o concurrencia. Su intento de ejecutar `npm test` en una copia temporal falló antes de los tests porque la ruta temporal contenía `#` y Vite no pudo resolver `/@vite/env`; no se ejecutaron probes independientes en esa copia. El verificador ejecutó las suites sin caché en el checkout, no en la copia aislada. Los resultados de los comandos en este documento corresponden a la ejecución local indicada arriba, no a esa copia.

### Revisión posterior en copia aislada

Un script independiente ejecutado con `tsx` sobre una nueva copia aislada completó **10 grupos de pruebas con código de salida 0**. Comprobó roles y precios, rechazos sin cambios en turnos/auditoría/emails, precio congelado, ambos límites contiguos y tres lotes de 20 altas simultáneas (mismos recursos, solo profesional compartido y solo box compartido). En cada lote se observó una alta, 19 conflictos, una auditoría y un email. También comparó el health check con la base `95a642c`: status, cuerpo y content-type iguales.

La autenticación se inyectó como puerto de prueba: no se verificó emisión ni validación criptográfica de JWT. Tampoco se probó concurrencia multiproceso. El primer harness de esta revisión tuvo un error de token predeterminado que se corrigió antes de la ejecución exitosa; no fue un defecto del producto.
## Reejecución tras completar las aserciones

### `npm test` — código de salida 0

```text
> test
> vitest run && npm test -w web


 RUN  v3.2.7 C:/UTN/UTN/TERCER ANIO/DESARROLLO DE SOFTWARE/GLOBAL/turnos-odontologia

 ✓ tests/turnos-alta/agenda.test.ts (13 tests) 180ms
 ✓ tests/plataforma/shared.test.ts (21 tests) 113ms
 ✓ tests/plataforma/app.test.ts (17 tests) 1079ms
   ✓ Chequeo de salud > La API está viva: GET /api/health sin token → 200  754ms
 ✓ tests/turnos-alta/crear-turno.test.ts (24 tests) 1182ms
   ✓ POST /api/turnos > rechaza un inicio inválido  771ms

 Test Files  4 passed (4)
      Tests  75 passed (75)
   Start at  22:11:42
   Duration  3.74s (transform 782ms, setup 0ms, collect 3.06s, tests 2.55s, environment 1ms, prepare 2.40s)


> test
> vitest run


 RUN  v3.2.7 C:/UTN/UTN/TERCER ANIO/DESARROLLO DE SOFTWARE/GLOBAL/turnos-odontologia/web

 ✓ src/rutas.test.ts (2 tests) 4ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:11:48
   Duration  3.95s (transform 63ms, setup 0ms, collect 81ms, tests 4ms, environment 2.88s, prepare 391ms)
```

### `npm run typecheck` — código de salida 0

```text
> typecheck
> tsc && npm run typecheck -w web


> typecheck
> tsc
```

### `npm run lint` — código de salida 0

```text
> lint
> eslint .
```

### `GET /api/health` — código de salida 0

```text
HTTP 200 {"status":"ok"}
```


