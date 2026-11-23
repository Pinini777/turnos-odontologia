# Design

## Context

C-01 dejó congelados `src/app.ts` y `src/shared/`: el autoload publica `src/modules/<capability>/routes.ts` bajo `/api`, el hook `onRoute` autentica toda ruta que no sea pública, `preSerialization` quita precios según el rol y el `setErrorHandler` traduce `ZodError → 400`, `ReglaDeNegocioError → 409/404`, `NoAutenticadoError → 401` y `SinPermisoError → 403`. `Turno` ya guarda `profesionalId`, `inicio`, `fin`, `estado` y `precioAlReservar`; `repos.turnos.listar(filtro)` alcanza para leer sin un puerto nuevo. Ver `proposal.md` para la motivación.

Restricciones: solo se escribe en `src/modules/ganancias/`, `tests/ganancias/` y `openspec/changes/ganancias-profesional/` (regla dura 3). El dominio es puro, sin Fastify, repositorios ni `Date.now()` (regla dura 9). El seed no trae turnos y `tests/plataforma/helpers.ts` no se puede editar (solo conoce los tokens `prof`, `recep` y `pac`).

### Referencias verificadas del explore (R1–R9)

| Ref | Hallazgo | Uso en este change |
|---|---|---|
| R1 | `Turno` tiene `profesionalId`, `inicio`, `fin`, `estado` y `precioAlReservar: number` (`src/shared/entidades.ts:77-92`); `EstadoTurno` es una unión cerrada y `atendido` es final (`entidades.ts:74`, `src/modules/turnos-estados/dominio/estados.ts:11`). | El cálculo no necesita entidades nuevas ni consultar la prestación. |
| R2 | `repos.turnos` es un `Repositorio<Turno>` con `listar(filtro?)`, implementado por `EnMemoria` con copias (`src/shared/repositorios.ts:11,34,42-65`). | No se agrega puerto ni se toca `shared/`: el caso de uso filtra con `listar`. |
| R3 | La sesión trae `profesionalId?`; `sesionDe()` y `requireRol()` viven en `src/shared/sesion.ts:5-12,26-36`. El hook de `src/app.ts:50-62` autentica y el mapeo de `SinPermisoError` a `403` está en `:78`. | Autorización en dos capas (borde + caso de uso) sin tocar el arranque. |
| R4 | `src/modules/configuracion/aplicacion/horarios.ts:33-35` es el precedente de `403` por propiedad; allí primero se comprueba existencia (`404`, `:18-20`). | Se invierte el orden a propósito: acá se direcciona un dueño, no un recurso (D6). |
| R5 | `sinPrecioPara` solo filtra `precio` y `precioAlReservar` (`src/shared/precios.ts:34-38`); un campo `total` no queda protegido por el serializador. | La autorización debe ser explícita; el 403 de rol no se delega al serializador (D7). |
| R6 | El autoload publica `src/modules/*/routes.ts` con `export default` (`src/app.ts:89,103-114`). | El módulo se publica solo, sin editar archivos centrales (D1). |
| R7 | El precedente de fechas es `z.string().datetime({ offset: true })` y el `refine` de `inicio < fin` con `issue` sobre `fin` (`src/modules/configuracion/rutas-agenda.ts:56-57,70-76`). | Mismo esquema para `desde`/`hasta` (D3). |
| R8 | `enZonaConsultorio()` convierte instante → local (`src/shared/zona.ts:16-27`), pero no existe el helper inverso y `shared/` está congelado. | El período se compara como instantes, sin matemática de zona (D3, D4). |
| R9 | El seed define Ana (`…101`) y Bruno (`…102`) con usuarios `…601`/`…602` y no trae turnos (`src/shared/seed.ts:21-24`); `tests/plataforma/helpers.ts:5-18` solo conoce tres tokens. | Fixtures propias y un `AuthPort` local que agrega a Bruno (D9). |

## Goals / Non-Goals

**Goals:**
- Calcular el total con una función pura reutilizable y sin dependencias del borde HTTP.
- Garantizar que solo el dueño vea el total, con dos capas independientes de autorización.
- Delimitar el período de forma consistente con la agenda (`[desde, hasta)` sobre `inicio`) y sumar sin errores de punto flotante.
- Cubrir cada escenario del spec con un test de Vitest, incluidos los tres roles no dueños y los bordes del intervalo.

**Non-Goals:**
- Pantallas, gráficos o exportaciones (`web/` es C-12 a C-15).
- Totales persistidos, caché o agregados por prestación, paciente o box.
- Impuestos, liquidaciones, comisiones o ganancias de varios profesionales en una sola consulta.
- Un límite máximo de rango o paginación: el MVP acepta cualquier período válido.

## Decisions

### D1 — Estructura hexagonal del módulo (DD-13)

```
src/modules/ganancias/
  dominio/ganancias.ts                 sumarGanancias(turnos, { desde, hasta }) -> number
  aplicacion/calcular-ganancias.ts     calcularGanancias({ sesion, profesionalId, desde, hasta }, { repos })
  routes.ts                            Zod en el borde + requireRol('profesional') + caso de uso
tests/ganancias/
  ganancias.test.ts                    dominio puro + caso de uso con repositorios en memoria
  routes.test.ts                       HTTP con buildApp y auth local
  fixtures.ts                          turnos en los cinco estados, dos profesionales, AuthPort local
```

Es el espejo de `src/modules/turnos-estados/`. `routes.ts` exporta un plugin por defecto y no enumera nada central (R6). La función pura recibe los turnos ya leídos para poder testear la regla sin repositorios.

*Alternativa descartada:* sumar dentro de `routes.ts`. Mezcla borde, autorización y aritmética, y hace imposible testear la regla de negocio sin HTTP.

### D2 — PA-04: recálculo en vivo, sin totales persistidos

Cada consulta vuelve a leer `repos.turnos` y suma el estado vigente (RN-GA-03). No hay tabla de totales, caché ni invalidación. La decisión la confirmó el usuario en el explore.

Hoy `atendido` es un estado final (`estados.ts:11`), así que la corrección de un atendido no es alcanzable por API y el supuesto se cumple trivialmente. Sigue siendo la decisión correcta si un change futuro habilita corregir un atendido: el total cambiaría solo con volver a consultar.

*Alternativa descartada:* guardar un total por profesional y período al marcar `atendido`. Agrega escrituras, invalidación y un dato que puede quedar viejo; contradice RN-GA-03.

### D3 — `desde` y `hasta`: ISO 8601 con offset, obligatorios, comparados como instantes

Zod en `routes.ts`: `z.string().datetime({ offset: true })` para ambos (R7), sin valores por defecto. La comparación es `turno.inicio.getTime() >= desde.getTime() && turno.inicio.getTime() < hasta.getTime()`: no se usa `enZonaConsultorio()` ni se construyen fechas locales, porque `shared/` no ofrece el helper inverso y el dominio no debe hacer aritmética de zona (R8, DD-08).

`desde >= hasta` se detecta en un `superRefine` con un `issue` sobre `hasta`, igual que `rutas-agenda.ts:70-76`, para que el `400` traiga el campo.

**Convención para C-07:** `GET /api/agenda` debería heredar la misma forma —`desde`/`hasta` ISO 8601 con offset, obligatorios y comparados como instantes—. Si C-07 necesita aceptar fechas locales (`2026-11-23`), el parseo debe resolverse en `shared/` con EP; no conviene duplicar dos convenciones de fecha entre módulos.

*Alternativa descartada:* aceptar `YYYY-MM-DD` y resolver el día en `APP_TZ`. Es más cómodo para el front, pero exige el helper inverso que `shared/` no tiene y abre diferencias de borde entre módulos.

### D4 — Intervalo semiabierto `[desde, hasta)` sobre `turno.inicio`

Se filtra por `inicio`, no por solapamiento. Es coherente con `[inicio, fin)` de la agenda (RN-AG-04) y con el índice `(profesionalId, inicio)` de la KB (`04_modelo_de_datos.md:67`), y evita que un turno se cuente en dos períodos consecutivos: el que empieza exactamente en `hasta` pertenece al período siguiente.

*Alternativa descartada:* contar turnos que se solapan con el período. Un turno que empieza antes de `desde` y termina dentro se contaría en dos períodos, y el total dependería de cómo se cortan los rangos.

### D5 — Respuesta mínima `200 {"total": number}`

Es lo mínimo que satisface RN-GA-01 y todos los tests de la ficha. No se devuelve la lista de turnos ni un desglose: expone menos datos y evita que el front dependa de un contrato que después cuesta cambiar. Un período sin atendidos devuelve `200 {"total":0}`, nunca `404`: el profesional existe y el período es válido, solo está vacío.

*Alternativa descartada:* devolver `{ total, turnos: [...] }`. Duplica datos que C-07 ya expone y amplía la superficie confidencial sin necesidad.

### D6 — `:id` ajeno o inexistente → `403 SIN_PERMISO` (propiedad primero)

Se comprueba `sesion.profesionalId === id` antes de mirar si el profesional existe. Si no coincide, se lanza `SinPermisoError` sin consultar el repositorio de profesionales. Así un `:id` inexistente responde igual que uno ajeno y no se puede sondear qué ids existen.

Esto difiere de `horarios.ts:18-20`, que responde `404` antes del `403` (R4): allí se direcciona un recurso (los horarios de un profesional) y el 404 describe el recurso; acá se direcciona un dueño y el 403 describe el permiso. La diferencia se documenta para que no se lea como inconsistencia.

*Alternativa descartada:* `404` para un id inexistente. Filtra información sobre qué profesionales existen y obliga a una consulta extra antes de autorizar.

### D7 — Autorización en dos capas

1. **Borde:** `requireRol('profesional')` en `preHandler`. La recepcionista y el paciente reciben `403` sin llegar al caso de uso.
2. **Caso de uso:** `calcularGanancias` verifica `sesion.profesionalId === profesionalId` y lanza `SinPermisoError`. Cubre a otro profesional y protege al caso de uso si algún día lo llama otro transporte.

No se confía en `sinPrecioPara`: el serializador solo quita `precio` y `precioAlReservar`, no un campo `total` (R5). El test con Bruno (segundo profesional) es obligatorio porque `requireRol('profesional')` por sí solo lo dejaría pasar.

*Alternativa descartada:* autorizar solo en el caso de uso o solo con `requireRol`. Una sola capa deja el control a merced de que el próximo caller recuerde repetirlo.

### D8 — Suma en centavos

`sumarGanancias` redondea cada precio a centavos (`Math.round(p * 100)`), suma enteros y divide una vez por 100 al final. Evita `35000.300000000003` y hace que `10000.10 + 20000.20` dé exactamente `30000.30`. Es una función pura, sin `Date.now()` ni imports de Fastify o repositorios.

*Alternativa descartada:* sumar `number` directamente. Con dos o tres turnos suele alcanzar, pero el contrato promete dos decimales y el error aparece justo en los tests de borde.

*Trade-off:* un precio con más de dos decimales se redondea al centavo. El dominio ya usa precios en pesos con dos decimales, así que es aceptable y se documenta.

### D9 — Fixtures locales y `AuthPort` propio

`tests/ganancias/fixtures.ts` arma turnos con los profesionales, boxes, prestaciones y pacientes de `SEED`, en días hábiles entre 09:00 y 13:00 (regla dura 8), y los guarda con `repos.turnos.guardar`. Incluye los cinco estados, dos profesionales y precios distintos.

También define un `AuthPort` local que envuelve a `authDeTest` y agrega un token para Bruno. No es duplicación gratuita: `tests/plataforma/helpers.ts` está fuera de `tests/ganancias/` y la regla dura 3 prohíbe editarlo; sin un token para Bruno no se puede testear el `403` de "otro profesional". El wrapper delega los tres tokens existentes, así que el comportamiento de los demás roles no cambia.

*Alternativa descartada:* editar `tests/plataforma/helpers.ts` para agregar a Bruno. Rompe la regla de carpetas y genera conflicto con los otros changes de la ola.

### D10 — Sin `Clock` ni locks; `deps` mínimo

Es una lectura pura con un rango provisto por el cliente: no hay "ahora", no hay escritura y no hay estado que proteger. `calcularGanancias` recibe `deps: Pick<Deps, 'repos'>`, no el `Deps` completo. Si en el futuro se agrega un período por defecto ("este mes"), habrá que inyectar `Clock`; hoy sería una dependencia sin uso.

*Alternativa descartada:* envolver la lectura en `conLockDeAgenda`. Serializa consultas sin proteger ninguna invariante y degrada la agenda sin motivo.

### D11 — Sin UI

El change es 100 % backend: no hay pantalla, componente ni interacción. Se registra `Decision: no (no UI)`; no se crean mockups ni se modifica `design-system/`.

## Contrato HTTP

```
GET /api/profesionales/:id/ganancias?desde=2026-11-01T03:00:00Z&hasta=2026-12-01T03:00:00Z
Authorization: Bearer <token del profesional dueño>

200 { "total": 45000 }
401 { "code": "NO_AUTENTICADO" }
403 { "code": "SIN_PERMISO" }
400 { "code": "FORMATO_INVALIDO", "detalles": [ { "campo": "hasta", "motivo": "..." } ] }
```

- `:id` es el `profesionalId` del dueño; debe coincidir con `sesion.profesionalId`.
- `desde` y `hasta` son obligatorios y usan ISO 8601 con offset. La respuesta exitosa contiene solo `total` (número, dos decimales como máximo).
- No hay `409`: este change no introduce códigos de negocio nuevos (RN-EX-01 no cambia).
- No hay `404` propio de la ruta: un id ajeno o inexistente es `403` (D6); una URL que no existe sigue siendo el `404 NO_ENCONTRADO` global.

## Mapeo escenario → test

| # | Escenario del spec | Test |
|---|---|---|
| 1 | Suma de los turnos atendidos del período | `ganancias.test.ts` · dominio y caso de uso |
| 2 | Período vacío devuelve cero | `ganancias.test.ts` · caso de uso |
| 3 | Solo cuenta los turnos del profesional dueño | `ganancias.test.ts` · caso de uso |
| 4 | Otro profesional no ve las ganancias ajenas | `routes.test.ts` · token de Bruno |
| 5 | La recepcionista no ve ganancias | `routes.test.ts` · token `recep` |
| 6 | El paciente no ve ganancias | `routes.test.ts` · token `pac` |
| 7 | Sin token | `routes.test.ts` · sin `Authorization` |
| 8 | Profesional inexistente | `routes.test.ts` · id desconocido |
| 9 | Ignora cancelados y ausentes | `ganancias.test.ts` · dominio |
| 10 | Ignora reservados y confirmados | `ganancias.test.ts` · dominio |
| 11 | Usa el precio congelado aunque la prestación haya cambiado | `ganancias.test.ts` · caso de uso |
| 12 | Turno que empieza exactamente en `desde` se incluye | `ganancias.test.ts` · dominio |
| 13 | Turno que empieza exactamente en `hasta` se excluye | `ganancias.test.ts` · dominio |
| 14 | Turno que empieza antes de `desde` y termina dentro no se cuenta | `ganancias.test.ts` · dominio |
| 15 | `desde` mayor o igual que `hasta` | `routes.test.ts` · `400` con detalle `hasta` |
| 16 | Falta `desde` o `hasta` | `routes.test.ts` · `400` con detalle del campo |
| 16b | Valor que no es ISO 8601 con offset | `routes.test.ts` · `400` con detalle del campo |
| 17 | Suma con decimales exacta a 2 decimales | `ganancias.test.ts` · dominio puro |
| 18 | La ruta se publica sola bajo `/api` | `routes.test.ts` · `buildApp` sin tocar `app.ts` |

## Gobernanza (ALTO)

El dato es confidencial por rol, así que el change se trata como ALTO:

- El spec y este design se revisan antes de `apply`; cualquier cambio de alcance se anota en `design.md` y en la bitácora.
- Cada rol no dueño tiene su propio test de `403` (otro profesional, recepcionista y paciente) y el `401` sin token.
- La autorización no depende del serializador de precios (R5): se verifica en el borde y en el caso de uso.
- Todos los datos de prueba son ficticios (RN-DA-01): "Paciente Ficticio Uno", documento `00000001` y emails `@example.com`; no se usan nombres, documentos ni teléfonos reales.
- El PR debe declarar que no toca `src/shared/`, `src/app.ts`, `package.json` ni la configuración de Vitest.

## Riesgos / Trade-offs

- **[El cliente puede pedir un rango arbitrariamente grande]** → Es una lectura en memoria y sin lock; en el MVP el costo es aceptable. Si el volumen crece con SQLite, se agrega un límite de rango o paginación en otro change, sin cambiar el contrato de `total`.
- **[`total` no lo protege `sinPrecioPara`]** → Se mitiga con `requireRol` y la verificación de propiedad; el test de recepcionista y paciente verifica el `403`, no el serializador.
- **[Diferencia con `horarios.ts` (404 antes de 403)]** → Es deliberada (D6) y queda documentada; si EP prefiere unificar, se cambia solo el orden en el caso de uso.
- **[Redondeo de precios con más de dos decimales]** → Se redondea al centavo (D8). El dominio usa pesos con dos decimales; si aparecen precios con más precisión, se define la política con EP.
- **[C-02 y C-07 no están mergeados]** → C-08 solo lee: los tests crean sus propios turnos con `repos.turnos.guardar`, así que no dependen de esos changes para pasar.
- **[La convención de fechas podría divergir de C-07]** → Se deja escrita en D3 para que C-07 la herede; si C-07 necesita fechas locales, el helper se resuelve en `shared/` con EP.
- **[El seed no trae turnos]** → Las fixtures los arman; no se modifica `src/shared/seed.ts`.

## Fuera de alcance

- Pantallas de ganancias, gráficos o exportación (C-12 a C-15).
- Totales persistidos, caché o cierres contables.
- Ganancias agregadas de varios profesionales, por prestación, por box o por paciente.
- Impuestos, comisiones y liquidaciones.
- Cambios en la máquina de estados: `atendido` sigue siendo final; la corrección de un atendido (PA-04) no se habilita acá.

## UI Mockups

- Design system revision: no aplica
- Decision: no (no UI) — 2026-11-22
- Preview: no aplica
- Visual verify: no aplica

## Open Questions

- Ninguna que cambie el spec, el enfoque o las tareas. PA-04 quedó confirmada por el usuario (recálculo en vivo). Un eventual límite de rango o un período por defecto se decide en otro change y no altera el contrato actual.
