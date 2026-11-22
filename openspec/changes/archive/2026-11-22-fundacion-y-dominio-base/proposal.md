# Proposal

## Why

Los seis integrantes del equipo trabajan en paralelo en la ola 1, y todos dependen de los mismos contratos: entidades, códigos de error, reloj, repositorios, sesión y arranque de la API. Si cada uno los define por su cuenta, los PR chocan y los tests se rompen entre sí. C-01 (GATE 1 de `CHANGES.md`) congela esos contratos una sola vez, sin lógica de negocio, para que C-02 a C-09 puedan arrancar `apply` el domingo 22.

## What Changes

- Scaffold del repositorio: `package.json` raíz con workspace `web/`, todas las dependencias del MVP con versión fija en el lockfile, `tsconfig` estricto, ESLint y Vitest, y los scripts `npm test`, `npm run typecheck` y `npm run lint`.
- `src/app.ts` con `buildApp(overrides)`: carga sola cada `src/modules/*/routes.ts` con prefijo `/api`, mapea errores a `400`, `401`, `403` y `409 {code}`, y expone `GET /api/health`. `src/server.ts` arranca el servidor.
- Dominio común congelado en `src/shared/`: tipos de las entidades de `04`, `ReglaDeNegocioError` con los códigos de RN-EX-01 más `NO_ENCONTRADO` y `RECURSO_INACTIVO`, `Clock` (`SystemClock` y `FixedClock`), `enZonaConsultorio()` en `APP_TZ`, puertos de repositorio con implementación en memoria, seeds ficticios, `conLockDeAgenda()`, contrato de sesión (`UsuarioSesion`, `requireRol`, `AuthPort`) y `sinPrecioPara()`.
- Tres stubs con dueño, que reemplaza cada change dueño en su carpeta: autenticación que rechaza todo (`cuentas`, C-04), notificador con outbox en memoria (`notificaciones`, C-06) y disponibilidad permisiva (`configuracion`, C-03).
- Arranque de `web/` con Vite + React + TS, que importa `design-system/tokens.css` y registra rutas por carpeta. Sin pantallas.
- `README.md` reproducible, `.env.example` con valores falsos y CI de GitHub Actions (`npm ci`, `typecheck`, `test`).
- Sin lógica de agenda: la detección de solapamientos es de C-02.

## Capabilities

### New Capabilities
- `plataforma`: contratos transversales de la API que todos los módulos usan: arranque y registro de módulos, formato de errores, salud, sesión y roles, serialización sin precio por rol, reloj y zona del consultorio, repositorios en memoria con seeds ficticios y exclusión mutua de la agenda.

### Modified Capabilities
<!-- Ninguna: openspec/specs/ está vacío. -->

## Impact

- **Código nuevo**: raíz del repo (`package.json`, lockfile, `tsconfig*`, `eslint.config.js`, `vitest.config.ts`, `README.md`, `.env.example`, `.github/workflows/ci.yml`), `src/app.ts`, `src/server.ts`, `src/shared/`, `src/modules/{cuentas,notificaciones,configuracion}/` (solo stubs), `tests/plataforma/` y el arranque de `web/`.
- **Dependencias**: se instalan todas las del MVP. Después de C-01, `package.json`, el lockfile, `tsconfig*`, lint, Vitest, `src/app.ts`, `src/shared/` y el arranque de `web/` quedan congelados (regla dura 3).
- **Equipo**: desbloquea el `apply` de C-02 a C-09. Cualquier contrato que falte después se pide a EP como `chore(shared): …`.
- **Governance**: CRITICO. EP aprueba el spec antes de `apply`.
