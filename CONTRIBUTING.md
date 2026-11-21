# Cómo trabajamos

## Una sola vez, en tu PC

1. Aceptá la invitación al repo que te llega por mail de GitHub.
2. Configurá git con **el mail de tu cuenta de GitHub** (si no, tus commits no cuentan como tuyos):
   ```powershell
   git config --global user.name "Tu Nombre"
   git config --global user.email "mail-de-tu-cuenta-github"
   ```
3. Cloná el repo (Engram reconoce el proyecto `turnos-odontologia` por el remoto de GitHub):
   ```powershell
   git clone https://github.com/Pinini777/turnos-odontologia.git
   ```
4. Tené instalado Active Stack en modo Full para Claude Code (ver la Guía Contexto).
5. Pasate a tu rama, que ya creó el líder (`dev-lautaro`, `dev-agustin`, `dev-lucas`, `dev-renzo`, `dev-facundo` o `dev-ep`):
   ```powershell
   git switch dev-<alias>
   ```

## Ramas

- `main`: protegida. Solo entra por Pull Request y solo el líder mergea.
- `dev-<alias>`: tu rama, la crea el líder. Trabajás tus changes ahí.

## Flujo de un change

```powershell
git switch dev-<alias>
git pull origin main          # siempre partí de lo último de main
engram sync --import          # traé la memoria del equipo
claude
```

En Claude: `/sdd-orchestrator` y después explore → propose (revisá y **Ajustá**) → apply → tests en verde → archive.

```powershell
git add -A
git commit -m "feat(C-XX): descripción corta"
engram sync
git add .engram
git commit -m "chore(engram): sync project memory"
git push origin dev-<alias>
```

Abrí el PR de `dev-<alias>` hacia `main` y completá la plantilla.

## Reglas para trabajar en paralelo sin pisarnos

1. **Arrancá un change solo cuando todas sus dependencias de `CHANGES.md` estén mergeadas en `main`.** Nunca partas de la rama de un compañero.
2. **Tocá solo los archivos del scope de tu change.** Si necesitás tocar algo compartido (dependencias, configuración de tests, modelo core), avisale al líder antes.
3. **No edites** `CHANGES.md`, `AGENTS.md`, `CLAUDE.md` ni `.active-orchestrator-state.json`: los mantiene el líder.
4. **Archivá tu change en tu rama** antes de abrir el PR, así el PR trae `openspec/specs/` actualizado y la carpeta del archive.
5. Si dos changes de la misma ola necesitan la misma capacidad de `openspec/specs/`, avisá: el líder los ordena uno detrás del otro.
6. Después de cada merge a `main`, el líder avisa por el grupo y los que siguen hacen `git pull origin main`.

## Commits

`tipo(alcance): descripción` — tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Ejemplos: `docs(discovery): verificar fuentes 1 a 5`, `feat(C-04): validar solapamiento por box`, `test(C-04): escenario de borde 10:30`.

## Prohibido

- Datos reales de pacientes (nombres, DNI, teléfonos, capturas): todo ficticio.
- API keys, tokens o contraseñas en el repo.
- `engram sync --all` (subiría la memoria de todos tus proyectos).
