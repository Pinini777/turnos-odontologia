# Skill Registry — turnos-odontologia

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

Generado con la skill `skill-registry` (variante `index` de la fundación) el 2026-11-22. Reemplaza al índice que había generado `gentle-ai skill-registry refresh`.
Carpetas escaneadas: `~/.claude/skills/`, `~/.config/opencode/skills/`, `~/.gemini/skills/` (no existen `~/.cursor/skills/`, `~/.copilot/skills/` ni skills de proyecto). Se omiten `sdd-*`, `_shared` y `skill-registry`. Las rutas usan `~` para que sirvan en la PC de cualquier integrante; si una skill no está en tu PC, instalala con Active Stack (modo Full) o con el comando de `.active-orchestrator-state.json` → `skills.install_command`.

## User Skills

### Del stack del proyecto (elegidas en find-skill, 2026-11-22)

| Trigger | Skill | Path |
|---------|-------|------|
| Fastify, servidor Node, API REST, rutas, plugins, `app.ts` | `fastify-best-practices` | `~/.claude/skills/fastify-best-practices/SKILL.md` |
| Escribir tests, mocks, coverage, fixtures con Vitest | `vitest` | `~/.claude/skills/vitest/SKILL.md` |
| Feature o bug test-first, red-green-refactor | `tdd` | `~/.claude/skills/tdd/SKILL.md` |
| Antes de escribir código de implementación de cualquier feature o bugfix | `test-driven-development` | `~/.claude/skills/test-driven-development/SKILL.md` |
| Tipos complejos, genéricos, uniones discriminadas, utilidades de tipos | `typescript-advanced-types` | `~/.claude/skills/typescript-advanced-types/SKILL.md` |
| Componentes React, data fetching, bundle (solo UI: C-12 a C-15) | `vercel-react-best-practices` | `~/.claude/skills/vercel-react-best-practices/SKILL.md` |
| Autenticación, autorización, validación de entrada, JWT, secretos | `api-security-best-practices` | `~/.claude/skills/api-security-best-practices/SKILL.md` |
| `vite.config.ts`, plugins de Vite, `import.meta.glob` | `vite` | `~/.claude/skills/vite/SKILL.md` |

### Flujo SDD y fundación (Active Stack / OpenSpec)

| Trigger | Skill | Path |
|---------|-------|------|
| `/active-orchestrator init`, retomar la fundación | `active-orchestrator` | `~/.claude/skills/active-orchestrator/SKILL.md` |
| Elegir ODD o SDD para una unidad de trabajo | `active-delivery` | `~/.claude/skills/active-delivery/SKILL.md` |
| Publicar o reconciliar CHANGES.md con ClickUp (no se usa: tareas locales) | `active-roadmap` | `~/.claude/skills/active-roadmap/SKILL.md` |
| Generar o actualizar AGENTS.md / CLAUDE.md | `agent-instruction` | `~/.claude/skills/agent-instruction/SKILL.md` |
| Fase discovery de la fundación | `discovery-research` | `~/.claude/skills/discovery-research/SKILL.md` |
| Investigar un competidor desde una URL | `web-scraper` | `~/.claude/skills/web-scraper/SKILL.md` |
| Crear o importar la knowledge base | `kb-creator` | `~/.claude/skills/kb-creator/SKILL.md` |
| Crear o actualizar CHANGES.md | `roadmap-generator` | `~/.claude/skills/roadmap-generator/SKILL.md` |
| Buscar o instalar skills | `find-skill` | `~/.claude/skills/find-skill/SKILL.md` |
| `/openspec-explore`, pensar antes o durante un change | `openspec-explore` | `~/.claude/skills/openspec-explore/SKILL.md` |
| `/openspec-propose`, crear change con todos sus artefactos | `openspec-propose` | `~/.claude/skills/openspec-propose/SKILL.md` |
| `/openspec-apply-change`, implementar las tareas de un change | `openspec-apply-change` | `~/.claude/skills/openspec-apply-change/SKILL.md` |
| `/openspec-archive-change`, cerrar un change | `openspec-archive-change` | `~/.claude/skills/openspec-archive-change/SKILL.md` |
| Sincronizar delta specs sin archivar | `openspec-sync-specs` | `~/.claude/skills/openspec-sync-specs/SKILL.md` |
| Revisar los artefactos de un change ya propuesto | `openspec-update-change` | `~/.claude/skills/openspec-update-change/SKILL.md` |

### Diseño visual (solo si se aprueba el design system)

| Trigger | Skill | Path |
|---------|-------|------|
| Política visual y design system del proyecto | `design-system` | `~/.claude/skills/design-system/SKILL.md` |
| Pulido de UI, animación, detalle de componentes | `emil-design-eng` | `~/.claude/skills/emil-design-eng/SKILL.md` |
| UI no genérica: tokens, tipografía, color OKLCH | `frontend-design-deslop` | `~/.claude/skills/frontend-design-deslop/SKILL.md` |
| Compatibilidad con taste-skill v1 | `design-taste-frontend-v1` | `~/.claude/skills/design-taste-frontend-v1/SKILL.md` |

### Generales (no específicas del proyecto)

| Trigger | Skill | Path |
|---------|-------|------|
| Preguntas sobre arquitectura con `graphify-out/` | `graphify` | `~/.claude/skills/graphify/SKILL.md` |
| Entrevista exigente para afinar un plan | `grill-me` | `~/.claude/skills/grill-me/SKILL.md` |
| Crear o evaluar skills | `skill-creator` | `~/.claude/skills/skill-creator/SKILL.md` |
| Auditar y mejorar skills | `skill-improver` | `~/.config/opencode/skills/skill-improver/SKILL.md` |
| Planear commits como unidades revisables | `work-unit-commits` | `~/.config/opencode/skills/work-unit-commits/SKILL.md` |
| PR de más de 400 líneas, PR encadenados | `chained-pr` | `~/.config/opencode/skills/chained-pr/SKILL.md` |
| Escribir guías, README o docs de revisión | `cognitive-doc-design` | `~/.config/opencode/skills/cognitive-doc-design/SKILL.md` |
| Comentarios de PR, issues o reviews | `comment-writer` | `~/.config/opencode/skills/comment-writer/SKILL.md` |
| Crear o clasificar issues de GitHub | `issue-creation` | `~/.config/opencode/skills/issue-creation/SKILL.md` |
| Revisión dual adversarial ("judgment day") | `judgment-day` | `~/.config/opencode/skills/judgment-day/SKILL.md` |
| Triage de issues por clase raíz | `systemic-issue-triage` | `~/.config/opencode/skills/systemic-issue-triage/SKILL.md` |
| PR del repo Gentle AI (no aplica a este repo) | `branch-pr` | `~/.config/opencode/skills/branch-pr/SKILL.md` |
| Bench de Gentle AI (no aplica: Go) | `gentle-ai-bench` | `~/.config/opencode/skills/gentle-ai-bench/SKILL.md` |
| Tests en Go (no aplica: el stack es Node) | `go-testing` | `~/.config/opencode/skills/go-testing/SKILL.md` |
| Receipt-driven development de Gentle AI (no aplica) | `rdd-defect-workflow` | `~/.config/opencode/skills/rdd-defect-workflow/SKILL.md` |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### fastify-best-practices
- Todo es un plugin: encapsulá rutas y decoradores por módulo; usá `fastify-plugin` solo para compartir decoradores hacia arriba.
- Handlers y hooks `async`: devolvé el valor o lanzá el error; no mezcles `reply.send()` con `return`.
- Schema-first: validá entrada y serializá la salida con schema (acá, Zod en el borde → `400`).
- Errores centralizados con `setErrorHandler`: en este repo `ReglaDeNegocioError` → `409 {code}`, Zod → `400` (C-01).
- Tests con `app.inject()` sobre `buildApp(overrides)`, sin levantar el puerto; cerrá la app en `afterEach`.
- Preferí plugins oficiales (`@fastify/autoload`) a dependencias nuevas; las dependencias solo las agrega EP.
- Para detalle, leé `rules/<tema>.md` de la skill (routes, error-handling, testing, typescript).

### vitest
- `describe`/`it` con nombre que describa el escenario del spec (feliz, error de negocio, borde).
- Fechas: inyectá `FixedClock`; usá `vi.useFakeTimers()`/`vi.setSystemTime()` solo si no hay otra costura, y restaurá en `afterEach`.
- `vi.mock` se hoistea: para dependencias del proyecto preferí inyección (`buildApp(overrides)`) antes que mocks de módulo.
- `toEqual` para objetos, `toBe` para primitivos, `rejects.toMatchObject({ code })` para errores de dominio.
- Usá `projects` para separar la API (`node`) y `web/` (`jsdom`).
- Ojo: la skill está basada en Vitest 5 beta y el proyecto fija Vitest 3: verificá que la API exista en v3.

### tdd
- Red antes que green: test que falla primero, después el mínimo código que lo pasa. Sin features especulativas.
- Un corte vertical por ciclo: una costura, un test, una implementación mínima.
- Testeá comportamiento por interfaces públicas (caso de uso o `POST /api/turnos`), nunca internos ni el repositorio directo.
- Acordá las costuras (seams) con el usuario antes de escribir tests.
- Nada de tests tautológicos: el valor esperado sale del spec (por ejemplo 10:30 después de 10:00–10:30 se crea), no se recalcula como lo hace el código.
- El refactor va en la revisión, no dentro del loop red → green.

### test-driven-development
- Ley de hierro: ningún código de producción sin un test que falle antes.
- Si escribiste código antes del test, se borra y se empieza de nuevo desde el test.
- Mirá fallar cada test y confirmá que falla por la razón esperada (feature ausente, no un typo).
- Mocks solo si son inevitables; preferí código real y repositorios en memoria.
- Antes de cerrar: cada función nueva tiene test, todos pasan y la salida está limpia (sin errores ni warnings).

### typescript-advanced-types
- `strict: true` siempre; preferí `unknown` a `any` y estrechá con type guards.
- Uniones discriminadas para estados y resultados (`estado: 'reservado' | 'confirmado' | ...`, códigos de error como union de literales).
- Utility types (`Pick`, `Omit`, `Readonly`, `Record`) antes que tipos a mano duplicados.
- Genéricos con restricciones (`<T extends { id: string }>`) para repos en memoria.
- `as const` para catálogos de códigos; evitá aserciones `as` que esconden errores.
- No abuses de tipos condicionales profundos: afectan el tiempo de compilación y la legibilidad.

### vercel-react-best-practices
- Solo para `web/` (C-12 a C-15) y si se aprueba el design system; la parte de Next.js no aplica a Vite.
- Evitá waterfalls: `Promise.all` para pedidos independientes; arrancá promesas temprano.
- Importá directo, sin barrel files; carga diferida para lo pesado.
- No metas resultados de `useEffectEvent` en deps; handlers estables con refs cuando haga falta.
- Derivá estado en el render en vez de sincronizarlo con efectos.

### api-security-best-practices
- Verificá el contrato exacto del token (algoritmo, emisor, expiración) antes de confiar en el rol (RFC 8725).
- Autorizá recurso y operación, no solo el rol: el paciente solo opera sus turnos (ajeno → `404`).
- Parseá una vez en el borde (Zod) y usá solo el valor validado.
- Contraseñas con hash (`bcryptjs`); secretos solo en variables de entorno; nunca en logs ni respuestas.
- No prometas protección DDoS; el rate limit es control de abuso.
- No loguees datos de pacientes ni tokens.

### vite
- `vite.config.ts` en TypeScript y solo ESM.
- Rutas por carpeta con `import.meta.glob('./pages/*/routes.tsx')`, sin router central (regla 2 de CHANGES.md).
- `@vitejs/plugin-react` para React; proxy `/api` al servidor Fastify en desarrollo.
- Variables públicas solo con prefijo `VITE_`; nunca secretos en el cliente.
- Ojo: la skill describe Vite 8 (Rolldown) y el proyecto fija Vite 7.

### active-orchestrator
- Coordina, no ejecuta: despacha cada fase a su skill y valida la salida.
- Nunca escribe estado, instala ni crea artefactos sin aprobación explícita del plan.
- En `.active-orchestrator-state.json` solo toca `version`, `step`, `owner` y `foundation`; backup y escritura atómica.
- Al terminar cada fase, reporte breve; pausa en decisiones del usuario (instalaciones, reglas, aprobación visual).
- Nunca marca como `skipped` una fase requerida.

### active-delivery
- Antes de arrancar una unidad de trabajo, acordá con el usuario ODD o SDD.
- En este proyecto los changes de `CHANGES.md` van por SDD (OpenSpec).
- Llevá la evidencia de ODD al flujo de OpenSpec solo con aprobación del usuario.
- No dupliques artefactos: retomá desde la evidencia que ya existe.
- Ante dudas sobre el alcance, preguntá antes de escribir.

### active-roadmap
- No se usa en este proyecto: task-management quedó `skipped` y el estado vive en `CHANGES.md`.
- Si se activara: siempre preview antes de publicar en ClickUp y confirmación explícita.
- Nunca guarda credenciales en el repo.
- Reconciliar no borra tareas existentes sin confirmación.
- `CHANGES.md` sigue siendo la fuente del alcance y las dependencias.

### agent-instruction
- Genera `AGENTS.md` y `CLAUDE.md` idénticos en la raíz.
- Lo único interactivo son las reglas duras: proponerlas y confirmarlas con el usuario una por una.
- No repite las reglas globales del cliente (`~/.claude/CLAUDE.md`); solo lo específico del proyecto.
- Referencia la KB, `CHANGES.md` (camino crítico) y las skills del registry.
- Reglas stack-aware, derivadas del stack real, no genéricas.

### discovery-research
- Checklist de 11 puntos; no completar un punto con suposiciones si se puede preguntar o investigar.
- Delegá las URLs de competidores en `web-scraper`.
- Gate final: resumir y esperar confirmación antes de escribir.
- En este proyecto escribe en `docs/discovery/` (ya cerrado; no se vuelve a correr).
- Lo no comprobado se marca "No evidenciado".

### web-scraper
- Una nota markdown por URL con esquema fijo: problema, usuarios, features, pricing, posicionamiento.
- Solo WebFetch/WebSearch, sin API keys ni costos.
- No crawling masivo ni sitios con JS pesado o anti-bot.
- Distinguí funcionalidad comprobada de afirmación comercial.
- Registrá URL y fecha de consulta.

### kb-creator
- 10 archivos canónicos en `knowledge-base/` más README.
- Modo silencioso si hay fuentes en `docs/`; interactivo si no.
- Las reglas de negocio llevan código estable (`RN-XX-NN`) para trazabilidad.
- "Preguntas abiertas" contiene lo que el Discovery dejó como "No evidenciado".
- Nunca inventar decisiones: lo inferido va como supuesto (`SU-NN`).

### roadmap-generator
- Genera `CHANGES.md` sin preguntar: árbol de dependencias, gates, camino crítico y plan multiagente.
- C-01 no depende de nada; modelos core antes que features; auth antes que recursos protegidos.
- Cada change: estado, scope, dependencias, governance y "Leer antes".
- Conservá los IDs al editar o reordenar.
- En este proyecto solo EP edita `CHANGES.md`.

### find-skill
- Solo recomienda; nunca instala sin aprobación explícita del usuario.
- Verificá cantidad de instalaciones (≥1K) y reputación de la fuente antes de recomendar.
- Tabla: skill, fuente, instalaciones, por qué encaja.
- Instalación aprobada: `npx skills add <repo> --skill <nombre> -g -y -a claude-code`.
- Registrá solo instalaciones verificadas.

### openspec-explore
- No implementa: nunca escribe código ni edita `openspec/config.yaml`.
- No crea changes a mano: siempre `openspec new change "<nombre>"`.
- Ofrecé guardar los hallazgos antes de escribirlos (en este proyecto, el resumen del explore se guarda: lo pide la consigna).
- Basá la discusión en el código y la KB reales; cuestioná supuestos.
- Visualizá con diagramas cuando ayude.

### openspec-propose
- Usá el CLI (`openspec new change`, `openspec instructions <artefacto>`) para crear proposal, design, specs y tasks.
- Nunca adivines el estado: `openspec status --change "<nombre>" --json`.
- Escenarios GIVEN/WHEN/THEN; mínimo feliz, error de negocio y borde.
- El spec no se aprueba a la primera: se muestra completo para revisar y Ajustar.
- `proposal.md` justifica en 2 o 3 líneas por qué se eligió el change.

### openspec-apply-change
- Leé el contexto con `openspec instructions apply --change "<nombre>" --json` antes de implementar.
- Implementá tarea por tarea y marcá `[x]` en `tasks.md` al terminar cada una.
- Si algo no está en el spec, frená y volvé a Propose: sin decisiones de diseño improvisadas.
- Pausá ante bloqueos o ambigüedades en vez de adivinar.
- TDD: test que falla primero en cada tarea.

### openspec-archive-change
- No archives con tests en rojo ni con tareas sin marcar (si las hay, avisá y pedí confirmación).
- Sincronizá las delta specs a `openspec/specs/<capability>/` antes de mover el change.
- El change queda en `openspec/changes/archive/AAAA-MM-DD-<nombre>/`.
- Usá el CLI, no muevas carpetas a mano.
- Reportá el resultado del archive.

### openspec-sync-specs
- Aplicá las delta specs (ADDED/MODIFIED/REMOVED/RENAMED) sobre `openspec/specs/` sin archivar.
- Conservá los requisitos existentes que el delta no toca.
- Una capability por change: no sincronices specs de otra capability.
- Verificá el resultado con `openspec status`.
- No edites código.

### openspec-update-change
- Revisa los artefactos de planificación de un change y los mantiene coherentes entre sí.
- Nunca edita código.
- Si el usuario se refiere al comando `openspec update`, corré el CLI en lugar de esta skill.
- Un cambio en specs se refleja en design y tasks.
- Mostrá el diff de artefactos antes de terminar.

### design-system
- Política visual del proyecto: `system-and-mockups`, revisión 1, `Approval: pending` (fase `deferred`).
- Sin design system aprobado no se aplica ningún change de UI (C-12 a C-15). Corte: lunes 23/11 a las 12:00.
- Lo no resuelto (nombre, logo) queda `(TBD)` en una sola ruta reemplazable.
- Cambiar tokens o assets sube `Revision:` y vuelve la aprobación a `pending`.
- C-01 y C-02 no tienen UI: `Decision: no (no UI)` en su `design.md`.

### emil-design-eng
- Botones con respuesta inmediata (feedback en press).
- Nunca animes desde `scale(0)`; usá escalas cercanas a 1 con opacidad.
- Fricción en vez de bloqueos duros para acciones destructivas.
- Animá solo `transform` y `opacity`.
- Pasá el checklist de revisión antes de entregar UI.

### frontend-design-deslop
- Preguntas agrupadas y de alto impacto, con 2 a 4 opciones concretas.
- Colores en OKLCH, jerarquía en gris primero y acento escaso (60-30-10).
- 2 o 3 familias tipográficas con escala modular.
- Espaciado según relación (apretado dentro del grupo, amplio entre secciones).
- En este proyecto manda `design-system/tokens.css`: no inventes tokens nuevos.

### design-taste-frontend-v1
- Solo por compatibilidad; preferí `design-system/` del proyecto.
- Nunca animes `top`, `left`, `width` ni `height`: solo `transform` y `opacity`.
- Filtros de ruido solo en pseudo-elementos fijos, nunca en contenedores con scroll.
- Z-index solo para capas sistémicas (navbar, modal, overlay).
- Evitá los "AI tells" listados en la skill.

### graphify
- Si existe `graphify-out/graph.json`, consultalo antes de releer el código.
- Nunca inventes aristas: si no es seguro, `AMBIGUOUS`.
- Mostrá el costo en tokens y los puntajes de cohesión reales.
- No generes la visualización HTML con más de 5.000 nodos sin avisar.
- Una extracción vacía no pisa un grafo bueno.

### grill-me
- Entrevista exigente, una pregunta por vez, para afinar un plan o diseño.
- Cuestioná supuestos y huecos antes de aceptar el plan.
- Basá las preguntas en el código y la KB.
- Terminá con un resumen de decisiones y pendientes.
- No escribe código.

### skill-creator
- Una skill es `SKILL.md` con frontmatter (`name`, `description` con triggers claros) más assets opcionales.
- Escribí la descripción para que dispare bien: qué hace y cuándo usarla.
- Medí con evals antes y después de cambiar una skill.
- Mantené `SKILL.md` corto y mové el detalle a `references/`.
- No es parte del flujo del proyecto: solo para crear skills propias.

### skill-improver
- Por defecto solo audita; modificá archivos solo si el usuario lo pide.
- `SKILL.md` es la fuente de verdad: preservá intención, reglas críticas y triggers.
- Nunca borres contenido significativo en silencio: movelo a `references/` o `assets/`.
- No inventes triggers, políticas ni reglas de dominio.
- Marcá los casos ambiguos para revisión humana.

### work-unit-commits
- Un commit = un propósito claro; el repo tiene sentido aplicando solo ese commit.
- Tests y docs viajan con la unidad que verifican.
- El rollback no arrastra trabajo no relacionado.
- Registrá el comando de test y su resultado.
- El mensaje explica el resultado, no la lista de archivos (en este repo: `tipo(alcance): descripción`).

### chained-pr
- Partí los PR de más de 400 líneas cambiadas, salvo excepción aceptada.
- El presupuesto limita cómo se corta el trabajo, nunca el código: no borres tests ni docs para entrar.
- Cada PR revisable en unos 60 minutos, con una unidad entregable.
- Indicá dependencias previas y lo que queda fuera de alcance.
- No mezcles estrategias de encadenado.

### cognitive-doc-design
- Docs que reducen carga cognitiva: lo importante primero.
- Secciones cortas con títulos que respondan preguntas del lector.
- Checklists verificables por el lector.
- Ejemplos concretos antes que explicación abstracta.
- Útil para el README reproducible y la reflexión.

### comment-writer
- Comentarios cálidos y directos para PR, issues y reviews.
- Primero lo que hay que cambiar y por qué, después lo opcional.
- Evidencia concreta (archivo y línea), sin culpar a personas.
- Un pedido por comentario.
- Cerrá con el siguiente paso claro.

### issue-creation
- Issues basados en evidencia del repositorio (reproducción, archivo, comportamiento esperado).
- Una issue por problema independiente.
- Pedí aprobación antes de crear la issue.
- No apliques etiquetas de mantenedor sin permiso.
- En este proyecto no se usan issues: el estado vive en `CHANGES.md`.

### judgment-day
- Dos jueces ciegos de solo lectura con el mismo alcance y criterios, en paralelo.
- Esperá a los dos; nunca aceptes un juicio parcial.
- Corregí solo hallazgos severos confirmados por ambos.
- Máximo dos rondas de corrección y dos re-juicios; veredicto `APPROVED | ESCALATED`.
- No reemplaza la aprobación de EP del PR.

### systemic-issue-triage
- Clasificá por clase raíz antes de tocar código.
- N issues con la misma raíz = un solo fix en la raíz, con tests nombrados.
- Reproducí antes de implementar: el mecanismo reportado es una hipótesis.
- Un fix no agrega estados, flags ni gates si puede borrar o relajar algo.
- Cerrá issues contra tests, no contra promesas.

### branch-pr
- Específica del repo Gentle AI (issue aprobada, label `type:*`): **no aplica** a este proyecto.
- Acá los PR siguen `.github/pull_request_template.md` y los aprueba EP.
- Usá la convención de commits del proyecto (`tipo(alcance): descripción`).
- Este proyecto sí usa el trailer `Co-Authored-By` en los commits del agente.
- Ante dudas, seguí `CONTRIBUTING.md`.

### gentle-ai-bench
- Específica del repo Gentle AI (Go): **no aplica** a este proyecto.
- `go test ./bench` valida declaraciones, no ejecuta journeys.
- Reproducí los comandos de CI en vez de adivinarlos.
- Nunca inventes valores de métricas.
- IDs de journey únicos.

### go-testing
- Solo para Go: **no aplica** (el stack es Node + TypeScript).
- Tests de tabla con `t.Run`.
- Testeá comportamiento y transiciones de estado, no detalles internos.
- `t.TempDir()` para archivos; nunca el home real.
- Golden files deterministas.

### rdd-defect-workflow
- Específica de Gentle AI: **no aplica** a este proyecto.
- Revisá primero el kill switch de RDD; si está apagado, seguí la política normal.
- Requiere issue aprobada y reproducción limpia en `main`.
- Límite de 400 líneas por candidato; arriba, encadenar.
- Validación independiente de solo lectura antes de publicar.

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| AGENTS.md / CLAUDE.md | `AGENTS.md`, `CLAUDE.md` | Índice — copias idénticas con stack, reglas duras y referencias a los archivos de abajo |
| BIBLIA del proyecto | `docs/BIBLIA-PROYECTO.md` | Referenciado por AGENTS.md: consigna completa, criterios de evaluación, etapas y checklist §17 |
| Roadmap | `CHANGES.md` | Changes, dependencias, carpetas por persona y reglas para no pisarse |
| Flujo de equipo | `CONTRIBUTING.md` | Ramas `dev-<alias>`, PR, commits y prohibiciones |
| Plantilla de PR | `.github/pull_request_template.md` | Checklist de cada PR |
| Knowledge base | `knowledge-base/README.md` y `01` a `10` | Dominio, reglas `RN-*`, arquitectura y decisiones |
| Estado de la fundación | `.active-orchestrator-state.json` | Solo EP |
| Bitácora | `evidencias/bitacora-decisiones.md` | Una fila por decisión; no borrar filas ajenas |
| Design system | `design-system/README.md` | Política `system-and-mockups`, aprobación pendiente |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
