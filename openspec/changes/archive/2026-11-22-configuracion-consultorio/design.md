# Design

## Context

`C-01` dejó congelados `src/app.ts` y `src/shared/` con el registro automático de `src/modules/*/routes.ts` bajo `/api`, autenticación `onRoute` (excepto `/api/health` y `/api/public/*`), ocultamiento automático de precios en `preSerialization` (`sinPrecioPara`), mapeo global de errores (`400`, `401`, `403`, `404`, `409`), `Repositorios` en memoria con `SEED` ficticio, `enZonaConsultorio()` en `APP_TZ` y el stub `crearDisponibilidad(repos)` en `src/modules/configuracion/disponibilidad.ts`.

`C-03` implementa toda la Épica 1 (`US-001`, `US-002`, `US-003`) dentro de `src/modules/configuracion/` siguiendo arquitectura hexagonal y dominio puro (regla dura 9).

## Goals / Non-Goals

**Goals:**
- Implementar CRUD de profesionales, boxes, prestaciones, horarios de atención y bloqueos respetando RBAC (`profesional` vs `recepcionista` vs ruta pública `/api/public/prestaciones`).
- Garantizar en dominio puro que toda duración de prestación sea `> 0` y múltiplo de 15 (`409 DURACION_INVALIDA`) y que todo horario caiga en grilla de 15 min (`409 FUERA_DE_GRILLA`).
- Reemplazar `src/modules/configuracion/disponibilidad.ts` manteniendo la firma exacta `crearDisponibilidad(repos: Repositorios): DisponibilidadPort` sin tocar `src/app.ts`.
- Cubrir todos los escenarios felices, de error de negocio, de permisos y de borde (`[inicio, fin)`) con tests en Vitest.

**Non-Goals:**
- Detección de solapamientos entre turnos ni creación de turnos (`C-02`).
- Autenticación JWT / emisión de tokens (`C-04`).
- Cálculo de disponibilidad de huecos libres por día para el paciente (`C-11`).
- Pantallas web en `web/` (`C-12` a `C-15`).

## Decisions

### D1. Estructura hexagonal del módulo `src/modules/configuracion/`
Se divide en:
- `dominio/reglas.ts`: funciones puras sin importar Fastify, repositorios concretos ni `Date.now()` / `new Date()`. Contiene validación de duración de prestación (`> 0 && % 15 === 0`), grilla de 15 min para horarios (`HH:mm` con minutos en `00 | 15 | 30 | 45`), evaluación de horario de atención en `APP_TZ` y detección de solapamiento semiabierto `[inicio, fin)` contra bloqueos.
- `aplicacion/{profesionales,boxes,prestaciones,horarios,bloqueos}.ts`: casos de uso que orquestan los puertos de `Repositorios`, `UsuarioSesion` y reglas de dominio.
- `disponibilidad.ts`: exporta `crearDisponibilidad(repos: Repositorios): DisponibilidadPort`, reutilizando las reglas puras del dominio y `enZonaConsultorio`.
- `routes.ts`: plugin Fastify (`export default async function configuracionRoutes(app: FastifyInstance)`) que valida bordes HTTP con Zod 3, aplica `requireRol(...)` y delega en aplicación usando `app.deps`.

### D2. Errores en el borde vs dominio y unicidad de `matricula` / `nombre`
- **Duración de prestación (`US-002`):** Zod valida que `duracionMin` sea un número finito (sin exigir `> 0` ni múltiplo de 15 en Zod) para que duraciones inválidas como `0`, `-15` o `20` entren al dominio y lancen `ReglaDeNegocioError('DURACION_INVALIDA')` → **`409`**.
- **Horarios (`US-003`):** Zod valida formato `HH:mm` válido (`00:00`–`23:59` o `24:00` si aplica; estándar `00:00`–`23:45`/`23:59`), `diaSemana` entero `1..7` y `desde < hasta` → **`400 FORMATO_INVALIDO`**. La pertenencia de `desde` y `hasta` a múltiplos de 15 min se valida en dominio y lanza `ReglaDeNegocioError('FUERA_DE_GRILLA')` → **`409`**.
- **Unicidad de `matricula` (Profesional) y `nombre` (Box):** `src/shared/errores.ts` está congelado tras `C-01` con una lista cerrada de 11 códigos (`CODIGOS_NEGOCIO`) sin un código específico de duplicado. Se decide lanzar `ZodError` con `ZodIssue` custom sobre el campo (`matricula` o `nombre`), que el `setErrorHandler` global convierte en **`400 FORMATO_INVALIDO`** con `detalles: [{ campo, motivo }]`.
  *Alternativa:* frenar `C-03` para pedirle a EP un nuevo código en `src/shared/errores.ts`. Se descarta para no bloquear la ola 1; si EP agrega `RECURSO_DUPLICADO` luego, basta cambiar el lanzamiento en `aplicacion/`.

### D3. Reemplazo de horarios (`D9` de C-01) y autorización (`DD-11`)
- `GET /api/profesionales/:id/horarios`: accesible para `profesional` y `recepcionista`. Si el profesional no existe → `404 NO_ENCONTRADO`.
- `POST /api/profesionales/:id/horarios` con `{ horarios: [{ diaSemana, desde, hasta }] }`:
  1. Solo rol `profesional` (`requireRol('profesional')`).
  2. Si el profesional `:id` no existe → `404 NO_ENCONTRADO`.
  3. Verifica `sesion.profesionalId === id`; si es otro profesional → lanza `SinPermisoError` → **`403 SIN_PERMISO`** (`DD-11` / `PA-02`).
  4. Valida todas las franjas antes de escribir (`desde < hasta` y grilla de 15 min → `409 FUERA_DE_GRILLA`).
  5. Borra los horarios anteriores de ese profesional con `repos.horarios.borrar(h.id)` (disponible gracias a `RepositorioConBorrado` de `C-01`) y guarda los nuevos con `crypto.randomUUID()`.

### D4. Bloqueos (`DD-11`) y lógica real de `DisponibilidadPort`
- **Bloqueos (`GET /api/bloqueos`, `POST /api/bloqueos`, `DELETE /api/bloqueos/:id`):**
  - `POST /api/bloqueos` (solo `profesional`): Zod valida ISO 8601 con zona explícita (`z.string().datetime({ offset: true })`), `inicio < fin`, `motivo` no vacío y **XOR estricto** entre `profesionalId` y `boxId` (ni ambos ni ninguno → `400 FORMATO_INVALIDO`).
  - Autorización según `DD-11`: si es bloqueo de `profesionalId`, verifica que el profesional exista (`404`) y que `sesion.profesionalId === profesionalId` (`403 SIN_PERMISO` si intenta bloquear la agenda de otro profesional). Si es bloqueo de `boxId`, verifica que el box exista (`404`) y lo permite a cualquier `profesional`.
  - `DELETE /api/bloqueos/:id` (solo `profesional`): si no existe → `404 NO_ENCONTRADO`. Si el bloqueo pertenece a un `profesionalId` distinto de `sesion.profesionalId` → `403 SIN_PERMISO`. Si pertenece a un box, cualquier `profesional` puede borrarlo.
  - `GET /api/bloqueos`: accesible para `profesional` y `recepcionista` (soporta filtros opcionales `profesionalId` y `boxId`).
- **Verificación real en `disponibilidad.ts` (`RN-AG-04`, `RN-AG-08`, `RN-AG-09`, `DD-08`):**
  1. **Horario de atención (`FUERA_DE_HORARIO`):** convierte `inicio` y `fin` mediante `enZonaConsultorio(instante)` en `APP_TZ`. Si `inicio >= fin`, o si `inicioZona.fecha !== finZona.fecha` (cruza medianoche en zona del consultorio), o si ninguna franja del profesional para `inicioZona.diaSemana` cubre el intervalo `[inicioZona, finZona]` (`h.desde <= inicioZona.hhmm` y `fin` no excede `h.hasta`, verificando además que si `finZona.hhmm === h.hasta` los segundos/milisegundos sean `0`), retorna `'FUERA_DE_HORARIO'`.
  2. **Bloqueos (`EN_BLOQUEO`):** consulta los bloqueos del `profesionalId` y del `boxId`. Si algún bloqueo `b` satisface el solapamiento de intervalos semiabiertos `inicio.getTime() < b.fin.getTime() && b.inicio.getTime() < fin.getTime()`, retorna `'EN_BLOQUEO'`. Así, un turno `10:00–10:30` con bloqueo `10:30–11:00` **no se superpone** y pasa la validación.
  3. Si supera ambas validaciones, retorna `null`.

### D5. Precio único por prestación (`PA-03`) y congelamiento (`RN-GA-02`)
- Se aplica el supuesto por defecto de `PA-03` (`CHANGES.md`): **un precio único por prestación** (campo `precio` directo en la entidad `Prestacion`, sin tabla por profesional).
- `PATCH /api/prestaciones/:id` actualiza el `precio` de la prestación sin tocar turnos existentes en `repos.turnos`, garantizando que `precioAlReservar` quede congelado (`RN-GA-02`, `DD-05`).
- `GET /api/public/prestaciones` no requiere autenticación y retorna solo prestaciones con `activa === true && reservableOnline === true`; el hook `preSerialization` de `src/app.ts` (y `sinPrecioPara` explícito) garantiza que `precio` nunca se exponga.

### D6. Ajuste del test provisional en `tests/plataforma/shared.test.ts`
- `tests/plataforma/shared.test.ts:170-177` contiene el test `"Disponibilidad provisional: acepta cualquier horario"`, que consulta el stub con `2026-11-22T03:00:00Z` (domingo 00:00 en Mendoza) esperando `null`.
- Al reemplazar el stub por la implementación real de `C-03`, ese test falla con `'FUERA_DE_HORARIO'`. Se actualiza ese test puntual a un lunes dentro del horario semilla (`2026-11-23T12:00:00Z` a `13:00:00Z`, 09:00–10:00 Mendoza) reflejando que `C-03` ya proveyó la implementación real, y se notifica explícitamente a EP en el PR y en `evidencias/bitacora-decisiones.md`. No se toca `openspec/specs/plataforma/spec.md` para evitar conflictos entre PRs de ola 1.

## Risks / Trade-offs

- [Unicidad devuelva `400 FORMATO_INVALIDO` en vez de `409`] → Mitigado documentando en `design.md` y enviando detalle explícito del campo (`matricula` / `nombre`); reversible en 2 líneas si EP agrega `RECURSO_DUPLICADO` en `src/shared/errores.ts`.
- [Tocar `tests/plataforma/shared.test.ts` fuera de `tests/configuracion/`] → Es un ajuste de 3 líneas estrictamente requerido para que `npm test` y el CI pasen tras reemplazar el stub de `disponibilidad.ts`; se avisa a EP explícitamente en el PR.
- [Múltiples franjas horarias en un mismo día al cargar `POST /horarios`] → Aceptado: la evaluación `some(h => ...)` verifica que el turno esté contenido en al menos una franja válida del día.

## Migration Plan

Sin migración de base de datos (persistencia en memoria tras repositorios). Los seeds de `C-01` ya cargan 2 profesionales, 2 boxes, 4 prestaciones y los horarios lun–vie `09:00–13:00` y `15:00–19:00`.

## UI Mockups

- Design system revision: 1
- Decision: no (no UI). `C-03` es únicamente módulo backend HTTP y dominio.
- Date: 2026-11-22

## Open Questions

- `PA-03`: resuelta con supuesto por defecto (un precio único por prestación). Si EP requiere precios por profesional más adelante, se extiende en otro change.
- Código específico para unicidad de `matricula` / `nombre`: hoy mapeado a `400 FORMATO_INVALIDO` (Zod); queda sujeto a confirmación de EP si prefiere un `CodigoNegocio` propio en `shared`.
