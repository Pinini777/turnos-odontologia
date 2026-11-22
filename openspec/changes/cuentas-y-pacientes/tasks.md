# Tasks

> **Governance CRITICO**: NO iniciar `apply` hasta recibir la aprobación explícita de EP sobre el spec y el diseño.
> **TDD estricto**: en cada tarea con lógica, el test se escribe primero (RED), se ve fallar, se implementa lo mínimo (GREEN), se triangula con bordes y se refactoriza. Tests en `tests/cuentas/`, código únicamente en `src/modules/cuentas/`.

## 0. Prerequisito `chore(shared)` y línea base

- [ ] 0.1 Confirmar que `15466ab` (`chore(shared)`: código unificado `DUPLICADO` en `CODIGOS_NEGOCIO` y firma `crearAuth(repos, clock)` en `src/app.ts` y `src/modules/cuentas/adapter.ts`) está incorporado en `dev-facundo` (ya integrado vía `git merge --ff-only origin/main`), contar con la aprobación explícita de EP (Governance CRITICO) y verificar que `npm run typecheck && npm test` corren en verde antes de modificar código

## 1. Dominio puro de cuentas y pacientes (`src/modules/cuentas/dominio/`)

- [ ] 1.1 (TDD) Implementar `normalizarEmail`, `normalizarDocumento`, `aUsuarioPublico` (`UsuarioPublico` sin `hashPassword`) y validaciones puras de unicidad de email/documento (para alta y edición excluyendo al propio registro) en `src/modules/cuentas/dominio/reglas.ts`; verificar con tests unitarios en `tests/cuentas/dominio.test.ts` (sin `Date.now()`, `new Date()`, `process.env`, Fastify ni repositorios)
- [ ] 1.2 (TDD) Implementar la matriz de decisión PA-10 (`decidirRegistroPaciente`) y el merge no destructivo de campos opcionales en `src/modules/cuentas/dominio/vinculacion.ts`; verificar en `tests/cuentas/dominio.test.ts` los 6 casos de PA-10 (nuevo, vinculación preservando `id` y campos previos, email ya usado en `Usuario`, ficha ya vinculada, documento con distinto email, email con distinto documento)

## 2. Adaptador JWT, contraseñas y `AuthPort` (`src/modules/cuentas/adapter.ts`)

- [ ] 2.1 (TDD) Implementar en `src/modules/cuentas/adapter.ts` la resolución segura de `JWT_SECRET` (inyectable para tests, lectura de `process.env.JWT_SECRET`, error explícito en `NODE_ENV === 'production'` si falta, fallback seguro fuera de producción), el emisor JWT con `jose` (`HS256`, `iss: 'turnos-odontologia'`, TTL 7200 s calculado con `Clock`, payload `{ sub, rol }` sin PII) y el hasher `bcryptjs` (cost 10); verificar con tests en `tests/cuentas/auth.test.ts`
- [ ] 2.2 (TDD) Reemplazar el stub `crearAuth(repos, clock, opciones?)` en `src/modules/cuentas/adapter.ts` para verificar firma, algoritmo `HS256` estricto, `iss`, expiración con `currentDate: clock.ahora()`, existencia de `Usuario`, `usuario.activo === true`, `usuario.rol === payload.rol` y resolución de `profesionalId` / `pacienteId`; verificar en `tests/cuentas/auth.test.ts` los escenarios de sesión válida por rol, token vencido con `FixedClock`, token alterado/algoritmo no permitido, usuario desactivado y rol inconsistente o vínculo faltante

## 3. Casos de uso de login y registro (`src/modules/cuentas/aplicacion/`)

- [ ] 3.1 (TDD) Implementar `iniciarSesion` en `src/modules/cuentas/aplicacion/login.ts` normalizando el email, verificando `usuario.activo` y contraseña, devolviendo `{ token, usuario }` sin `hashPassword` y lanzando `NoAutenticadoError` uniforme ante email inexistente, usuario inactivo o contraseña incorrecta; verificar con tests en `tests/cuentas/login-registro.test.ts`
- [ ] 3.2 (TDD) Implementar `registrarPaciente` en `src/modules/cuentas/aplicacion/registro.ts` usando `decidirRegistroPaciente`, hasheando la contraseña con cost 10, emitiendo el token y devolviendo `{ token, usuario, paciente }` sin `hashPassword`; verificar en `tests/cuentas/login-registro.test.ts` paciente nuevo, vinculación con `SEED.pacientes.dos` preservando `id` y campos opcionales, y rechazos `DUPLICADO` (email ya usado, ficha ya vinculada, documento con distinto email y email con distinto documento)

## 4. Casos de uso de pacientes (`src/modules/cuentas/aplicacion/`)

- [ ] 4.1 (TDD) Implementar `listarPacientes`, `crearPaciente` (sin `usuarioId`, validando unicidad en `pacientes` y `usuarios`) y `actualizarPaciente` (validando existencia → `NO_ENCONTRADO`, unicidad excluyendo al propio registro y sincronizando `usuario.email` cuando tiene `usuarioId` y cambia el email) en `src/modules/cuentas/aplicacion/pacientes.ts`; verificar con tests en `tests/cuentas/pacientes.test.ts`
- [ ] 4.2 (TDD) Implementar `obtenerDatosPropios` y `actualizarDatosPropios` en `src/modules/cuentas/aplicacion/pacientes.ts` operando estrictamente sobre `sesion.pacienteId` (solo `nombre`, `apellido`, `telefono`, `obraSocial`, `plan`, `nroAfiliado`); verificar aislamiento entre pacientes y `NO_ENCONTRADO` en `tests/cuentas/pacientes.test.ts`

## 5. Rutas HTTP y validación Zod en el borde (`src/modules/cuentas/routes.ts`)

- [ ] 5.1 (TDD) Crear el plugin Fastify por defecto en `src/modules/cuentas/routes.ts` con las 7 rutas exactas (`POST /public/login`, `POST /public/pacientes/registro`, `GET /pacientes`, `POST /pacientes`, `PATCH /pacientes/:id`, `GET /paciente/datos`, `PATCH /paciente/datos`), esquemas Zod 3 estrictos (`.strict()` en ambos `PATCH`, contraseña 8–72 chars en registro) y `requireRol(...)` por ruta; verificar con `app.inject()` sobre `buildApp(overrides)` (cerrando la app en `afterEach`) en `tests/cuentas/rutas.test.ts`
- [ ] 5.2 Verificar en `tests/cuentas/rutas.test.ts` todos los escenarios HTTP del spec: login con los 3 usuarios semilla de `.env.example`, normalización de email, errores `400 FORMATO_INVALIDO` / `401 NO_AUTENTICADO` / `403 SIN_PERMISO` / `404 NO_ENCONTRADO` / `409 DUPLICADO` (por colisión de email o documento), edición en `PATCH /api/pacientes/:id` conservando el propio email/documento sin falso `409 DUPLICADO`, rechazo de campos restringidos en `PATCH /api/paciente/datos`, sincronización de email en login posterior, ausencia total de `hashPassword` en todas las respuestas y rechazo `404` de `DELETE /api/pacientes/:id`

## 6. Verificación integral y cierre

- [ ] 6.1 Ejecutar `npm run typecheck && npm run lint && npm test` y verificar 100 % en verde con al menos un test por cada escenario de `openspec/changes/cuentas-y-pacientes/specs/cuentas/spec.md`
- [ ] 6.2 Auditar cumplimiento de reglas duras: `git status` muestra cambios únicamente dentro de `src/modules/cuentas/`, `tests/cuentas/` y `openspec/changes/cuentas-y-pacientes/`; cero `any` o `@ts-*`; cero `Date.now()`, `new Date()`, Fastify, repositorios o `process.env` en `src/modules/cuentas/dominio/`; todos los datos de test son 100 % ficticios (`RN-DA-01`)
- [ ] 6.3 Agregar la fila de C-04 al final de `evidencias/bitacora-decisiones.md` al finalizar el `apply` (sin tocar filas ajenas) y preparar el PR desde `dev-facundo` hacia `main`
