# Arquitectura Propuesta

## Patrones aplicados

| Patrón | Dónde se usa | Por qué |
|---|---|---|
| Arquitectura hexagonal (puertos y adaptadores) | `src/domain` ↔ `src/application` ↔ `src/infrastructure` | Las reglas de agenda se testean sin HTTP ni base de datos |
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
│   ├── domain/            # entidades y reglas puras (agenda, turno, prestación, box)
│   │   ├── agenda.ts      # seSuperponen(), validarGrilla(), conflictos()
│   │   ├── turno.ts       # estados y transiciones
│   │   └── errores.ts     # códigos RN-EX-01
│   ├── application/       # casos de uso: crear, cancelar, reprogramar, reservar, ganancias
│   ├── infrastructure/
│   │   ├── memory/        # repositorios en memoria (MVP y tests)
│   │   ├── sqlite/        # adaptador posterior
│   │   ├── email/         # SMTP + outbox de tests + generador .ics / link GCal
│   │   └── clock.ts
│   └── http/              # Fastify: rutas, esquemas Zod, auth, mapeo de errores
├── web/                   # React + Vite + TS: pantallas de paciente, recepción y profesional
│   └── src/               # importa design-system/tokens.css; cada pantalla nace de un mockup aprobado
├── design-system/         # tokens, marca, componentes de referencia (política system-and-mockups)
├── tests/
│   ├── domain/            # un test por escenario del spec (feliz, error, borde)
│   └── http/              # tests de integración de la API
├── openspec/              # specs vigentes y changes
├── knowledge-base/
└── docs/
```

> La estructura exacta del primer change la fija su `design.md` en OpenSpec. Esta es la guía.

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
