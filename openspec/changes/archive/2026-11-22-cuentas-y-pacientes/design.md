# Design

## Context

Después de C-01 (`fundacion-y-dominio-base`), los contratos transversales están congelados en `src/shared/` y `src/app.ts` (ver `proposal.md` para la motivación y `specs/cuentas/spec.md` para el contrato observable). C-04 trabaja exclusivamente dentro de `src/modules/cuentas/` y `tests/cuentas/`.

Existen cuatro restricciones que moldean el diseño:

1. **Governance CRITICO**: autenticación y datos personales; EP aprueba este diseño y el spec antes de `apply`.
2. **Dominio puro (regla dura S4 / DD-08)**: `src/modules/cuentas/dominio/` no puede usar `Date.now()`, `new Date()`, `process.env`, Fastify ni repositorios.
3. **Prerequisito `chore(shared)` ya incorporado (`15466ab`)**: EP mergeó en `main` y ya está integrado en `dev-facundo`:
   - `DUPLICADO` en `CODIGOS_NEGOCIO` (`src/shared/errores.ts`, HTTP `409 {"code":"DUPLICADO"}`) como código unificado para colisiones de campos únicos (email, documento, matrícula, nombre de box), actualizado en `tests/plataforma/shared.test.ts`, `openspec/specs/plataforma/spec.md` y `RN-EX-01`.
   - `crearAuth(repos, clock)` en `src/app.ts` y firma actualizada del stub `src/modules/cuentas/adapter.ts`.
4. **Cero dependencias nativas y cero configuración para tests**: se usan `jose` y `bcryptjs` ya instalados en `package.json`, y `npm test` debe correr sin archivo `.env`.

## Goals / Non-Goals

**Goals:**
- Reemplazar el stub `src/modules/cuentas/adapter.ts` con verificación JWT real y determinista usando `Clock` inyectado (`FixedClock` en tests).
- Separar estrictamente reglas puras (`dominio/`), orquestación (`aplicacion/`), criptografía/JWT (`adapter.ts`) y borde HTTP/Zod (`routes.ts`).
- Garantizar aislamiento total entre pacientes (`sesion.pacienteId`) y cero filtración de `hashPassword`.
- Resolver PA-10 de forma explícita y testeable para vincular fichas precargadas por recepción sin perder su `id` ni datos ya registrados.

**Non-Goals:**
- Recuperación de contraseña, refresh tokens, verificación por email o MFA (fuera del MVP).
- Endpoints de alta o baja de cuentas de personal (`profesional` y `recepcionista` vienen solo de `src/shared/seed.ts`).
- Validación de `profesional.activo` en el login/sesión (responsabilidad de C-03 en la agenda; C-04 chequea solo `usuario.activo`).
- Endpoints fuera de las 7 rutas propuestas en D5 (`GET /api/pacientes/:id`, `DELETE /api/pacientes/:id`, filtros de búsqueda o paginación).
- Pantallas web (C-04 no tiene UI).

## Architecture

Arquitectura hexagonal dentro del módulo `src/modules/cuentas/`:

```text
routes.ts (Fastify plugin bajo /api + validación Zod 3 + requireRol)
   │
   ▼
aplicacion/ (casos de uso: login, registro, pacientes; reciben puertos)
   ├──► dominio/ (puro: normalización, proyección UsuarioPublico,
   │              matriz PA-10 y reglas de unicidad sin I/O ni reloj)
   ├──► adapter.ts (implementa AuthPort, EmisorToken JWT con jose + Clock,
   │                HasherPassword con bcryptjs cost 10, lectura de JWT_SECRET)
   └──► Repositorios (src/shared/repositorios.ts: usuarios, pacientes, profesionales)
```

Estructura de archivos de C-04:
- `src/modules/cuentas/dominio/reglas.ts`: `UsuarioPublico`, `normalizarEmail`, `normalizarDocumento`, `aUsuarioPublico`, validaciones puras de unicidad de email y documento (para alta y edición, excluyendo al propio registro).
- `src/modules/cuentas/dominio/vinculacion.ts`: `decidirRegistroPaciente` (matriz PA-10 pura) y merge no destructivo de campos opcionales al vincular.
- `src/modules/cuentas/adapter.ts`: `EmisorToken`, `HasherPassword`, `crearHasherBcrypt()`, `crearEmisorJwt(clock, secret?)`, `crearAuth(repos, clock, opciones?)`.
- `src/modules/cuentas/aplicacion/login.ts`: caso de uso `iniciarSesion`.
- `src/modules/cuentas/aplicacion/registro.ts`: caso de uso `registrarPaciente`.
- `src/modules/cuentas/aplicacion/pacientes.ts`: casos de uso `listarPacientes`, `crearPaciente`, `actualizarPaciente`, `obtenerDatosPropios`, `actualizarDatosPropios`.
- `src/modules/cuentas/routes.ts`: plugin Fastify por defecto con las 7 rutas y esquemas Zod 3.
- `tests/cuentas/`: `dominio.test.ts`, `auth.test.ts`, `login-registro.test.ts`, `pacientes.test.ts`, `rutas.test.ts`.

## Decisions

### D1. Contrato JWT con `jose` y reloj inyectable (`Clock`)
- **Algoritmo**: `HS256` con lista blanca estricta `algorithms: ['HS256']` en `jwtVerify` (RFC 8725).
- **Emisor**: `iss: 'turnos-odontologia'` verificado con `issuer: 'turnos-odontologia'`.
- **Vigencia**: TTL por defecto de **2 horas (`7200` s)**. Al firmar se calculan `iat = Math.floor(clock.ahora().getTime() / 1000)` y `exp = iat + ttlSegundos`. Al verificar se pasa `currentDate: clock.ahora()` a `jwtVerify`, de modo que un token emitido en `T` es aceptado en `T + 2h - 1s` y rechazado (`401 NO_AUTENTICADO`) en el instante exacto `T + 2h`.
- **Payload mínimo sin PII**: `{ sub: usuario.id, rol: usuario.rol }` (no incluye email, DNI ni nombre).
- **Validación en `AuthPort.verificar(token)`**:
  1. Verifica firma, `HS256`, `iss` y `exp` contra `clock.ahora()`.
  2. Busca `usuario` por `payload.sub` en `repos.usuarios`; exige que exista, `usuario.activo === true` y `usuario.rol === payload.rol`.
  3. Resuelve vínculo: si `rol === 'profesional'`, busca el registro en `repos.profesionales` con `usuarioId === usuario.id` (si falta → `null`); si `rol === 'paciente'`, busca en `repos.pacientes` con `usuarioId === usuario.id` (si falta → `null`).
  4. Ante cualquier error de parsing, firma, expiración o consistencia devuelve `null`, que el hook `onRoute` de `src/app.ts` traduce a `401 NO_AUTENTICADO`.
- **Manejo de `JWT_SECRET`**: se lee únicamente en `adapter.ts` (nunca en `dominio/`). Acepta `secret` inyectado por parámetro para tests aislados; si no se pasa, lee `process.env.JWT_SECRET`; si falta o está vacío en `NODE_ENV === 'production'`, lanza un error explícito; fuera de producción, cuando `process.env.JWT_SECRET` no está definido, genera una clave aleatoria de 32 bytes por proceso mediante `crypto.randomBytes(32)` y la cachea en memoria durante la vida del proceso para que firma (login/registro) y verificación (`crearAuth`) compartan la misma clave efímera (nunca un literal fijo en el código).
- *Alternativa descartada*: `jsonwebtoken`, verificación con `Date.now()` / `vi.useFakeTimers()`, o un literal fijo de fallback en código. Se descartan porque `jose` ya está instalado en C-01, soporta `currentDate` nativamente para determinismo con `FixedClock`, y un secreto literal en código es un riesgo de seguridad innecesario frente a `crypto.randomBytes(32)` efímero por proceso.

### D2. Contraseñas con `bcryptjs` (cost 10) y proyección `UsuarioPublico`
- En `POST /api/public/pacientes/registro` la contraseña exige al menos `8` caracteres y como máximo `72` bytes UTF-8 (`Buffer.byteLength(password, 'utf8') <= 72`, ya que bcrypt trunca silenciosamente a partir de los 72 bytes UTF-8 y caracteres multibyte como `ñ` o acentos ocupan más de 1 byte) y se hashea con `bcryptjs.hash(password, 10)`.
- En `POST /api/public/login` se compara con `bcryptjs.compare(password, usuario.hashPassword)`. Tanto usuario inexistente, usuario inactivo como contraseña inválida lanzan el mismo `NoAutenticadoError()` (`401 NO_AUTENTICADO`) para evitar enumeración de cuentas.
- Toda respuesta que devuelve un usuario pasa por `aUsuarioPublico(usuario)` que construye explícitamente `{ id, email, rol, activo }` — nunca destructurando sobre la entidad con riesgo de olvidar excluir `hashPassword`.
- Las cuentas del personal (`profesional@example.com`, `profesional2@example.com`, `recepcion@example.com`) provienen únicamente de `src/shared/seed.ts`.
- *Alternativa descartada*: `bcrypt` nativo (rompe en Windows sin compilación, DD-07) o `scrypt` (los hashes de `src/shared/seed.ts` ya son bcrypt `$2b$10$...`).

### D3. Política de vinculación en registro (supuesto documentado para PA-10)
Siguiendo `CHANGES.md` §C-04 y `AGENTS.md`, se documenta explícitamente el supuesto para **PA-10**: para vincular un paciente ya cargado por recepción al registrarse online alcanza con coincidencia exacta de **`documento` + `email`** tras normalización (`email = email.trim().toLowerCase()`, `documento = documento.trim()`).

Matriz completa evaluada en `dominio/vinculacion.ts`:
1. Existe `Usuario` con el mismo `email` → `ReglaDeNegocioError('DUPLICADO')` (`409`).
2. Existe `Paciente` con mismo `documento` **y** mismo `email` **y** `usuarioId === undefined` → **vincular**: crear `Usuario` (`rol: 'paciente'`), asignar `paciente.usuarioId = usuario.id`, conservar `paciente.id` y actualizar `telefono`, `obraSocial`, `plan`, `nroAfiliado` solo si vinieron provistos en el request (preservando valores existentes en caso contrario).
3. Existe `Paciente` con mismo `documento` **y** mismo `email` **y** `usuarioId !== undefined` → `ReglaDeNegocioError('DUPLICADO')` (`409`).
4. Existe `Paciente` con mismo `documento` **y** distinto `email` → `ReglaDeNegocioError('DUPLICADO')` (`409`).
5. Existe `Paciente` con mismo `email` **y** distinto `documento` → `ReglaDeNegocioError('DUPLICADO')` (`409`).
6. Ninguna coincidencia previa → **alta nueva** de `Usuario` + `Paciente` con `usuarioId`.

*Alternativa descartada*: código de verificación por email antes de vincular. Queda fuera del MVP por simplicidad y falta de flujo de verificación de correo.

### D4. Validación Zod 3 estricta en el borde y autorización por recurso
- Todos los payloads de entrada se parsean una sola vez con Zod 3 en `routes.ts`; los casos de uso reciben datos ya validados y tipados.
- `PATCH /api/paciente/datos` usa un esquema Zod `.strict()` que admite exclusivamente `nombre`, `apellido`, `telefono`, `obraSocial`, `plan` y `nroAfiliado` (todos opcionales). Enviar `documento`, `email`, `id` o `usuarioId` dispara `ZodError` → `400 FORMATO_INVALIDO`. Siempre lee y escribe `sesionDe(request).pacienteId` (nunca un id provisto por el cliente).
- `PATCH /api/pacientes/:id` (roles `profesional`, `recepcionista`) usa un esquema Zod `.strict()` con `nombre`, `apellido`, `documento`, `email`, `telefono`, `obraSocial`, `plan`, `nroAfiliado` (bloqueando `id` y `usuarioId`). Si el paciente tiene `usuarioId` y cambia su `email`, valida unicidad contra `repos.usuarios` (excluyendo `paciente.usuarioId`) y `repos.pacientes` (excluyendo `paciente.id`), y actualiza tanto `paciente.email` como `usuario.email`.
- Identificadores generados para nuevos `Usuario` y `Paciente`: `crypto.randomUUID()` (de `node:crypto`, disponible en Node 22) inyectable en casos de uso si se necesita en tests.

### D5. Superficie mínima de 7 endpoints (YAGNI)
Se implementan exactamente los 7 endpoints definidos en `CHANGES.md` §C-04 (propuesto, pendiente de aprobación de EP; aprobado por EP el 2026-11-22 con ajustes):
- `POST /api/public/login` (pública)
- `POST /api/public/pacientes/registro` (pública)
- `GET /api/pacientes` (`profesional`, `recepcionista`)
- `POST /api/pacientes` (`profesional`, `recepcionista`)
- `PATCH /api/pacientes/:id` (`profesional`, `recepcionista`)
- `GET /api/paciente/datos` (`paciente`)
- `PATCH /api/paciente/datos` (`paciente`)

No se agregan `GET /api/pacientes/:id`, `DELETE /api/pacientes/:id`, ni filtros de búsqueda que nadie pidió. La ausencia de `DELETE` garantiza además D5 (sin borrado físico).

### D6. Aislamiento respecto de `profesional.activo` (C-03)
El login y `AuthPort.verificar` consultan únicamente `usuario.activo`. El estado `profesional.activo` pertenece a la configuración de agenda (C-03) y no se acopla al módulo `cuentas`.

### D7. Serialización de unicidad bajo concurrencia (`conLockDeAgenda`)
Para eliminar la condición de carrera TOCTOU (*time-of-check to time-of-use*) entre la lectura de unicidad y el guardado en operaciones concurrentes (por ejemplo, dos `POST /api/public/pacientes/registro` simultáneos con el mismo email intercalándose durante el `await` de bcrypt, o altas/ediciones concurrentes en `POST /api/pacientes` y `PATCH /api/pacientes/:id`):
- En **`registrarPaciente`**, el hash bcrypt de la contraseña se calcula **antes y fuera** de la sección crítica para no retener el lock compartido durante ~50–80 ms de CPU; luego, dentro de `app.deps.conLockDeAgenda`, se releen `repos.usuarios.listar()` y `repos.pacientes.listar()`, se evalúa `decidirRegistroPaciente` y se persisten `usuario` y `paciente` de forma serializada. La emisión del JWT también queda fuera del lock.
- En **`crearPaciente`** y **`actualizarPaciente`**, la lectura (`buscarPorId` / `listar`), la validación de unicidad (`validarUnicidadPaciente`) y el guardado (`repos.pacientes.guardar` y `repos.usuarios.guardar` al sincronizar email) se ejecutan íntegramente dentro del mismo `app.deps.conLockDeAgenda` inyectado desde `routes.ts`.
- *Alternativa descartada*: calcular bcrypt dentro del lock (bloquearía operaciones concurrentes de agenda y registro innecesariamente) o agregar un segundo lock en `src/shared/` (`src/shared/` está congelado y `conLockDeAgenda` ya provee el serializador del proceso hasta migrar a `BEGIN IMMEDIATE` + índices `UNIQUE` en SQLite).

## Risks / Trade-offs

- [Consistencia entre `repos.usuarios` y `repos.pacientes` sin transacciones ACID en memoria] → En `registrarPaciente`, `crearPaciente` y `actualizarPaciente` la lectura, la validación de unicidad y el guardado se serializan en proceso mediante `conLockDeAgenda` (evitando TOCTOU en el mismo proceso); cuando se migre a SQLite (post-MVP) ambos `guardar` pasan a una transacción `BEGIN IMMEDIATE` con índices `UNIQUE` sin cambiar el contrato de casos de uso.
- [Vinculación PA-10 basada solo en `documento + email` sin verificación de correo] → Supuesto aceptado para el MVP; el atacante necesitaría conocer ambos datos exactos y la ficha no tener cuenta previa. Queda documentado como extensión post-MVP (confirmación por email).
- [Clave efímera `crypto.randomBytes(32)` fuera de producción] → Permite ejecutar `npm test` y desarrollo local sin `.env` ni secretos literales en código; los tokens emitidos sin `JWT_SECRET` expiran al reiniciar el proceso, y en `NODE_ENV === 'production'` el arranque falla rápido si `JWT_SECRET` no está definido o está vacío.
- [Generación de hashes bcrypt en tests] → Con cost 10 cada hash toma ~50–80 ms; los tests unitarios de dominio no llaman a bcrypt (dominio puro) y los tests de rutas usan un conjunto acotado de registros, manteniendo la suite rápida.

## Migration Plan

1. EP mergeó `chore(shared)` (`15466ab`: código unificado `DUPLICADO` y `crearAuth(repos, clock)`) en `main`, ya incorporado en `dev-facundo` vía `git merge --ff-only origin/main`.
2. Verificar línea base `npm run typecheck && npm test` en verde en `dev-facundo` (Task 0.1).
3. Con la aprobación explícita de EP (Governance **CRITICO**, otorgada el 2026-11-22 con ajustes), ejecutar `apply` siguiendo `tasks.md` con TDD estricto.
4. Rollback: al estar todo el código encapsulado en `src/modules/cuentas/` y `tests/cuentas/`, revertir el PR restaura el stub anterior sin afectar a otros módulos.

## UI Mockups

- Design system revision: 1
- Decision: no (no UI). C-04 es un change estrictamente backend.
- Date: 2026-11-22

## Open Questions

Ninguna bloqueante: **PA-10** queda resuelta con el supuesto propuesto en D3 (`documento + email`, aprobado por EP el 2026-11-22).
