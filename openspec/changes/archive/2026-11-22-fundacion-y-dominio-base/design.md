# Design

## Context

Hoy el repo no tiene código: solo documentación, `design-system/` y `openspec/`. Ver `proposal.md` (Why) y `specs/plataforma/spec.md` para los requisitos. Hay tres restricciones que definen el enfoque:

- Seis personas escriben en paralelo. Después de C-01 nadie puede editar `src/app.ts` ni `src/shared/`, así que todo punto de extensión tiene que existir desde hoy.
- El dominio es puro (DD-08 y regla dura 9): sin `Date.now()`, sin Fastify y sin repositorios concretos en `dominio/`.
- Tiene que correr en Windows sin compilación nativa (DD-07): nada de SQLite, y `bcryptjs` en lugar de `bcrypt`.

## Goals / Non-Goals

**Goals:**
- Que un módulo nuevo solo necesite su carpeta: `routes.ts` que se carga solo y dependencias que recibe ya armadas.
- Que cada test arme su API con `buildApp(overrides)` sin estado compartido y con reloj fijo.
- Que RN-RO-01 (sin precios para recepción y paciente) se cumpla aunque un módulo se olvide de aplicarla.

**Non-Goals:**
- Lógica de agenda: solapamientos, grilla, horario y transiciones (C-02, C-03 y C-05).
- Login real y JWT (C-04). C-01 solo define `AuthPort` y un stub que rechaza todo.
- Pantallas web: el arranque de `web/` no muestra nada.
- Persistencia en disco: SQLite queda post-MVP (DD-07).

## Decisions

### D1. Estructura: API en la raíz y `web/` como workspace de npm
Un solo `npm ci` instala todo y un solo lockfile congela las versiones. `npm test` corre `vitest run` en la raíz y después `npm test -w web`. Lo mismo pasa con `typecheck` y `lint`.
*Alternativa:* dos `package.json` independientes. Se descarta porque implica dos lockfiles y dos `npm ci`, y el README de la consigna pide un solo comando.

### D2. TypeScript sin compilar: `tsx` para correr y `tsc --noEmit` para tipar
Se usa ESM (`"type": "module"`) con `moduleResolution: "Bundler"`, así que los imports no llevan la extensión `.js`. `npm start` corre `tsx src/server.ts`, y Vitest ejecuta TypeScript directo.
*Alternativa:* `NodeNext` con build a `dist/`. Se descarta porque obliga a escribir `.js` en cada import (seis personas se van a equivocar) y suma un paso de build que el MVP no necesita.

### D3. Registro de módulos con `@fastify/autoload`
`buildApp` registra autoload sobre `src/modules` con `matchFilter` en `routes.ts`, prefijo `/api` y sin `dirNameRoutePrefix`: cada módulo declara sus rutas completas, por ejemplo `/turnos`. El directorio se puede reemplazar (`overrides.modulesDir`) para que el test de autoload use un módulo de prueba en `tests/plataforma/fixtures/`.
*Plan B, si autoload no detecta TypeScript bajo Vitest o tsx:* el mismo comportamiento con `readdir` más `import()` dinámico, unas 10 líneas en `app.ts`. El contrato del spec no cambia.

**Resultado del spike (apply, 2026-11-22): se aplicó el plan B.** `@fastify/autoload` importa con Node nativo, por fuera de la transformación de Vitest, y falla con los imports de TypeScript sin extensión (`Cannot find module …/src/shared/errores`). `cargarModulos()` en `app.ts` recorre `modulesDir/*/routes.ts` en orden alfabético y registra el `default` de cada uno con prefijo `/api`. Se desinstaló `@fastify/autoload`.

### D4. Dependencias por decorador: `app.deps`
`buildApp(overrides)` arma `Deps = { clock, repos, auth, notificador, disponibilidad, conLockDeAgenda }` combinando los valores por defecto con los overrides, y lo publica con `app.decorate('deps', deps)` antes del autoload. Cada `routes.ts` es un plugin `(app) => {...}` que lee `app.deps` y se los pasa a sus casos de uso. Los casos de uso reciben los puertos por parámetro y nunca importan `app`.
*Alternativa:* un contenedor de inyección de dependencias. Se descarta porque es una dependencia y una abstracción más para algo que un objeto resuelve.

### D5. Sesión aplicada por ruta con el hook `onRoute`
Antes del autoload se registra un hook `onRoute` que agrega un `preHandler` de autenticación a toda ruta cuya URL no sea `/api/health` ni empiece con `/api/public/`. Ese `preHandler` lee `Authorization: Bearer <token>`, llama a `deps.auth.verificar(token)` y deja `request.sesion: UsuarioSesion`, o lanza `NoAutenticadoError`. `requireRol(...roles)` es un `preHandler` que cada ruta agrega y que lanza `SinPermisoError`.
Se usa `onRoute` y no `onRequest` global para que una URL inexistente responda `404` y no `401`.

### D6. Precios ocultos con un hook global y además una función explícita
`sinPrecioPara(rol, valor)` elimina en forma recursiva las claves `precio` y `precioAlReservar` cuando `rol !== 'profesional'`, y no muta el valor original. Además, un hook global `preSerialization` la aplica a toda respuesta con el rol de la sesión. Sin sesión (rutas públicas) se trata como paciente. Así la regla dura 4 se cumple aunque un módulo se olvide de llamarla.
*Alternativa:* que cada ruta la llame a mano. Se descarta porque una sola ruta olvidada filtra precios.

### D7. Errores: clases tipadas y un solo `setErrorHandler`

| Error | HTTP | Cuerpo |
|---|---|---|
| `ZodError`, o validación de Fastify | 400 | `{code:"FORMATO_INVALIDO", detalles:[{campo, motivo}]}` |
| `NoAutenticadoError` | 401 | `{code:"NO_AUTENTICADO"}` |
| `SinPermisoError` | 403 | `{code:"SIN_PERMISO"}` |
| `ReglaDeNegocioError("NO_ENCONTRADO")` | 404 | `{code:"NO_ENCONTRADO"}` |
| `ReglaDeNegocioError(code)` | 409 | `{code}` |
| Cualquier otro | 500 | `{code:"ERROR_INTERNO"}`, y el detalle va solo al log |

`CodigoNegocio` es una unión de literales derivada de un array `as const`, así que un código inventado no compila. El handler de 404 de Fastify responde `NO_ENCONTRADO`. Los códigos HTTP-only (`FORMATO_INVALIDO`, `NO_AUTENTICADO`, `SIN_PERMISO` y `ERROR_INTERNO`) no son de negocio y no entran en `CodigoNegocio`.
`NO_ENCONTRADO` → `404` sigue RN-RE-03 (el turno de otro paciente responde `404`). **Esto se aparta de la ficha de C-01, que mapeaba todo `ReglaDeNegocioError` a `409`, y requiere el OK de EP.**

### D8. Reloj y zona horaria
`Clock = { ahora(): Date }`, con `SystemClock` y `FixedClock(iso)`. `enZonaConsultorio(fecha, tz = APP_TZ)` usa `Intl.DateTimeFormat(...).formatToParts` y devuelve `{diaSemana: 1..7, hhmm: "HH:mm", fecha: "YYYY-MM-DD"}`. `APP_TZ` se lee una vez de `process.env` en `src/shared/config.ts`, con el valor por defecto `America/Argentina/Mendoza`. El dominio solo recibe `Clock` o el resultado del helper, nunca `process.env`.

### D9. Repositorios genéricos en memoria
`Repositorio<T extends {id: string}>` tiene `guardar`, `buscarPorId`, `listar(filtro?)` y `existe`. `RepositorioAppendOnly<T>` tiene solo `agregar` y `listar`, y se usa para `AuditoriaTurno` y `EntradaHistoriaClinica`, que no se modifican ni se borran (regla dura 5). `EnMemoria<T>` guarda los datos en un `Map` y devuelve copias (`structuredClone`) para que nadie mute el estado por referencia. Turnos, pacientes y el resto no tienen `borrar`. Solo `horarios` y `bloqueos` usan `RepositorioConBorrado`, porque la API de `02` tiene `DELETE /bloqueos/:id` y C-03 reemplaza horarios (ajuste hecho durante el apply). Los métodos son `async` desde el principio, para que el adaptador SQLite no cambie las firmas. `crearRepositoriosEnMemoria({seed})` arma un `Repositorios` nuevo por instancia, que es lo que garantiza el aislamiento entre tests.
*Alternativa:* un repositorio específico por entidad, con consultas a medida. Se descarta por ahora: cada módulo filtra con `listar(predicado)` y, si necesita una consulta con índice, la pide como `chore(shared)`.

### D10. Seeds deterministas
Se usan IDs UUID fijos y legibles, exportados como `SEED` (`SEED.profesionales.anaPerez.id`), para que los tests de todos los changes los referencien sin buscarlos. Los `hashPassword` son hashes bcrypt precalculados de las contraseñas de ejemplo de `.env.example`, así que la semilla no gasta tiempo en hashear en cada `buildApp`. Las prestaciones tienen precios de ejemplo en ARS.

### D11. Lock de agenda por instancia
`crearLockDeAgenda()` devuelve `conLockDeAgenda<T>(fn: () => Promise<T>): Promise<T>`, que encadena cada llamada sobre una promesa de cola y libera la cola tanto si `fn` resuelve como si rechaza. Vive en `deps`, así que dos tests no se bloquean entre sí.

### D12. Stubs con dueño en su carpeta
- `src/modules/cuentas/adapter.ts` exporta `authPorDefecto: AuthPort`, que siempre devuelve `null`, o sea `401`.
- `src/modules/notificaciones/adapter.ts` exporta `crearNotificadorEnMemoria()` con su `bandeja`.
- `src/modules/configuracion/disponibilidad.ts` exporta `disponibilidadPermisiva: DisponibilidadPort`, que siempre devuelve `true`.

`app.ts` importa esos tres nombres. Cada change dueño (C-04, C-06 y C-03) reescribe el archivo en su carpeta sin tocar `app.ts`. Ninguna de esas carpetas tiene `routes.ts` todavía.

### D13. `web/` mínimo
Usa Vite 7 + React 19 + `react-router-dom`. `src/main.tsx` importa `../../design-system/tokens.css` y arma el router con `recolectarRutas(import.meta.glob('./pages/*/routes.tsx', {eager: true}))`, donde cada página exporta `routes: RouteObject[]`. Hoy no hay páginas. Un test de Vitest con `jsdom` verifica que `recolectarRutas` combina las rutas de dos módulos falsos.

### D14. Calidad y CI
ESLint usa flat config con `typescript-eslint` `recommended`, y `@typescript-eslint/no-explicit-any` y `ban-ts-comment` en `error` (regla dura 6). El workflow `ci.yml` corre `npm ci`, `typecheck`, `lint` y `test` en una matriz de `ubuntu`, `windows` y `macos` con Node 22, en cada PR y push a `main`. `engines.node` es `>=22.20`.

## Risks / Trade-offs

- [Autoload no reconoce `.ts` bajo Vitest o tsx] → plan B de D3, validado en la primera tarea antes de escribir el resto.
- [`structuredClone` en cada lectura del repo] → con decenas de turnos por día, el costo no importa; evita bugs de aliasing entre casos de uso.
- [El hook `preSerialization` borra un campo `precio` legítimo de otra entidad] → hoy solo `Prestacion` y `Turno` usan esos nombres. Una entidad nueva con un campo `precio` visible para la recepción contradice RN-RO-01 y se discute con EP.
- [Congelar contratos que después resultan incompletos] → los pedidos van como `chore(shared): …` a EP (regla dura 3). Como los puertos son genéricos, no hace falta prever cada consulta.
- [`npm ci` en Windows con rutas largas y espacios (`TERCER ANIO`)] → todas las dependencias son JavaScript puro, sin `node-gyp`. Se verifica en esta PC y en la matriz de CI.

## Migration Plan

No hay nada que migrar: es el primer código del repo. Según lo que eligió EP, se commitea directo a `main`. Después del merge, cada integrante corre `git pull origin main` en su `dev-<alias>`. Si hay que volver atrás, se revierte el commit.

## UI Mockups

- Design system revision: 1
- Decision: no (no UI). `web/` arranca sin pantallas.
- Date: 2026-11-22

## Open Questions

- Los precios de ejemplo de la semilla (montos en ARS) se pueden ajustar después sin cambiar el contrato.
