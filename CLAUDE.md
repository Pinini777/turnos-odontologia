<!-- active-stack:agent-instruction -->
# Turnos Odontología — Instrucciones para Agentes

> Este archivo (y su copia idéntica `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado con `agent-instruction` a partir de `knowledge-base/`, `CHANGES.md` y `.atl/skill-registry.md` (2026-11-22). Lo mantiene solo EP: si cambia, se editan los dos archivos juntos.

Agenda para consultorios odontológicos de 1 a 3 profesionales con recepcionista, en Argentina. Su diferencial: **ningún profesional ni box puede tener turnos superpuestos**, con intervalos `[inicio, fin)`, grilla de 15 minutos y sin sobreturnos. Trabajo Global SDD + Active Stack (UTN FRM), entrega el **25/11/2026 a las 23:00**.

**Contexto del trabajo:** [docs/BIBLIA-PROYECTO.md](docs/BIBLIA-PROYECTO.md) tiene la consigna completa, los criterios de evaluación, las etapas 0 a 7, el ciclo OPSX, Engram, el flujo de GitHub y el checklist final (§17). Consultala antes de decidir algo sobre la entrega o el proceso. Si contradice a la consigna oficial, manda la consigna.

---

## Stack Tecnológico

| Capa | Tecnología | Versión mínima |
|---|---|---|
| Frontend web | React + Vite + TypeScript, con los tokens de `design-system/tokens.css` | React 19, Vite 7 |
| Runtime | Node.js (LTS) | 22.20 |
| Lenguaje | TypeScript (modo `strict`) | 5.x |
| API HTTP | Fastify | 5.x |
| Validación de entrada | Zod | 3.x |
| Tests | Vitest | 3.x |
| Persistencia (MVP) | Repositorios en memoria por defecto; PostgreSQL en Supabase optativo mediante `DATABASE_URL` | PostgreSQL 17 en C-16 |
| Email | Adaptador SMTP (Nodemailer) con un "outbox" en memoria para tests | — |
| Calendario | Link "Agregar a Google Calendar" y archivo `.ics` (RFC 5545), sin OAuth | — |

Monolito modular con arquitectura hexagonal **dentro de cada módulo**: `src/modules/<capability>/{dominio,aplicacion,routes.ts}` y `tests/<capability>/`; lo común vive en `src/shared/` (DD-13).
Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md) y [knowledge-base/08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md).

---

## Base de Conocimiento

La fuente de verdad del dominio vive en `knowledge-base/`. **Leé el archivo relevante ANTES de implementar.**

| Archivo | Cuándo leerlo |
|---|---|
| [README.md](knowledge-base/README.md) | Índice y resumen ejecutivo |
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Propósito, alcance del MVP y lo que queda afuera |
| [02_descripcion_general.md](knowledge-base/02_descripcion_general.md) | Stack, arquitectura y API REST |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Roles, matriz RBAC, rutas públicas |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Entidades, constraints y seeds ficticios |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas `RN-*`. **Empezá por RN-AG** (agenda) y RN-EX-01 (códigos de error) |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Historias US-001 a US-061; US-010 es el change evaluado |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos F-01 a F-07 |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Patrones, estructura por módulo, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md) | Decisiones DD-01 a DD-13 y supuestos SU-01 a SU-04 |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | Inconsistencias, preguntas abiertas y puntos "No evidenciado" |

> En `10_preguntas_abiertas.md` no hay preguntas de prioridad **Alta** sin resolver. Las de prioridad Media (PA-03 a PA-12) tienen un supuesto por defecto en la ficha de cada change de `CHANGES.md`; si EP no responde, se aplica el supuesto y se anota en el `design.md` del change.

Otras fuentes: el informe de Discovery ([docs/discovery/informe-discovery.md](docs/discovery/informe-discovery.md), MVP en la sección D.3), la política visual ([design-system/README.md](design-system/README.md), `system-and-mockups`, revisión 2 aprobada por EP el 2026-11-23) y el flujo de equipo ([CONTRIBUTING.md](CONTRIBUTING.md)).

---

## Skills Disponibles

| Agente | Rol | Skills que carga |
|---|---|---|
| **Backend Core** | Dominio de agenda, casos de uso y rutas Fastify (C-01, C-02, C-03, C-05, C-07, C-08, C-10) | `fastify-best-practices`, `typescript-advanced-types`, `vitest`, `tdd`, `test-driven-development` |
| **Backend Seguridad** | Login, JWT, roles, datos de pacientes y rutas públicas (C-04, C-09, C-11) | `api-security-best-practices`, `fastify-best-practices`, `vitest`, `test-driven-development` |
| **Integraciones** | Email de confirmación y Google Calendar (C-06) | `fastify-best-practices`, `vitest`, `tdd` |
| **Frontend** | `web/` con React + Vite (C-12 a C-15, solo con design system aprobado) | `vercel-react-best-practices`, `vite`, `typescript-advanced-types`, `design-system`, `emil-design-eng`, `frontend-design-deslop` |
| **SDD (ciclo OPSX)** | Explore, propose, apply y archive de cada change | `openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-archive-change`, `openspec-sync-specs`, `openspec-update-change`, `active-delivery` |
| **Fundación** | Contexto, roadmap e instrucciones (solo EP) | `active-orchestrator`, `kb-creator`, `roadmap-generator`, `find-skill`, `skill-registry`, `agent-instruction` |

Cargá la skill correspondiente al contexto ANTES de escribir código. Si una skill no está en tu PC, instalala con Active Stack (modo Full) o con el comando que figura en `.active-orchestrator-state.json` → `skills.install_command`.

> Los compact rules de cada skill los resuelve el orquestador desde [.atl/skill-registry.md](.atl/skill-registry.md) (generado por `skill-registry`; **versionado en el repo**, porque lo pide la consigna). Esta tabla solo mapea skill → rol.

---

## Roadmap de Changes

El plan de implementación completo está en [CHANGES.md](CHANGES.md). Resumen:

- **Total**: 15 changes en 5 fases (0 fundación técnica · 1 núcleo y ola 1 · 2 ganancias y clínica · 3 reprogramación y reserva · 4 interfaz web).
- **Camino crítico de la entrega**: `C-01 fundacion-y-dominio-base → C-02 crear-turno-sin-solapamientos ⭐` (el change evaluado, US-010). MVP backend: `C-01 → C-02 → C-10 → C-11`.
- **Primer change**: `C-01` (`fundacion-y-dominio-base`, EP, CRITICO). Congela dependencias, `src/app.ts` y `src/shared/`; nadie arranca `apply` hasta que esté en `main`.
- **Ola 1** (en paralelo, después de C-01): C-02 EP · C-03 Renzo · C-04 Facundo · C-05 Lautaro · C-06 Lucas · C-07 Agustin; segundos turnos C-08 Agustin y C-09 Facundo.
- **UI** (C-12 a C-15): solo si EP aprueba el design system antes del **lunes 23/11 a las 12:00**; si no, queda fuera de la entrega.

**Antes de iniciar un item**: leé [CHANGES.md](CHANGES.md), verificá que sus dependencias estén `[x]` (mergeadas en `main`), leé los archivos de "Leer antes" y respetá las carpetas de la tabla **Asignación del equipo**.

---

## Reglas Duras (específicas del proyecto)

> Reglas **globales** ya definidas en el archivo global de instrucciones del cliente activo (orquestador OPSX y CLI `openspec` como fuente de verdad, governance por dominio, Engram, design stage): el proyecto las **hereda**, no se repiten acá. Acá viven solo las reglas **específicas de este proyecto** + las universales que el global no cubre.

Revisadas y confirmadas una por una por EP el 2026-11-22. Son contrato: romperlas es un defecto.

### Dominio (agregadas a mano por el equipo)

1. **NUNCA guardar datos reales de pacientes** (nombres, DNI, teléfonos, emails, capturas) en el repositorio, los seeds, los tests, los ejemplos, las capturas ni la memoria del agente → usar siempre datos ficticios, como "Paciente Ficticio Uno", DNI 00000001 o `@example.com` (RN-DA-01).
2. **El recurso se llama box, nunca "sillón"** (si se cita a un proveedor, se aclara su término). **NUNCA crear ni reprogramar turnos superpuestos** por profesional o por box, ni ofrecer sobreturnos ni un parámetro para forzarlos → intervalos `[inicio, fin)`, solo cuentan los turnos no cancelados, y el rechazo es `409 SOLAPAMIENTO_PROFESIONAL` / `SOLAPAMIENTO_BOX` (RN-AG-02 a RN-AG-07).
3. **NUNCA editar archivos fuera de las carpetas del change propio** → cada change escribe solo en `src/modules/<capability>/`, `tests/<capability>/` y `openspec/changes/<change>/`. `src/shared/`, `src/app.ts`, `package.json`, el lockfile, `tsconfig*`, la configuración de lint y Vitest y el arranque de `web/` quedan congelados después de C-01: solo los cambia EP (commit `chore(shared): …`).
4. **NUNCA exponer precios ni ganancias a la recepcionista ni al paciente** → toda respuesta pasa por `sinPrecioPara(rol, …)`; las ganancias solo las ve el profesional dueño y se calculan con `precioAlReservar`, que se congela al reservar (RN-RO-01, RN-RO-02, RN-GA-02).
5. **NUNCA borrar físicamente un turno ni editar la auditoría o la historia clínica** → "eliminar" es cancelar (estado `cancelado`), y cada alta, reprogramación, cancelación o cambio de estado deja un registro append-only (RN-TU-03, RN-TU-05, RN-CL-01).

### Stack (Node + TypeScript + Fastify + Zod + Vitest)

6. **NUNCA usar `any` ni desactivar `strict`**, ni `@ts-ignore` o `@ts-expect-error` sin justificación → TypeScript `strict`, `unknown` + type guards, y `npm run typecheck` en verde antes de cada PR.
7. **NUNCA responder errores de negocio con mensajes sueltos ni códigos inventados** → formato inválido: Zod en el borde → `400`; regla violada: `ReglaDeNegocioError` con un código de RN-EX-01 → `409 {code}`. Un código nuevo se le pide a EP.
8. **NUNCA mergear un change sin un test de Vitest por cada escenario del spec** (feliz, error de negocio y borde) en verde → test que falla primero (TDD); repositorios en memoria y `FixedClock`, sin mocks del dominio; fechas de prueba dentro del horario semilla (lunes a viernes, 09:00–13:00).
9. **NUNCA leer la hora con `Date.now()` o `new Date()` dentro del dominio, ni importar Fastify o repositorios en `dominio/`** → el dominio es puro: la hora llega por `Clock`, la zona por `enZonaConsultorio()` en `APP_TZ`, y los recursos por puertos (DD-08, arquitectura hexagonal).

### Trabajo en equipo (no está en el global)

10. **NUNCA commitear ni pushear a `main` sin el OK de EP** → a `main` solo se llega por PR desde `dev-<alias>`, y lo mergea EP (EP sube directo solo los cierres de la fundación). En tu rama `dev-<alias>` commiteás y pusheás como prefieras; se recomienda `tipo(alcance): descripción` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`). Nunca `engram sync --all`.

---

## Flujo de Trabajo

```
1. Leer la KB relevante (knowledge-base/) y, para la entrega, docs/BIBLIA-PROYECTO.md
2. Identificar el change en CHANGES.md           → dependencias [x], "Leer antes", carpetas propias
3. /sdd-orchestrator → explore → propose          → spec con ≥3 escenarios (feliz, error de negocio, borde); revisar y Ajustar
4. apply con TDD → verify (npm test + npm run typecheck en verde) → archive en tu rama
5. Registrar la decisión en evidencias/bitacora-decisiones.md (tu fila al final, sin borrar las de otros) y abrir el PR con la plantilla
6. EP mergea en las ventanas de 13:00, 19:00 y 23:00 y marca [x] en CHANGES.md
```

Aplicar TODAS las reglas duras en cada paso. Ante conflicto entre la KB y este archivo, las reglas duras prevalecen.
<!-- /active-stack:agent-instruction -->
