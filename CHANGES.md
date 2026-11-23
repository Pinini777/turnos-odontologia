# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **turnos-odontologia** (agenda odontológica sin turnos superpuestos).
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas), con su ciclo OPSX completo.
> **Leer este archivo antes de empezar un item.**
>
> Generado con `roadmap-generator` desde `knowledge-base/` (2026-11-21) y ajustado por EP el 2026-11-22: de 19 a 15 changes; se agregó la gestión de pacientes que faltaba (ver **Revisión contra D.3**); Agustin conduce los changes más simples, y la API vive en `src/` y `tests/` de la raíz, como pide §5.2 de la consigna. Alcance: el MVP de la sección D.3 de `docs/discovery/informe-discovery.md` y el alcance v1.0 de `knowledge-base/01_vision_y_objetivos.md`. Lo mantiene solo el líder (EP).

---

## Cómo usar este documento

1. Buscá tu change en la tabla **Asignación del equipo** y fijate que todas sus **Dependencias** figuren `[x]` en este archivo, o sea, mergeadas en `main`. Nunca partas de la rama de un compañero.
2. Leé los docs de la knowledge-base que figuran en "Leer antes" y las preguntas abiertas que marca el change.
3. Acordá el alcance con `/sdd-orchestrator`: explore → propose. **Ajustá** el spec antes de aprobarlo (mínimo 3 escenarios: feliz, error de negocio y borde). En los changes **CRITICO**, EP aprueba el spec antes de `apply`. En los de **UI**, además, EP aprueba el mockup.
4. Implementá solo dentro de tus **Carpetas**, corré los tests (todos en verde), archivá el change en tu rama y abrí el PR `dev-<alias>` → `main` con la plantilla.
5. EP mergea y marca el checkbox `[x]` en este archivo. Nadie más lo edita.

Conservá los IDs de las fichas al editar o reordenar. No hay ClickUp: el estado operativo vive en este archivo.

---

## Árbol de dependencias

```
C-01 fundacion-y-dominio-base               (EP)  ← contratos congelados: desbloquea TODO lo demás
  │
  ├── C-02 crear-turno-sin-solapamientos ⭐  (EP)  ← change evaluado (etapa 6)
  │     └── C-10 reprogramar-turno                ← + C-05
  │           └── C-11 reserva-y-autogestion-paciente  ← + C-03 + C-04 + C-06
  │
  ├── C-03 configuracion-consultorio
  ├── C-04 cuentas-y-pacientes
  │     └── C-12 web-base                         ← + design system aprobado
  │           ├── C-13 web-recepcion              ← + C-02 + C-05 + C-07 + C-10
  │           ├── C-14 web-paciente               ← + C-11
  │           └── C-15 web-profesional            ← + C-03 + C-07 + C-08 + C-09
  ├── C-05 cancelar-y-cambiar-estado
  ├── C-06 email-confirmacion-gcal
  ├── C-07 agenda-y-auditoria
  ├── C-08 ganancias-profesional
  └── C-09 historia-clinica-y-odontograma
```

**Por qué casi todo cuelga de C-01 y no de C-04 (auth) ni de C-03 (catálogo):** C-01 congela los contratos que usa todo el equipo: entidades, códigos de error, `Clock`, puertos de repositorio con implementación en memoria y **seeds ficticios**, el contrato de sesión (`UsuarioSesion` + `requireRol`) y tres stubs con dueño (auth que rechaza todo, notificador en memoria y disponibilidad permisiva). Cada módulo se prueba con dependencias inyectadas (`buildApp({ ... })`), sin esperar el login real ni el CRUD del catálogo. Cuando C-03, C-04 o C-06 reemplazan su stub, lo hacen **en su propia carpeta**.

### Paralelismo por fase

> Cada "gate" es un punto de sincronización. Los changes de un mismo gate van en paralelo, cada uno en su carpeta y con su capability.

```
GATE 0: ninguna
  → C-01 fundacion-y-dominio-base           [EP]
    (mientras tanto, el resto hace solo `explore` de su change de la ola 1: lee y no escribe)

GATE 1: C-01 ✓                              ← FORK (6 en paralelo: ola 1)
  → C-02 crear-turno-sin-solapamientos ⭐   [EP]
  → C-03 configuracion-consultorio          [Renzo]
  → C-04 cuentas-y-pacientes                [Facundo]
  → C-05 cancelar-y-cambiar-estado          [Lautaro]
  → C-06 email-confirmacion-gcal            [Lucas]
  → C-07 agenda-y-auditoria                 [Agustin]
  Segundo turno de la misma persona (dependen solo de C-01; cada uno lo toma al mergear el primero):
  → C-08 ganancias-profesional              [Agustin — después de C-07]
  → C-09 historia-clinica-y-odontograma     [Facundo — después de C-04]

GATE 2: C-02 + C-05 ✓
  → C-10 reprogramar-turno                  [Lautaro]

GATE 3: C-03 + C-04 + C-06 + C-10 ✓
  → C-11 reserva-y-autogestion-paciente     [Renzo]

GATE UI-1: C-04 ✓ + design-system/ revisión 1 aprobado por EP + mockup de C-12 aprobado
  → C-12 web-base                           [Lucas]

GATE UI-2: C-12 ✓ + mockup del change aprobado   ← FORK (3 UI en paralelo)
  → C-13 web-recepcion                      [Lautaro — si C-02, C-05, C-07, C-10 ✓]
  → C-14 web-paciente                       [Lucas — si C-11 ✓]
  → C-15 web-profesional                    [Facundo — si C-03, C-07, C-08, C-09 ✓]
```

### Camino crítico (2 changes hasta el change evaluado · 4 hasta el MVP backend)

```
Entrega evaluada:   C-01 → C-02 ⭐
MVP backend:        C-01 → C-02 → C-10 → C-11
MVP con interfaz:   C-01 → C-02 → C-10 → C-11 → C-14*
                    C-01 → C-04 → C-12 → C-14*      (* cualquiera de las dos cierra el MVP)
```

C-02 está en la **posición 2**, la más temprana posible: solo depende de los contratos de C-01. Lo que C-02 no necesita (auth real, catálogo, horarios, email) va en paralelo y no lo frena.

### Plan óptimo con 3 agentes (adaptado al equipo de 6)

> Con 6 personas, cada una funciona como un agente. Cada fila es un paso. Cada persona encadena sus changes en su propia rama y solo espera a otra en los gates marcados.

| Paso | EP | Facundo | Lautaro | Agustin | Renzo | Lucas |
|---|---|---|---|---|---|---|
| 0 · Dom 22 | C-01 | explore C-04 | explore C-05 | explore C-07 | explore C-03 | explore C-06 |
| 1 · Dom 22 noche – Lun 23 | **C-02 ⭐** | C-04 → C-09 | C-05 | C-07 → C-08 | C-03 | C-06 |
| 2 · Lun 23 tarde – Mar 24 mañana | merges + etapa 7 | — (apoya revisión) | C-10 (gate 2) | — (apoya revisión) | C-11 (gate 3) | C-12 (gate UI-1) |
| 3 · Mar 24 tarde | merges + README | C-15 (gate UI-2) | C-13 (gate UI-2) | — | — | C-14 (gate UI-2) |
| 4 · Mié 25 | congelamiento 18:00, checklist §17 | correcciones | correcciones | correcciones | correcciones | correcciones |

### Asignación del equipo

Cada integrante **conduce al menos dos changes** con el agente, de explore a archive, con commits propios. La asignación busca repartir la carga. **Agustin, el de menos experiencia, conduce los dos changes más simples**: consultas de solo lectura (C-07 y C-08), sin stubs para reemplazar, sin lock y sin reglas de zona horaria. Como C-07 es CRITICO, EP revisa su spec antes de `apply`, y eso le sirve de acompañamiento. Los roles de §14 de la BIBLIA (investigación, verificación, QA, comunicación) siguen valiendo para el resto de las etapas. EP puede intercambiar personas sin cambiar el plan, siempre que cada uno siga siendo dueño de sus carpetas.

| Ola | Persona | Change | Capability (`openspec/specs/…`) | Carpetas que puede tocar |
|---|---|---|---|---|
| 0 | EP | C-01 fundacion-y-dominio-base | `plataforma` | raíz (`package.json`, lockfile, `tsconfig*`, lint, `README.md`, `.env.example`, `.github/workflows/`), `src/app.ts`, `src/server.ts`, `src/shared/`, `tests/plataforma/`, arranque de `web/`, stubs en `src/modules/{cuentas,notificaciones,configuracion}/` |
| 1 | EP | **C-02 crear-turno-sin-solapamientos ⭐** | `turnos-alta` | `src/modules/turnos-alta/`, `tests/turnos-alta/` |
| 1 | Renzo | C-03 configuracion-consultorio | `configuracion` | `src/modules/configuracion/`, `tests/configuracion/` |
| 1 | Facundo | C-04 cuentas-y-pacientes | `cuentas` | `src/modules/cuentas/`, `tests/cuentas/` |
| 1 | Lautaro | C-05 cancelar-y-cambiar-estado | `turnos-estados` | `src/modules/turnos-estados/`, `tests/turnos-estados/` |
| 1 | Lucas | C-06 email-confirmacion-gcal | `notificaciones` | `src/modules/notificaciones/`, `tests/notificaciones/` |
| 1 | Agustin | C-07 agenda-y-auditoria | `agenda` | `src/modules/agenda/`, `tests/agenda/` |
| 1 (2.º turno) | Agustin | C-08 ganancias-profesional | `ganancias` | `src/modules/ganancias/`, `tests/ganancias/` |
| 1 (2.º turno) | Facundo | C-09 historia-clinica-y-odontograma | `clinica` | `src/modules/clinica/`, `tests/clinica/` |
| 2 | Lautaro | C-10 reprogramar-turno | `turnos-reprogramacion` | `src/modules/turnos-reprogramacion/`, `tests/turnos-reprogramacion/` |
| 3 | Renzo | C-11 reserva-y-autogestion-paciente | `reserva-online` | `src/modules/reserva-online/`, `tests/reserva-online/` |
| UI | Lucas | C-12 web-base | `web-base` | `web/src/base/` |
| UI | Lautaro | C-13 web-recepcion | `web-recepcion` | `web/src/pages/recepcion/` |
| UI | Lucas | C-14 web-paciente | `web-paciente` | `web/src/pages/paciente/` |
| UI | Facundo | C-15 web-profesional | `web-profesional` | `web/src/pages/profesional/` |

Además, cada change escribe en `openspec/changes/<nombre-del-change>/` y, al archivar, en `openspec/specs/<su-capability>/`. Como **ninguna capability se repite**, los archive no chocan.

**Reglas para no pisarse** (detallan la regla 2 de `CONTRIBUTING.md`, "tocá solo los archivos del scope de tu change"):

1. **Archivos congelados después de C-01**: `package.json`, `package-lock.json`, `tsconfig*`, configuración de lint y Vitest, `src/app.ts`, `src/shared/` y el arranque de `web/`. Si necesitás una dependencia, un código de error nuevo o un cambio en un contrato compartido, pedíselo a EP. Él lo sube a `main` en un commit `chore(shared): …` y avisa para que todos hagan `git pull origin main`.
2. **Registro de módulos sin archivo central**: la API carga sola cada `src/modules/<modulo>/routes.ts` (`@fastify/autoload`) y la web, cada `web/src/pages/<area>/routes.tsx` (`import.meta.glob`). Nadie edita un router compartido.
3. **Importar sí, editar no**: un módulo puede importar funciones de otro ya mergeado (C-10 usa la validación de C-02), pero nunca edita archivos fuera de sus carpetas.
4. **Tests con dependencias inyectadas y fechas dentro del horario semilla** (lunes a viernes, 09:00–13:00, reloj fijo con `FixedClock`). Así los tests de un change no se rompen cuando otro reemplaza su stub (por ejemplo, cuando C-03 activa la validación de horario).
5. **Una capability por change**. Si alguien necesita cambiar el spec de otra capability, avisa a EP, que lo pone en la cola detrás del change dueño.
6. **Merges en ventanas fijas**: EP mergea a las 13:00, 19:00 y 23:00 y avisa por el grupo. El que sigue hace `git pull origin main` antes de abrir el PR.

### Plan por día

| Día | Objetivo | Quién | Corte |
|---|---|---|---|
| **Dom 22** | Aprobar este `CHANGES.md`; etapa 5 (find-skill, registry, `AGENTS.md`/`CLAUDE.md`). C-01 mergeado (**GATE 1**). El resto hace `explore` de su change de la ola 1 y configura su git. A la noche, `propose` de la ola 1. | EP · todos | Si C-01 no entra hoy, la ola 1 adelanta `propose` y espera para `apply`. |
| **Lun 23** | Ola 1 en `apply`. **C-02 ⭐ archivado y mergeado** (tests por escenario en verde) en la ventana de las 19:00. Segundos turnos (C-08, C-09). **EP decide el design system antes de las 12:00.** | todos | C-02 en `main` antes de las 23:00. Sin design system aprobado a las 12:00, la UI (C-12 a C-15) queda fuera de la entrega. |
| **Mar 24** | C-10 y C-11 a la mañana. Si hay design system: C-12 a la mañana y C-13/14/15 a la tarde. EP: etapa 7 (Engram) y README reproducible. Grabación del video y reflexión. | todos | Sin mockup aprobado a las 14:00, ese change de UI no arranca. |
| **Mié 25** | **Congelamiento a las 18:00**: solo correcciones. Checklist §17 de la BIBLIA, merge final y entrega **antes de las 23:00**. | EP · todos | Lo que no esté en `main` a las 18:00 queda `[ ]`. |

**Prioridad si falta tiempo**: P0 = C-01 y C-02 (sin esto no hay entrega). P1 = el resto del backend (C-03 a C-11). P2 = la interfaz (C-12 a C-15), que la consigna no exige.

### Revisión contra D.3 (2026-11-22)

Revisión obligatoria de la etapa 4: el roadmap tiene que estar alineado con el MVP de la sección D del informe, sin funciones que el Discovery dejó para después y sin omitir ninguna imprescindible.

| D.3 · Imprescindible | Change | Cumple |
|---|---|---|
| 1. Profesionales, boxes y prestaciones con duración (múltiplos de 15) y precio | C-03 | ✅ |
| 2. Agenda diaria y semanal por profesional y por box, bloques de 15 min | C-07 (API), C-13 (pantalla) | ✅ |
| 3. Crear turno sin solapamientos por profesional y por box, [inicio, fin), sin sobreturnos | **C-02 ⭐** | ✅ |
| 4. Cancelar y reprogramar con las mismas validaciones; el paciente hasta 24 h antes; cancelar no borra | C-05, C-10, C-11 | ✅ |
| 5. Estados del turno y bloqueos (feriados, ausencias, mantenimiento del box) | C-05, C-03 | ✅ |
| 6. Reserva online con email de confirmación y "Agregar a Google Calendar" | C-11, C-04 (cuenta), C-06 | ✅ |
| 7. Ganancias del profesional, visibles solo para él | C-08 | ✅ |
| 8. Historia clínica y odontograma con datos ficticios | C-09 | ✅ |
| 9. Roles con permisos y auditoría de altas, modificaciones y cancelaciones | C-01 (contrato), C-04 (login), C-07 (consulta); se escribe en C-02, C-05 y C-10 | ✅ |

| D.3 · Siguiente ola y etapas posteriores | ¿Aparece en algún change? |
|---|---|
| WhatsApp, lista de espera, recall | No ✅ |
| Exportación de datos y adecuación declarada a la Ley 25.326 | No ✅ (los datos ficticios y el acceso por rol son reglas del MVP, RN-DA; la adecuación formal queda en PA-07) |
| Periodontograma, imágenes, radiografías | No ✅ (C-09 solo hace el odontograma) |
| Presupuestos, caja, cobros, señas, Mercado Pago | No ✅ (C-08 solo calcula ganancias, no cobra) |
| ARCA, obras sociales, ReNaPDiS, firma digital | No ✅ (la obra social es solo un dato informativo del paciente, SU-03) |
| IA, marketing, app móvil, multisucursal, API pública | No ✅ |

**Ajustes aplicados:**
- **Faltaba algo imprescindible: la gestión de pacientes.** Para que la recepción cree un turno (punto 3) para un paciente que llama, ese paciente tiene que existir. La matriz RBAC (`03`) le da a la recepción `C L M` sobre pacientes, y US-022 habla del paciente "cargado antes por la recepción". Sin embargo, ningún change tenía `POST /api/pacientes`. Se agregó a **C-04 `cuentas-y-pacientes`**. También se agregó la historia **US-004** a `knowledge-base/06`, que no la tenía.
- **La interfaz web (C-12 a C-15) no figura en D.3**, pero el Discovery tampoco la dejó para después: viene del alcance v1.0 de `knowledge-base/01` y de DD-09/DD-12. Queda como P2, con gate de design system y corte el lunes 23. No se considera fuera del MVP.
- **Las cuentas del personal** (profesionales y recepcionistas) salen de los seeds. No hay alta de usuarios del personal por pantalla: D.3 no la pide.

### Riesgos

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | EP es cuello de botella: C-01, C-02, revisión de 13 PR y etapas 5 y 7 | La ola 1 arranca tarde y los merges se acumulan | C-01 con contratos y sin lógica; ventanas de merge fijas; el checklist de la plantilla del PR filtra antes de la revisión |
| R2 | C-01 junta el scaffold y el dominio común: es el change más grande de EP y todo lo espera | Si se demora, se demoran los 6 | El scope es mecánico (tipos, Map, seeds); si a las 14:00 del domingo no está, EP mergea primero el scaffold y después los contratos, dentro del mismo change |
| R3 | Conflictos en archivos compartidos (dependencias, lockfile, routers, dominio común) | PRs que no mergean | Archivos congelados (regla 1), autoload por carpeta (regla 2), dependencias instaladas en C-01 |
| R4 | `evidencias/bitacora-decisiones.md` es una sola tabla y, según la plantilla del PR, la editan los 6 al final del archivo | Conflicto de merge cada vez que dos PR agregan su fila | **Decidido por EP (2026-11-22): se mantiene un solo archivo.** Cada uno agrega su fila al final; el conflicto se resuelve en GitHub ("Resolve conflicts") conservando las dos filas. La advertencia está en la bitácora y en la plantilla del PR, y EP revisa que no falte ninguna fila al mergear |
| R5 | El design system sigue sin aprobar (`deferred`) y la política es `system-and-mockups` | La UI (C-12 a C-15) no puede empezar | Gate explícito y corte el lunes 23 a las 12:00; el backend completo no depende de la UI |
| R6 | Un stub reemplazado (horario, auth, email) rompe los tests de otro change | Rojo en `main` después de un merge | Regla 4: dependencias inyectadas y fechas dentro del horario semilla; EP corre `npm test` completo después de cada ventana de merge |
| R7 | Fechas y zona horaria (grilla, horario, regla de 24 h) | Bugs de borde difíciles de ver | `Clock` inyectable y helper de zona `APP_TZ` en C-01 (DD-08); escenarios de borde obligatorios en C-02, C-03 y C-11 |
| R8 | Datos de salud y de pacientes (Leyes 25.326 y 26.529) | Falta grave de la consigna | Seeds y tests 100 % ficticios (RN-DA-01); C-01, C-04 y C-09 son CRITICO: EP aprueba el spec antes de `apply` |
| R9 | Preguntas abiertas PA-03 a PA-10 sin responder | Un change se frena esperando una decisión | Cada ficha indica el supuesto por defecto; si EP no responde, se aplica el supuesto y se anota en `design.md` |
| R10 | Reservas concurrentes del mismo hueco (RN-RE-04) | Dos turnos superpuestos | Lock de agenda en C-01, que usan C-02, C-10 y C-11 |
| R11 | C-11 depende de 4 changes y llega tarde (martes) | El MVP backend se cierra justo | Renzo hace `explore` y `propose` apenas entran C-03, C-04 y C-06; si C-10 se atrasa, la parte de reprogramar del paciente pasa a P2 y queda anotada |
| R12 | Commits con un mail que no es el de la cuenta de GitHub | El aporte individual no cuenta | Verificar `git config user.email` en el paso 0 del domingo |

### Fuera de alcance (post-MVP, no se implementa)

Decidido en D.3 y en `knowledge-base/01`: recordatorios y confirmación por WhatsApp, lista de espera, recall, exportación de datos, presupuestos, caja, cobros y Mercado Pago, facturación ARCA, obras sociales (PUCO, liquidación; la obra social es solo un dato informativo), receta electrónica ReNaPDiS, periodontograma, imágenes y radiografías, firma digital, app móvil, multisucursal, API pública, IA, sincronización OAuth con Google y el adaptador SQLite (DD-07: la persistencia del MVP es en memoria).

---

## FASE 0 — Fundación técnica (solo EP)

> Nadie más arranca `apply` hasta que C-01 esté en `main`. Esta fase congela todo lo que se comparte.

### [C-01] `fundacion-y-dominio-base`
- **Estado**: `[x]` mergeado en `main` (2026-11-22)
- **Responsable**: EP · **Capability**: `plataforma` · **Prioridad**: P0
- **Scope**:
  - **Estructura** (§5.2 de la consigna): la API vive en la raíz (`src/` y `tests/`) y `web/` es un workspace de npm. El `package.json` raíz tiene `npm test`, `npm run typecheck` y `npm run lint`, que corren en los dos. Cada change pone su código en `src/modules/<capability>/` y sus tests en `tests/<capability>/` (DD-13).
  - **Todas las dependencias del MVP instaladas una sola vez**, con versión fija en el lockfile. API: `fastify` 5, `@fastify/autoload`, `zod` 3, `jose` (JWT), `bcryptjs` (hash sin compilación nativa en Windows), `nodemailer`, `typescript` 5, `tsx`, `vitest` 3, `@types/node`, `@types/nodemailer`. Web: `react` 19, `react-dom`, `react-router-dom`, `vite` 7, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`. Lint: `eslint` + `typescript-eslint`.
  - `tsconfig` base con `strict: true` y uno por workspace; Vitest configurado en los dos.
  - `src/app.ts` → `buildApp(overrides)`: registra `@fastify/autoload` sobre `src/modules/*/routes.ts` con prefijo `/api` y mapea `ReglaDeNegocioError` → `409 {code}`, `ZodError` → `400`, no autenticado → `401` y sin permiso → `403`. `GET /api/health` → `200`.
  - `web/`: Vite + React + TS que importa `design-system/tokens.css` y arma las rutas con `import.meta.glob('./pages/*/routes.tsx')`. **Sin pantallas** (no requiere mockup).
  - **Dominio común** en `src/shared/`: tipos de todas las entidades de 04; `ReglaDeNegocioError(code)` con **todos** los códigos de RN-EX-01, más `NO_ENCONTRADO` y `RECURSO_INACTIVO`; `Clock` con `SystemClock` y `FixedClock`; helper `enZonaConsultorio(fecha)` → `{diaSemana, hhmm}` en `APP_TZ` con `Intl`.
  - Puertos de repositorio para todas las entidades, implementación genérica en memoria y **seeds ficticios** de 04 (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1 y 2, cuatro prestaciones, horario lun–vie 09–13 y 15–19, "Paciente Ficticio Uno"…).
  - `conLockDeAgenda(fn)` para validar y guardar un turno de forma atómica (RN-RE-04).
  - Contrato de sesión `UsuarioSesion {usuarioId, rol, profesionalId?, pacienteId?}`, `requireRol(...roles)` y `AuthPort.verificar(token)`. Serializador `sinPrecioPara(rol, objeto)`: la recepcionista y el paciente nunca reciben `precio` ni `precioAlReservar` (RN-RO-01).
  - **Stubs con dueño**, que cada change dueño reemplaza en su carpeta: `modules/cuentas/adapter.ts` (rechaza todo con `401`), `modules/notificaciones/adapter.ts` (outbox en memoria) y `modules/configuracion/disponibilidad.ts` (permisiva).
  - `README.md` base (clonar, `npm ci`, `npm test` en Windows, Linux y macOS), `.env.example` con las variables de 08 y valores falsos, y el workflow `.github/workflows/ci.yml` (`npm ci`, `typecheck`, `test` en cada PR a `main`).
  - Tests: health check, autoload de un módulo de prueba, mapeo 400/401/403/409, seeds sin datos reales, `FixedClock`, serializador sin precio, lock que serializa dos operaciones.
- **Dependencias**: ninguna
- **Governance**: CRITICO (modelo core que todos referencian)
- **Leer antes**:
  - `knowledge-base/02_descripcion_general.md` §Stack tecnológico
  - `knowledge-base/04_modelo_de_datos.md` (todas las entidades y seeds)
  - `knowledge-base/05_reglas_de_negocio.md` §RN-EX-01, §RN-RO, §RN-DA
  - `knowledge-base/08_arquitectura_propuesta.md` §Patrones aplicados, §Estructura de directorios, §Seguridad, §Variables de entorno
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-01, §DD-07, §DD-08, §DD-12

---

## FASE 1 — Núcleo de agenda y ola 1 (6 en paralelo)

> Todos dependen solo de C-01. Ninguno toca la carpeta de otro. C-02 es el change evaluado y tiene prioridad de revisión.

### [C-02] `crear-turno-sin-solapamientos` ⭐
- **Estado**: `[x]` mergeado en `main` (2026-11-22)
- **Responsable**: EP · **Capability**: `turnos-alta` · **Prioridad**: P0 · **Change evaluado de la etapa 6 (US-010)**
- **Scope**:
  - Dominio puro en `turnos-alta/dominio/agenda.ts`: `seSuperponen(a, b)` con intervalos `[inicio, fin)`; `conflictos(turnos, nuevo)`, que ignora los cancelados y devuelve qué recurso choca (profesional, box o ambos); y `validarGrilla(inicio)`.
  - Caso de uso `CrearTurno`: carga la prestación y calcula `fin = inicio + duracionMin`. Valida en este orden: grilla (RN-AG-05), pasado (RN-AG-10), recursos activos, disponibilidad (por el puerto, con stub permisivo hasta C-03) y solapamientos (RN-AG-02/03/04). Dentro de `conLockDeAgenda` guarda el turno `reservado` con `precioAlReservar` y un registro de auditoría `creado`, y avisa al notificador (outbox hasta C-06).
  - `POST /api/turnos` (profesional, recepcionista) → `201` turno (sin precio para la recepcionista) · `409 SOLAPAMIENTO_PROFESIONAL | SOLAPAMIENTO_BOX | FUERA_DE_GRILLA | EN_EL_PASADO | RECURSO_INACTIVO` · `400` formato · `404` recurso inexistente.
  - Sin sobreturnos: no hay ningún parámetro para forzar un turno (RN-AG-07).
  - Tests, por lo menos uno por escenario: feliz; solapamiento de profesional; solapamiento de box; **borde: con un turno 10:00–10:30, uno a las 10:30 se crea** y uno a las 10:15 se rechaza; un turno cancelado no bloquea; fuera de grilla; en el pasado; choque de ambos recursos.
  - `proposal.md` justifica la elección del change en 2 o 3 líneas (consigna).
- **Dependencias**: `C-01`
- **Governance**: MEDIO (lógica de negocio: implementa con checkpoints y muestra decisiones)
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-AG, §RN-TU-02, §RN-TU-05, §RN-RE-04
  - `knowledge-base/06_funcionalidades.md` §US-010
  - `knowledge-base/07_flujos_principales.md` §F-01
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-02, §DD-03, §DD-05

### [C-03] `configuracion-consultorio`
- **Estado**: `[x]` mergeado en `main` (2026-11-22)
- **Responsable**: Renzo · **Capability**: `configuracion` · **Prioridad**: P1 · Épica 1 completa (US-001, US-002, US-003)
- **Scope**:
  - `GET/POST /api/profesionales`, `PATCH /api/profesionales/:id` (alta y desactivación); lo mismo para `/api/boxes` y `/api/prestaciones`. Matrícula y nombre de box únicos.
  - Prestación: si `duracionMin` no es mayor que 0 y múltiplo de 15 → `409 DURACION_INVALIDA`; `precio >= 0`; `reservableOnline`. Cambiar el precio no altera el `precioAlReservar` de los turnos existentes (RN-GA-02).
  - Alta y modificación: solo el profesional. Lectura: la recepcionista, **sin precio**. `GET /api/public/prestaciones`: solo las reservables y sin precio.
  - `GET/POST /api/profesionales/:id/horarios` (cada profesional, solo los suyos: PA-02), `POST /api/bloqueos`, `DELETE /api/bloqueos/:id`. Un bloqueo tiene exactamente uno de `profesionalId` o `boxId`, con `inicio < fin`; los horarios caen en la grilla de 15 min.
  - Reemplaza el stub `disponibilidad.ts` por la implementación real: `FUERA_DE_HORARIO` (RN-AG-09, en `APP_TZ`) y `EN_BLOQUEO` del profesional o del box (RN-AG-08).
  - Tests: CRUD, duración inválida, la recepcionista no ve el precio, horario ajeno `403`, turno fuera de horario, dentro de un bloqueo de profesional y dentro de uno de box; **borde**: un turno que termina justo cuando empieza un bloqueo se acepta.
- **Dependencias**: `C-01`
- **Governance**: MEDIO (afecta las reglas de agenda)
- **Pregunta abierta**: PA-03 (¿precio por profesional?). Supuesto: un precio único por prestación.
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Profesional, §Box, §Prestación, §HorarioAtencion, §BloqueoAgenda
  - `knowledge-base/06_funcionalidades.md` §Épica 1
  - `knowledge-base/05_reglas_de_negocio.md` §RN-AG-06, §RN-AG-08, §RN-AG-09, §RN-RO-01, §RN-GA-02
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-08, §DD-11

### [C-04] `cuentas-y-pacientes`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Facundo · **Capability**: `cuentas` · **Prioridad**: P1 · US-004, US-022, US-060
- **Scope**:
  - `POST /api/public/login` (los tres roles): `bcryptjs` + JWT de corta duración con `jose`, firmado con `JWT_SECRET`. Reemplaza el stub `cuentas/adapter.ts` por la verificación real, que produce `UsuarioSesion` con `profesionalId` o `pacienteId`.
  - `POST /api/public/pacientes/registro`: email único y contraseña con hash. Si la recepción ya había cargado al paciente, se vincula por documento + email (PA-10).
  - **Pacientes**: `GET/POST /api/pacientes`, `PATCH /api/pacientes/:id` (profesional y recepcionista: contacto y obra social informativa; documento y email únicos; sin borrado) y `GET/PATCH /api/paciente/datos` (el paciente, solo los suyos).
  - Usuarios del personal solo por seed: `profesional@example.com` y `recepcion@example.com`, con contraseñas de ejemplo tomadas de variables de entorno documentadas en `.env.example`, nunca reales.
  - Tests: login correcto, contraseña incorrecta `401`, token vencido `401`, email duplicado, vinculación por documento, la recepción da de alta un paciente, un paciente no ve los datos de otro, el hash nunca sale en una respuesta.
- **Dependencias**: `C-01`
- **Governance**: CRITICO (auth y datos personales: EP aprueba el spec antes de `apply`)
- **Pregunta abierta**: PA-10. Supuesto: alcanza documento + email.
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` (completo)
  - `knowledge-base/04_modelo_de_datos.md` §Paciente, §Usuario
  - `knowledge-base/06_funcionalidades.md` §US-004, §US-022, §US-060
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad, §Variables de entorno
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-10

### [C-05] `cancelar-y-cambiar-estado`
- **Estado**: `[x]` mergeado en `main` (2026-11-22)
- **Responsable**: Lautaro · **Capability**: `turnos-estados` · **Prioridad**: P1 · US-011, US-013
- **Scope**:
  - Máquina de estados en `turnos-estados/dominio/estados.ts`: `reservado → confirmado → atendido | ausente` y `reservado | confirmado → cancelado`; son finales `atendido`, `ausente` y `cancelado` (RN-TU-01).
  - `POST /api/turnos/:id/cancelar` → `cancelado`, sin borrado físico (RN-TU-03), con auditoría `cancelado` (quién y cuándo).
  - `POST /api/turnos/:id/estado` → `confirmado | atendido | ausente`, con auditoría `estado_cambiado`; una transición inválida da `409 TRANSICION_INVALIDA`.
  - Tests: cada transición válida, cancelar un turno ya cancelado, atender uno cancelado, auditoría con valores antes y después, el turno sigue existiendo después de cancelarlo.
- **Dependencias**: `C-01` (trabaja sobre turnos semilla, no necesita C-02)
- **Governance**: MEDIO
- **Pregunta abierta**: PA-08 (email al cancelar). Supuesto: en el MVP no se envía.
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-TU
  - `knowledge-base/06_funcionalidades.md` §US-011, §US-013
  - `knowledge-base/07_flujos_principales.md` §F-02
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-04

### [C-06] `email-confirmacion-gcal`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Lucas · **Capability**: `notificaciones` · **Prioridad**: P1 · US-030
- **Scope**:
  - Reemplaza el stub `notificaciones/adapter.ts`: arma el email con fecha, hora, profesional, box y prestación, **sin precio** (RN-NO-03).
  - Link `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…` y función `generarIcs(turno)` (RFC 5545) escrita a mano, sin dependencias nuevas.
  - Transporte SMTP con `nodemailer` (variables `SMTP_*`, `MAIL_FROM`) y outbox en memoria para tests. Si el envío falla, se registra el error y el turno **no se revierte** (RN-NO-02).
  - Tests: contenido del email, sin precio, link con las fechas correctas en UTC, `.ics` válido, un fallo de SMTP no lanza excepción.
- **Dependencias**: `C-01`
- **Governance**: ALTO (notificaciones)
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-NO
  - `knowledge-base/06_funcionalidades.md` §US-030
  - `knowledge-base/07_flujos_principales.md` §F-05
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-06

### [C-07] `agenda-y-auditoria`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Agustin · **Capability**: `agenda` · **Prioridad**: P1 · US-014, US-061
- **Scope**:
  - `GET /api/agenda?desde&hasta&profesionalId&boxId` → turnos del rango (día o semana), con estado, paciente, profesional, box y prestación, ordenados por `inicio`. La recepcionista no recibe precios.
  - `GET /api/turnos/:id/auditoria` → registros append-only del turno (acción, actor, fecha, antes y después), ordenados por fecha; solo para el profesional. Escriben el registro C-02, C-05 y C-10; acá solo se consulta. No existe ninguna ruta para modificarlo ni borrarlo.
  - Tests: filtro por profesional, por box y por rango; incluye cancelados con su estado; recepcionista sin precio; rango inválido `400`; auditoría ordenada; `403` para recepción y paciente.
- **Dependencias**: `C-01`
- **Governance**: CRITICO (expone el audit trail)
- **Pregunta abierta**: PA-09. Supuesto: el profesional ve toda la agenda, pero solo sus ganancias.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-014, §US-061
  - `knowledge-base/04_modelo_de_datos.md` §AuditoriaTurno
  - `knowledge-base/02_descripcion_general.md` §API REST
  - `knowledge-base/05_reglas_de_negocio.md` §RN-TU-05, §RN-RO-01

---

## FASE 2 — Ganancias y clínica (segundo turno de la ola 1)

> Dependen solo de C-01, pero cada persona los toma después de mergear su primer change, para no tener dos PR abiertos a la vez.

### [C-08] `ganancias-profesional`
- **Estado**: `[x]` mergeado en `main` (2026-11-22)
- **Responsable**: Agustin · **Capability**: `ganancias` · **Prioridad**: P1 · US-040
- **Scope**:
  - `GET /api/profesionales/:id/ganancias?desde&hasta` → suma de `precioAlReservar` de los turnos `atendido` del período (RN-GA-01). Se calcula en cada consulta, sin totales guardados (RN-GA-03).
  - Solo el profesional dueño (`sesion.profesionalId === id`). Otro profesional o la recepcionista → `403` (RN-RO-02).
  - Tests: suma solo los atendidos; ignora cancelados y ausentes; usa el precio congelado aunque la prestación haya cambiado; `403` para otro profesional y para recepción; período vacío = 0.
- **Dependencias**: `C-01`
- **Governance**: ALTO (dato confidencial por rol)
- **Pregunta abierta**: PA-04. Supuesto: se recalcula con el estado vigente.
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-GA, §RN-RO-02
  - `knowledge-base/06_funcionalidades.md` §US-040
  - `knowledge-base/07_flujos_principales.md` §F-06
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-05

### [C-09] `historia-clinica-y-odontograma`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Facundo · **Capability**: `clinica` · **Prioridad**: P1 · US-050, US-051
- **Scope**:
  - `GET/POST /api/pacientes/:id/historia`: entradas append-only con autor y fecha; una corrección es una entrada nueva que referencia a la anterior (RN-CL-01).
  - `GET/PUT /api/pacientes/:id/odontograma`: estado de cada pieza en notación FDI (11–48, 51–85), con cara opcional; cada cambio guarda autor y fecha (RN-CL-02).
  - Solo profesionales; la recepcionista y el paciente reciben `403` (RN-RO-03).
  - Tests: alta de una entrada; no existe ruta para modificar una entrada; pieza FDI inválida `400`; `403` por rol; datos 100 % ficticios.
- **Dependencias**: `C-01`
- **Governance**: CRITICO (datos de salud: EP aprueba el spec antes de `apply`)
- **Preguntas abiertas**: PA-06 (detalle del odontograma). Supuesto: pieza + estado, con cara opcional. PA-07 (Leyes 25.326 y 26.529) queda documentada; no se resuelve en el MVP.
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §EntradaHistoriaClinica, §Odontograma y EstadoPieza
  - `knowledge-base/05_reglas_de_negocio.md` §RN-CL, §RN-RO-03, §RN-DA
  - `knowledge-base/06_funcionalidades.md` §US-050, §US-051
  - `knowledge-base/07_flujos_principales.md` §F-07

---

## FASE 3 — Reprogramación y reserva online (gates 2 y 3)

> Estos esperan merges de otros: C-10 necesita C-02 y C-05; C-11 necesita C-03, C-04, C-06 y C-10.

### [C-10] `reprogramar-turno`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Lautaro · **Capability**: `turnos-reprogramacion` · **Prioridad**: P1 · US-012
- **Scope**:
  - `PATCH /api/turnos/:id/reprogramar` (nuevo inicio y, si hace falta, otro profesional o box): recalcula `fin` y reutiliza las validaciones de C-02 **excluyendo al propio turno** (RN-TU-04), dentro de `conLockDeAgenda`.
  - Solo para turnos en `reservado` o `confirmado` (usa la máquina de estados de C-05). Guarda auditoría `reprogramado` con antes y después y reenvía la confirmación por el notificador.
  - Tests: mover a un hueco libre; chocar con otro turno; **borde**: mover 15 min un turno de 10:00–10:30 a 10:15–10:45 no choca consigo mismo; reprogramar un cancelado da `409 TRANSICION_INVALIDA`; el email se reenvía.
- **Dependencias**: `C-02`, `C-05`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-TU-04, §RN-AG
  - `knowledge-base/06_funcionalidades.md` §US-012
  - `knowledge-base/07_flujos_principales.md` §F-02

### [C-11] `reserva-y-autogestion-paciente`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Renzo · **Capability**: `reserva-online` · **Prioridad**: P1 · US-020, US-021
- **Scope**:
  - `GET /api/public/disponibilidad?prestacionId&desde&hasta[&profesionalId]` → huecos libres (horario − bloqueos − turnos activos, para profesional y box, en la grilla de 15 min), solo de prestaciones reservables y sin datos de otros pacientes (RN-RE-01).
  - `POST /api/paciente/turnos` → corre `CrearTurno` (C-02) con `origen = online` y el paciente de la sesión; si el hueco ya se ocupó, `409 SOLAPAMIENTO_*` (RN-RE-04).
  - `GET /api/paciente/turnos` (solo los propios) y `GET /api/paciente/turnos/:id/calendario.ics` (`generarIcs` de C-06). Un turno ajeno da `404` (RN-RE-03).
  - `POST /api/paciente/turnos/:id/cancelar` y `PATCH /api/paciente/turnos/:id/reprogramar`: reutilizan C-05 y C-10 con actor `"paciente"`. Regla de 24 h con `Clock` (RN-RE-02): si `ahora > inicio − 24 h` → `409 PLAZO_VENCIDO`.
  - Tests: disponibilidad sin los huecos ocupados; reserva feliz; dos reservas del mismo hueco (la segunda da `409`); turno de otro paciente `404`; cancelar con 25 h; con 23 h `409`; **borde: exactamente 24 h antes se permite**.
- **Dependencias**: `C-03`, `C-04`, `C-06`, `C-10`
- **Governance**: ALTO (rutas públicas y datos de pacientes)
- **Pregunta abierta**: PA-05. Supuesto: sin máximo de anticipación.
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §RN-RE
  - `knowledge-base/06_funcionalidades.md` §US-020, §US-021
  - `knowledge-base/07_flujos_principales.md` §F-03, §F-04
  - `knowledge-base/03_actores_y_roles.md` §Rutas públicas

---

## FASE 4 — Interfaz web (gate de design system y mockups)

> **Gate obligatorio** (política `system-and-mockups`, DD-09): ningún change de esta fase arranca `apply` hasta que (1) EP apruebe `design-system/` revisión 1 (hoy `Approval: pending`, con la fase `visual-design` en `deferred`) y (2) EP apruebe el mockup HTML del change en `openspec/changes/<change>/mockups/`, renderizado a 390×844 y 1440×900. **Corte: si el design system no está aprobado el lunes 23 a las 12:00, esta fase queda fuera de la entrega.**

### [C-12] `web-base`
- **Estado**: `[x]` mergeado en `main` (2026-11-23)
- **Responsable**: Lucas · **Capability**: `web-base` · **Prioridad**: P2
- **Scope**:
  - `web/src/base/`: layout responsive, componentes compartidos tomados de `design-system/components.html` (botón, campo, tabla, badge de estado, mensaje de error de negocio, estado vacío) y cliente HTTP con el token y manejo de `401/403/409`.
  - Login y registro del paciente contra C-04; menú por rol armado con lo que exporta cada `pages/<area>/routes.tsx`.
  - Mockups: login, registro y layout por rol.
  - Tests: el cliente adjunta el token, un `409` muestra el código de negocio de forma legible, el menú cambia según el rol.
- **Dependencias**: `C-04` + design system aprobado + mockup aprobado
- **Governance**: MEDIO (maneja la sesión en el navegador)
- **Leer antes**:
  - `design-system/README.md`, `design-system/brand.md`, `design-system/tokens.css`
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios, §Seguridad
  - `knowledge-base/09_decisiones_y_supuestos.md` §DD-09, §DD-12
  - `knowledge-base/03_actores_y_roles.md` §RBAC

### [C-13] `web-recepcion`
- **Estado**: `[ ]` pendiente
- **Responsable**: Lautaro · **Capability**: `web-recepcion` · **Prioridad**: P2
- **Scope**:
  - `web/src/pages/recepcion/`: agenda diaria y semanal por profesional y por box; alta de paciente; formulario de nuevo turno con los mensajes `SOLAPAMIENTO_PROFESIONAL` y `SOLAPAMIENTO_BOX`; acciones para cancelar, reprogramar y cambiar el estado. Sin precios.
  - Mockups: agenda, nuevo turno con error de solapamiento y reprogramar.
  - Tests de componentes: el turno contiguo se muestra como válido, el error de solapamiento aparece y no se ve ningún precio.
- **Dependencias**: `C-12`, `C-02`, `C-05`, `C-07`, `C-10` + mockup aprobado
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-010 a §US-014
  - `knowledge-base/07_flujos_principales.md` §F-01, §F-02
  - `design-system/components.html` (agenda por box, formulario de turno)

### [C-14] `web-paciente`
- **Estado**: `[ ]` pendiente
- **Responsable**: Lucas · **Capability**: `web-paciente` · **Prioridad**: P2
- **Scope**:
  - `web/src/pages/paciente/`: elegir prestación, ver huecos libres, reservar, "Mis turnos", cancelar o reprogramar con el aviso de 24 h, botón "Agregar a Google Calendar" y descarga del `.ics`.
  - Mockups: disponibilidad, confirmación y "Mis turnos" con plazo vencido.
  - Tests de componentes: si el hueco ya lo tomó otro (`409`), se ofrece elegir otro; con `PLAZO_VENCIDO`, la acción queda deshabilitada.
- **Dependencias**: `C-12`, `C-11` + mockup aprobado
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §US-020, §US-021, §US-022, §US-030
  - `knowledge-base/07_flujos_principales.md` §F-03, §F-04
  - `design-system/components.html` (tarjeta del turno del paciente)

### [C-15] `web-profesional`
- **Estado**: `[ ]` pendiente
- **Responsable**: Facundo · **Capability**: `web-profesional` · **Prioridad**: P2
- **Scope**:
  - `web/src/pages/profesional/`: catálogo (profesionales, boxes y prestaciones con precio), mis horarios y bloqueos, mis ganancias por período, historia clínica y odontograma del paciente, y auditoría de un turno.
  - Mockups: prestaciones, horarios, ganancias y odontograma.
  - Tests de componentes: una duración que no es múltiplo de 15 muestra `DURACION_INVALIDA`; las ganancias son solo las del profesional logueado.
- **Dependencias**: `C-12`, `C-03`, `C-07`, `C-08`, `C-09` + mockup aprobado
- **Governance**: BAJO
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` §Épica 1, §US-040, §US-050, §US-051, §US-061
  - `knowledge-base/07_flujos_principales.md` §F-06, §F-07
  - `design-system/components.html` (ganancias, tabla)

---

## Resumen

| Fase | Changes | Responsables | Governance |
|---|---|---|---|
| 0 · Fundación técnica | C-01 | EP | CRITICO |
| 1 · Núcleo y ola 1 | C-02 ⭐, C-03, C-04, C-05, C-06, C-07 | EP, Renzo, Facundo, Lautaro, Lucas, Agustin | MEDIO, MEDIO, CRITICO, MEDIO, ALTO, CRITICO |
| 2 · Ganancias y clínica | C-08, C-09 | Agustin, Facundo | ALTO, CRITICO |
| 3 · Reprogramación y reserva | C-10, C-11 | Lautaro, Renzo | MEDIO, ALTO |
| 4 · Interfaz web | C-12, C-13, C-14, C-15 | Lucas, Lautaro, Lucas, Facundo | MEDIO, BAJO, BAJO, BAJO |

**Changes por persona**: EP 2 (C-01, C-02) · Agustin 2 (C-07, C-08, los más simples) · Renzo 2 (C-03, C-11) · Facundo 3 (C-04, C-09, C-15) · Lautaro 3 (C-05, C-10, C-13) · Lucas 3 (C-06, C-12, C-14). Si se corta la UI, todos conservan al menos 2 changes de backend, salvo Lucas, que queda con 1 (C-06).

**Primer item elegible**: `C-01` (`fundacion-y-dominio-base`), de EP.
