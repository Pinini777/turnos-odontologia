# Explore — `cuentas-y-pacientes` (C-04)

- **Change**: `C-04` · `cuentas-y-pacientes` · Capability: `cuentas` · Prioridad: `P1`
- **Responsable**: Facundo · **Historias**: `US-004`, `US-022`, `US-060`
- **Governance**: **CRITICO** (autenticación y datos personales → EP aprueba el spec antes de `apply`)
- **UI**: No aplica (backend puro; `Decision: no (no UI)`)

## 1. Contratos congelados inspeccionados (C-01)

Se revisaron los contratos base vigentes en `turnos-odontologia` (sin modificar ninguno):

- **`src/shared/entidades.ts`**:
  - `Usuario`: `{ id, email, hashPassword, rol: 'profesional' | 'recepcionista' | 'paciente', activo: boolean }`
  - `Paciente`: `{ id, usuarioId?, nombre, apellido, documento, email, telefono?, obraSocial?, plan?, nroAfiliado? }`
  - `Profesional`: `{ id, nombre, matricula, activo, usuarioId }`
- **`src/shared/sesion.ts`**:
  - `UsuarioSesion`: `{ usuarioId, rol, profesionalId?, pacienteId? }`
  - `AuthPort`: `{ verificar(token: string): Promise<UsuarioSesion | null> }`
  - Helpers listos para usar en rutas: `sesionDe(request)`, `requireRol(...roles)`, `esRutaPublica(url)` (`/api/health` y `/api/public/*`).
- **`src/shared/errores.ts`** y **`src/app.ts`**:
  - `ZodError` → `400 { code: "FORMATO_INVALIDO", detalles: [{ campo, motivo }] }`
  - `NoAutenticadoError` → `401 { code: "NO_AUTENTICADO" }`
  - `SinPermisoError` → `403 { code: "SIN_PERMISO" }`
  - `ReglaDeNegocioError('NO_ENCONTRADO')` → `404 { code: "NO_ENCONTRADO" }`
  - `ReglaDeNegocioError(code)` → `409 { code }`
  - Hook `onRoute` aplica `deps.auth.verificar(token)` automáticamente a toda ruta fuera de `/api/health` y `/api/public/*`.
  - Hook `preSerialization` aplica `sinPrecioPara(request.sesion?.rol, payload)`.
- **`src/shared/repositorios.ts`**:
  - `Repositorios` provee `usuarios`, `profesionales` y `pacientes` detrás de `Repositorio<T>` (`guardar`, `buscarPorId`, `listar`, `existe`), sin método `borrar` (cumple D5). Devuelve copias (`structuredClone`).
- **`src/shared/seed.ts`** y **`.env.example`**:
  - Usuarios semilla con hashes `bcryptjs` (cost 10) precalculados y datos 100 % ficticios (RN-DA-01):
    - `profesional@example.com` (`profesional-ejemplo`) → Dra. Ana Pérez (`SEED.profesionales.anaPerez.id`)
    - `profesional2@example.com` (`profesional-ejemplo`) → Dr. Bruno Gómez (`SEED.profesionales.brunoGomez.id`)
    - `recepcion@example.com` (`recepcion-ejemplo`) → rol `recepcionista`
    - `paciente1@example.com` (`paciente-ejemplo`) → vinculado a `SEED.pacientes.uno` (`00000001`)
  - Paciente sin cuenta previa en seed: `SEED.pacientes.dos` (`00000002`, `paciente2@example.com`, `usuarioId` ausente) — listo para probar vinculación PA-10.
- **`src/modules/cuentas/adapter.ts`**:
  - Stub actual `crearAuth(_repos: Repositorios, _clock: Clock): AuthPort` (actualizado por EP en `15466ab`) que retorna siempre `null`.
- **`package.json`**:
  - Dependencias ya instaladas y congeladas: `bcryptjs@3.0.3`, `jose@6.2.18`, `fastify@5.12.8`, `zod@3.25.76`, `vitest@3.2.7`.

## 2. Prerequisito `chore(shared)` resuelto e incorporado (`15466ab`)

Al contrastar el alcance de C-04 contra los archivos congelados se detectaron dos ajustes que caían fuera de las carpetas de C-04; EP los resolvió en `main` mediante `chore(shared)` (`15466ab`), ya incorporado en `dev-facundo`:

1. **Código unificado `DUPLICADO` en `CODIGOS_NEGOCIO`**: `src/shared/errores.ts` incorpora el código único `DUPLICADO` (HTTP `409 {"code":"DUPLICADO"}`) para colisiones de datos únicos (email, documento, matrícula, nombre de box), actualizado en `tests/plataforma/shared.test.ts`, `openspec/specs/plataforma/spec.md` y `RN-EX-01`.
2. **Inyección de `Clock` en `crearAuth`**: `src/app.ts` pasa `crearAuth(repos, clock)` y la firma del stub `src/modules/cuentas/adapter.ts` recibe `(repos: Repositorios, clock: Clock)`, permitiendo verificar la expiración `exp` del JWT con `FixedClock` de forma determinista y sin `Date.now()`/`vi.useFakeTimers()`.

> **Regla operativa**: C-04 **no** edita `src/shared/` ni `src/app.ts`. `15466ab` ya está integrado en `dev-facundo`.

## 3. Análisis de PA-10 (vinculación de paciente preexistente)

En `CHANGES.md` §C-04 se establece el supuesto por defecto para PA-10: alcanza coincidencia de **documento + email** (normalizando `email = email.trim().toLowerCase()` y `documento = documento.trim()`). La matriz completa de decisión para `POST /api/public/pacientes/registro` queda definida sin ambigüedad:

| Estado previo en repositorios | Resultado |
|---|---|
| Existe `Usuario` con el mismo `email` | `409 DUPLICADO` |
| Existe `Paciente` con mismo `documento` y mismo `email`, con `usuarioId === undefined` | **Vincula**: crea `Usuario` (`rol: 'paciente'`), asigna `paciente.usuarioId = usuario.id`, conserva `paciente.id`, actualiza campos opcionales (`telefono`, `obraSocial`, `plan`, `nroAfiliado`) solo si vinieron informados, responde `201 { token, usuario, paciente }` |
| Existe `Paciente` con mismo `documento` y mismo `email`, con `usuarioId !== undefined` | `409 DUPLICADO` |
| Existe `Paciente` con mismo `documento` y distinto `email` | `409 DUPLICADO` |
| Existe `Paciente` con mismo `email` y distinto `documento` | `409 DUPLICADO` |
| No existe ni `Usuario` ni `Paciente` coincidente | **Alta nueva**: crea `Usuario` + `Paciente` con `usuarioId`, responde `201 { token, usuario, paciente }` |

## 4. Decisiones propuestas (pendiente de aprobación de EP; aprobadas por EP el 2026-11-22 con ajustes)

1. **Contrato JWT (`jose` + `Clock`)**:
   - Algoritmo `HS256` con lista blanca estricta `algorithms: ['HS256']` en verificación (RFC 8725).
   - Emisor `iss: 'turnos-odontologia'`.
   - TTL por defecto: **2 horas (`7200` s)** calculado con `clock.ahora()` (`iat`, `exp`) y verificado con `currentDate: clock.ahora()` (vigente en `T + 2h - 1s`, expirado en el instante exacto `T + 2h`).
   - Payload mínimo sin PII: `{ sub: usuario.id, rol: usuario.rol }`.
   - `AuthPort.verificar(token)` valida firma/algoritmo/emisor/expiración, verifica existencia del `Usuario` en `repos.usuarios`, `usuario.activo === true`, `usuario.rol === payload.rol` y resuelve `profesionalId` (si `rol === 'profesional'`) o `pacienteId` (si `rol === 'paciente'`). Ante cualquier falla o vínculo faltante devuelve `null` (→ `401 NO_AUTENTICADO`).
   - `JWT_SECRET` se lee únicamente en `src/modules/cuentas/adapter.ts` (nunca en `dominio/`): si falta `process.env.JWT_SECRET` fuera de producción, genera una clave efímera aleatoria por proceso con `crypto.randomBytes(32)` cacheada en memoria (nunca un literal fijo en el código); error explícito si `NODE_ENV === 'production'` y falta el secreto; opción inyectable por parámetro para tests aislados.
2. **Endpoints exactos (7 rutas, criterio YAGNI — sin `GET /api/pacientes/:id`, sin `DELETE`, sin filtros de búsqueda extra)**:
   - `POST /api/public/login` (pública, 3 roles) → `200 { token, usuario }` (sin `hashPassword`); `401 NO_AUTENTICADO` uniforme para email inexistente, usuario inactivo o contraseña incorrecta.
   - `POST /api/public/pacientes/registro` (pública) → `201 { token, usuario, paciente }` (sin `hashPassword`).
   - `GET /api/pacientes` (`profesional`, `recepcionista`) → `200 Paciente[]`.
   - `POST /api/pacientes` (`profesional`, `recepcionista`) → `201 Paciente` (`usuarioId` ausente).
   - `PATCH /api/pacientes/:id` (`profesional`, `recepcionista`) → `200 Paciente`; si el paciente tiene `usuarioId` y cambia `email`, sincroniza `usuario.email` validando unicidad en `repos.usuarios` y `repos.pacientes` (excluyendo al propio registro).
   - `GET /api/paciente/datos` (`paciente`) → `200 Paciente` (estrictamente `sesion.pacienteId`).
   - `PATCH /api/paciente/datos` (`paciente`) → `200 Paciente` (estrictamente `sesion.pacienteId`); solo editables `nombre`, `apellido`, `telefono`, `obraSocial`, `plan`, `nroAfiliado` (no permite cambiar `documento`, `email`, `id` ni `usuarioId`).
3. **Contraseñas y personal**:
   - Contraseña de registro: `string` de al menos 8 caracteres y como máximo 72 bytes UTF-8 (`Buffer.byteLength(password, 'utf8') <= 72`, límite de truncado de bcrypt), hasheada con `bcryptjs` (cost 10). `hashPassword` nunca sale en respuestas ni logs.
   - Cuentas de personal (`profesional`, `recepcionista`) provienen exclusivamente de `src/shared/seed.ts` (sin endpoint HTTP de alta de personal).
   - Login y verificación de sesión chequean solo `usuario.activo` (desacoplado de `profesional.activo` que gestiona C-03).
4. **Límites de carpetas**:
   - Código: `src/modules/cuentas/{dominio,aplicacion,adapter.ts,routes.ts}`.
   - Tests: `tests/cuentas/`.
   - Artefactos SDD: `openspec/changes/cuentas-y-pacientes/`.
