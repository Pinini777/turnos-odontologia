# Tasks

> TDD: en cada tarea con lógica, el test se escribe primero y se lo ve fallar. Tests en `tests/plataforma/`.

## 1. Scaffold y dependencias

- [x] 1.1 Crear `package.json` raíz (`type: module`, `engines.node >=22.20`, workspace `web`, scripts `test`, `typecheck`, `lint`, `start`) e instalar las dependencias de la API y lint de la ficha C-01 (sin `@fastify/autoload`, ver D3; `nodemailer` 10 por avisos de seguridad); verificar que `npm ci` desde cero termina sin errores
- [x] 1.2 Crear `tsconfig.json` (`strict`, ESM, `moduleResolution: Bundler`, `noEmit`), `vitest.config.ts` y `eslint.config.js` (D14); verificar con un test trivial que `npm test`, `npm run typecheck` y `npm run lint` corren
- [x] 1.3 Ampliar `.gitignore` con `node_modules/`, `dist/`, `coverage/` y `.atl/.skill-registry.cache.json`; verificar con `git status` que no aparecen

## 2. Arranque de la API y registro de módulos

- [x] 2.1 Spike de D3: `buildApp({modulesDir})` con `@fastify/autoload` sobre un módulo de prueba en `tests/plataforma/fixtures/modules/eco/routes.ts`; verificar el escenario "Un módulo nuevo queda publicado" (si falla bajo Vitest, aplicar el plan B y dejarlo anotado en `design.md`)
- [x] 2.2 `GET /api/health` y handler de 404 `NO_ENCONTRADO`; verificar los escenarios "La API está viva" y "Una ruta inexistente"
- [x] 2.3 `src/server.ts` que lee `PORT` y llama a `buildApp()`; verificar con `npm start` y `GET /api/health` → `200`

## 3. Errores

- [x] 3.1 `src/shared/errores.ts`: `CODIGOS_NEGOCIO as const`, `CodigoNegocio`, `ReglaDeNegocioError`, `NoAutenticadoError`, `SinPermisoError`; verificar el escenario "Lista cerrada de códigos"
- [x] 3.2 `setErrorHandler` con la tabla de D7; verificar los escenarios de 400 `FORMATO_INVALIDO`, 409 `SOLAPAMIENTO_BOX`, 404 `NO_ENCONTRADO` y 500 `ERROR_INTERNO` (sin traza en el cuerpo) con rutas del módulo de prueba

## 4. Reloj y zona

- [x] 4.1 `src/shared/clock.ts` (`Clock`, `SystemClock`, `FixedClock`) y `src/shared/config.ts` (`APP_TZ`); verificar el escenario "Reloj fijo"
- [x] 4.2 `src/shared/zona.ts` con `enZonaConsultorio()`; verificar los escenarios "Instante en UTC" y "Cambio de día por la zona"

## 5. Entidades, repositorios y semilla

- [x] 5.1 `src/shared/entidades.ts` con los tipos de todas las entidades de `04` (estados y orígenes como uniones de literales); verificar con `npm run typecheck`
- [x] 5.2 `src/shared/repositorios.ts`: puertos `Repositorio<T>` y `RepositorioAppendOnly<T>`, `EnMemoria`, `crearRepositoriosEnMemoria()`; verificar con tests que guardar y leer devuelve copias y el escenario "Dos instancias independientes"
- [x] 5.3 `src/shared/seed.ts` con `SEED` determinista y hashes bcrypt precalculados (D10); verificar los escenarios "Contenido de la semilla", "Pacientes y usuarios ficticios" y "Sin contraseñas en claro"

## 6. Sesión, roles y precios

- [x] 6.1 `src/shared/sesion.ts` (`UsuarioSesion`, `AuthPort`, `requireRol`) y hook `onRoute` (D5) en `app.ts`; stub `src/modules/cuentas/adapter.ts`; verificar los escenarios "Sin token", "Rol no permitido", "Rol permitido" (con un `AuthPort` de test) y "Autenticación todavía no implementada"
- [x] 6.2 `src/shared/precios.ts` con `sinPrecioPara()` y hook `preSerialization` (D6); verificar los tres escenarios de "Precios ocultos por rol", incluido uno por HTTP con una ruta de prueba

## 7. Agenda y dependencias provisionales

- [x] 7.1 `src/shared/lock.ts` con `crearLockDeAgenda()`; verificar los escenarios "Dos operaciones simultáneas" y "Una operación falla"
- [x] 7.2 Puertos `Notificador` y `DisponibilidadPort` en `src/shared/` y stubs en `src/modules/notificaciones/adapter.ts` y `src/modules/configuracion/disponibilidad.ts`; `Deps` completo en `app.deps` (D4); verificar los escenarios "Notificación provisional" y "Disponibilidad provisional"

## 8. Web

- [x] 8.1 `web/` con Vite 7, React 19, `react-router-dom`, `tsconfig` y Vitest con `jsdom`; `main.tsx` importa `design-system/tokens.css` y `recolectarRutas()` (D13); verificar el test de `recolectarRutas` y `npm run build -w web`

## 9. Documentación, CI y cierre

- [x] 9.1 `.env.example` con las variables de `08` y valores falsos, y `README.md` (clonar, `npm ci`, `npm test`, `npm start` en Windows, Linux y macOS, y cómo escribir un módulo nuevo); verificar siguiendo el README desde un clon limpio
- [x] 9.2 `.github/workflows/ci.yml` con matriz de tres sistemas operativos (D14); verificar con `npx --yes @action-validator/cli` o, si no está disponible, revisión del YAML, y anotar que la corrida real se ve en el primer push
- [x] 9.3 Verificación integral: `npm ci && npm run typecheck && npm run lint && npm test` en verde, un test por escenario del spec y `grep` sin `any`, `@ts-ignore` ni `Date.now()`/`new Date()` en `src/shared/` fuera de `clock.ts`
- [x] 9.4 Agregar la fila de C-01 al final de `evidencias/bitacora-decisiones.md`; verificar que las filas existentes siguen intactas

## Workflow follow-up

- Archivar el change con `openspec archive fundacion-y-dominio-base` después de la verificación.
- Commit a `main` (lo eligió EP), marcar `[x]` en C-01 de `CHANGES.md` y avisar al equipo que hagan `git pull origin main`.
