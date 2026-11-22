# Arquitectura Propuesta

## Patrones aplicados

| Patrón | Dónde se usa | Por qué |
|---|---|---|
| Arquitectura hexagonal (puertos y adaptadores) | Dentro de cada `src/modules/<capability>/`: `dominio/` ↔ `aplicacion/` ↔ `routes.ts`, con puertos en `src/shared/` | Las reglas de agenda se testean sin HTTP ni base de datos |
| Funciones de dominio puras | Detección de solapamientos, grilla, transiciones de estado | Deterministas: un test por escenario del spec, sin mocks |
| Repository | `TurnoRepository`, `ProfesionalRepository`, etc. | Arranca en memoria y migra a SQLite sin tocar el dominio |
| Caso de uso (application service) | `CrearTurno`, `CancelarTurno`, `ReprogramarTurno`, `ReservarOnline` | Un punto que orquesta validación, persistencia, auditoría y notificación |
| Reloj inyectable (`Clock`) | Reglas que dependen de "ahora" | Tests reproducibles de RN-AG-10 y de la regla de 24 h |
| Errores de dominio con código | `ReglaDeNegocioError(code)` → HTTP `409` | Los tests verifican el motivo exacto del rechazo |
| Outbox / notificador como puerto | Email de confirmación | Un email fallido no revierte el turno (RN-NO-02) |

## Estructura de directorios

```
turnos-odontologia/
├── src/
│   ├── app.ts             # buildApp(): autoload de módulos y mapeo de errores (C-01, congelado)
│   ├── shared/            # dominio común congelado: entidades, errores RN-EX-01, Clock, puertos y repos en memoria, seeds ficticios
│   └── modules/
│       └── <capability>/  # un módulo por change (DD-13), hexagonal por dentro:
│           ├── dominio/   #   reglas puras (p. ej. turnos-alta/dominio/agenda.ts: seSuperponen(), conflictos())
│           ├── aplicacion/#   casos de uso
│           └── routes.ts  #   rutas Fastify + esquemas Zod (se cargan solas)
├── web/                   # React + Vite + TS: pantallas de paciente, recepción y profesional
│   └── src/               # importa design-system/tokens.css; cada pantalla nace de un mockup aprobado
├── design-system/         # tokens, marca, componentes de referencia (política system-and-mockups)
├── tests/
│   └── <capability>/      # un test por escenario del spec (feliz, error, borde), de dominio y de HTTP
├── openspec/              # specs vigentes y changes
├── knowledge-base/
└── docs/
```

> Estructura por módulo (DD-13): cada change de `CHANGES.md` escribe solo en `src/modules/<capability>/` y `tests/<capability>/`. La arquitectura hexagonal se mantiene dentro de cada módulo.

## Seguridad

- **Autenticación**: email y contraseña con hash (bcrypt o argon2), sesión con JWT de corta duración, para los tres roles. El paciente se registra solo (PA-01).
- **Autorización**: middleware por rol, según la matriz de [03](03_actores_y_roles.md). Las respuestas para la recepcionista **omiten precios** (se serializa por rol, no solo se ocultan campos en la vista).
- **Validación de input**: esquemas Zod en cada endpoint. Fechas en ISO 8601 con zona horaria explícita.
- **Secrets management**: variables de entorno; `.env` ignorado por git (además, el harness `permissions` de Active Stack lo bloquea); `.env.example` con valores falsos.
- **Datos sensibles**: HC y odontograma solo para profesionales, con auditoría. Sin datos reales de pacientes en el repo (RN-DA-01).
- **Concurrencia**: validar y guardar un turno es atómico. En memoria, con un lock por consultorio. En SQLite, con una transacción `BEGIN IMMEDIATE` (RN-RE-04).

## Variables de entorno

| Variable | Descripción | Ejemplo | Sensible |
|---|---|---|---|
| `PORT` | Puerto HTTP | `3000` | N |
| `APP_TZ` | Zona horaria del consultorio (DD-08) | `America/Argentina/Mendoza` | N |
| `JWT_SECRET` | Firma de sesiones | `cambiar-en-local` | **S** |
| `SMTP_HOST` / `SMTP_PORT` | Servidor de correo | `localhost` / `1025` | N |
| `SMTP_USER` / `SMTP_PASS` | Credenciales SMTP | `usuario-ejemplo` / `clave-ejemplo` | **S** |
| `MAIL_FROM` | Remitente | `turnos@example.com` | N |
| `DB_PATH` | Archivo SQLite (cuando exista) | `./data/turnos.db` | N |

## Calidad y verificación

- `npm test` corre Vitest: en la etapa 6, cada escenario del spec tiene al menos un test.
- `npm run typecheck` (tsc `--noEmit`) y lint antes de cada PR.
- El README documenta cómo clonar, instalar (`npm ci`) y correr los tests en Windows, Linux y macOS.
