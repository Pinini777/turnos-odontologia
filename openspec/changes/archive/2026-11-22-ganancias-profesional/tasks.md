# Tasks

> TDD: en cada tarea primero el test en rojo, después el código mínimo para ponerlo en verde. Repositorios en memoria, sin mocks del dominio. Turnos de prueba en días hábiles, entre 09:00 y 13:00 de Mendoza, con datos 100 % ficticios. Solo se escribe en `src/modules/ganancias/`, `tests/ganancias/` y `openspec/changes/ganancias-profesional/` (regla dura 3).

## 1. Dominio puro

- [x] 1.1 Escribir `tests/ganancias/ganancias.test.ts` con los casos de `sumarGanancias`: suma de tres atendidos del período, ignora `cancelado` y `ausente`, ignora `reservado` y `confirmado`, turno que empieza exactamente en `desde` se incluye, turno que empieza exactamente en `hasta` se excluye, turno que empieza antes de `desde` y termina dentro no se cuenta, y `10000.10 + 20000.20 = 30000.30`. Cubre los escenarios 1, 9, 10, 12, 13, 14 y 17. Verificar que falla porque no existe `src/modules/ganancias/dominio/ganancias.ts`: `npx vitest run tests/ganancias/ganancias.test.ts`.
- [x] 1.2 Implementar `sumarGanancias(turnos, { desde, hasta })` en `src/modules/ganancias/dominio/ganancias.ts`: filtra `estado === 'atendido'` y `[desde, hasta)` sobre `inicio`, suma en centavos con `Math.round(precio * 100)` y divide por 100 al final. Sin imports de Fastify, repositorios, `Date.now()` ni `new Date()`. Cubre los escenarios 1, 9, 10, 12, 13, 14 y 17. Verificar: `npx vitest run tests/ganancias/ganancias.test.ts` en verde.

## 2. Caso de uso

- [x] 2.1 Crear `tests/ganancias/fixtures.ts` con turnos en los cinco estados (`reservado`, `confirmado`, `atendido`, `ausente`, `cancelado`), dos profesionales (Ana y Bruno), precios distintos y un `AuthPort` local que envuelve a `authDeTest` y agrega el token de Bruno. Los turnos usan datos de `SEED` y se guardan con `repos.turnos.guardar`. Verificar que compila: `npm run typecheck`.
- [x] 2.2 Escribir en `tests/ganancias/ganancias.test.ts` los casos de `calcularGanancias` con repositorios en memoria: suma del período (escenario 1), período vacío devuelve `0` (escenario 2), solo cuenta los turnos del profesional dueño (escenario 3) y usa `precioAlReservar` aunque la prestación tenga otro `precio` hoy (escenario 11). Implementar `src/modules/ganancias/aplicacion/calcular-ganancias.ts` con `deps: Pick<Deps, 'repos'>`, leyendo `repos.turnos.listar` y delegando en `sumarGanancias`. Verificar: `npx vitest run tests/ganancias/ganancias.test.ts` en verde.
- [x] 2.3 Agregar al caso de uso el test de propiedad: una sesión de Bruno pidiendo el `profesionalId` de Ana lanza `SinPermisoError` (escenario 4, capa de aplicación). Implementar la comprobación `sesion.profesionalId !== profesionalId → new SinPermisoError()` antes de leer turnos. Verificar: `npx vitest run tests/ganancias/ganancias.test.ts` en verde.

## 3. Rutas HTTP

- [x] 3.1 Escribir `tests/ganancias/routes.test.ts` con `buildApp({ auth: authLocal, repos })` y el camino feliz: `GET /api/profesionales/:id/ganancias?desde=…&hasta=…` responde `200 {"total": …}` y la ruta no da `404`, porque el autoload la publicó bajo `/api` (escenarios 1 y 18). Implementar `src/modules/ganancias/routes.ts` con `export default`, Zod para `params` y `query`, `requireRol('profesional')` y `sesionDe`. Verificar: `npx vitest run tests/ganancias/routes.test.ts` en verde.
- [x] 3.2 Agregar los tests de acceso: sin `Authorization` → `401 NO_AUTENTICADO` (escenario 7); recepcionista → `403 SIN_PERMISO` (escenario 5); paciente → `403 SIN_PERMISO` (escenario 6); otro profesional (Bruno pidiendo a Ana) → `403 SIN_PERMISO` (escenario 4); id inexistente con sesión de Ana → `403 SIN_PERMISO` (escenario 8). Verificar: `npx vitest run tests/ganancias/routes.test.ts` en verde.
- [x] 3.3 Agregar los tests de validación de query: `desde >= hasta` → `400 FORMATO_INVALIDO` con un detalle cuyo campo es `hasta` (escenario 15); falta `desde` o falta `hasta` → `400` con detalle del campo faltante (escenario 16); un valor que no es ISO 8601 con offset → `400`. Implementar el `superRefine` sobre `hasta` y completar el esquema Zod. Verificar: `npx vitest run tests/ganancias/routes.test.ts` en verde.

## 4. Verificación integral

- [x] 4.1 Correr `npm test` y `npm run typecheck` y verificar que están en verde, sin `any`, sin `@ts-ignore` y sin desactivar `strict`. Cubre los 19 escenarios del spec.
- [x] 4.2 Revisar con `git diff --stat main` que solo cambiaron `src/modules/ganancias/`, `tests/ganancias/`, `openspec/changes/ganancias-profesional/` y la fila de bitácora de 4.3. Verificar que no se tocaron `src/shared/`, `src/app.ts`, `package.json`, el lockfile, `tsconfig*` ni la configuración de Vitest.
- [x] 4.3 Comparar cada escenario de `specs/ganancias/spec.md` con al menos un test usando la tabla "Mapeo escenario → test" de `design.md` y verificar que los 19 tienen cobertura (regla dura 8). Registrar el resultado en la fila de C-08 al final de `evidencias/bitacora-decisiones.md` (única escritura fuera de las carpetas del change; la exige el flujo de evidencias de `AGENTS.md` y no se editan filas de otros).

## Workflow follow-up

- Archivar el change en `dev-agustin` con `/opsx:archive` una vez verificado.
- Abrir el PR de `dev-agustin` a `main` con la plantilla, declarando que C-08 no toca archivos compartidos y que el 403 por propiedad se verifica en dos capas.
- EP mergea y marca `[x]` en `CHANGES.md`.
