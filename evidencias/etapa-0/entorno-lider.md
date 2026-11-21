# Etapa 0 — Entorno de la PC del líder

Relevado el 2026-11-21 con los comandos `--version` de cada herramienta y `~/.active-stack/installation.json`.

| Herramienta | Versión |
|---|---|
| Active Stack | v0.8.1 (compilado desde GitHub con `build.bat`) |
| Modo de instalación | Full (Completo), permisos "balanceado", para Claude, Codex, OpenCode y Antigravity (reaplicado el 21/11 con el instalador gráfico v0.8.1) |
| Claude Code | 2.1.310 |
| OpenSpec | 2.1.1 (perfil `core`) |
| Engram | 3.6.0 |
| Git | 2.55.0 |
| Node.js | 24.19.0 |
| Go | 1.26.5 |

MCP en Claude Code: `engram`, `context7`, `playwright`.

Skills instaladas por Active Stack: active-orchestrator, active-delivery, active-roadmap, discovery-research, web-scraper, kb-creator, roadmap-generator, find-skill, skill-registry, agent-instruction, skill-creator, design-system, emil-design-eng, design-taste-frontend-v1. Más las de OpenSpec (openspec-explore, openspec-propose, openspec-apply-change, openspec-update-change, openspec-sync-specs, openspec-archive-change) y sdd-orchestrator.

Lista completa de harnesses del modo Full: [harnesses-plan-full.txt](harnesses-plan-full.txt) (salida de `active-stack install --dry-run --agent claude --mode full`, que muestra el plan sin ejecutar nada).

## Capturas

- `00-Creacion-Repo.png`: repositorio `Pinini777/turnos-odontologia` creado, público y vacío.
- `00-Instalacion-Completo.png`: instalador gráfico de Active Stack, pantalla "Revisá tu configuración" con el modo **Completo** (Full) y la lista de componentes (harnesses) a instalar.
- `harnesses-plan-full.txt`: lista de harnesses del modo Full.
