# Turnos Odontología

Agenda para consultorios odontológicos de 1 a 3 profesionales: una API REST y una web para la recepcionista, el profesional y el paciente. Garantiza que **ningún profesional ni box tenga turnos superpuestos**: usa intervalos `[inicio, fin)`, grilla de 15 minutos y no admite sobreturnos.

- Contexto y reglas: [knowledge-base/](knowledge-base/README.md)
- Plan de changes: [CHANGES.md](CHANGES.md)
- Flujo de equipo: [CONTRIBUTING.md](CONTRIBUTING.md)

## Requisitos

- Node.js **22.20 o superior** (incluye npm)
- Git

No hace falta base de datos, servidor de correo ni archivo `.env`: el MVP guarda en memoria y los emails van a un outbox en memoria.

## Instalar y verificar

Los mismos comandos sirven en Windows (PowerShell), Linux y macOS:

```bash
git clone <url-del-repo>
cd turnos-odontologia
npm ci
npm test            # Vitest de la API y de web/
npm run typecheck   # TypeScript strict
npm run lint        # ESLint
npm run build -w web  # build de producción de la web
```

## Levantar la plataforma

Hacen falta dos terminales, las dos en la carpeta del repo:

```bash
npm start              # terminal 1: API en http://localhost:3000 (/api/health → {"status":"ok"})
npm run dev -w web     # terminal 2: web en http://localhost:5173 (reenvía /api a la API)
```

Abrí http://localhost:5173 y entrá con un usuario de prueba. Son datos ficticios de los seeds (`src/shared/seed.ts`):

| Rol | Email | Contraseña |
|---|---|---|
| Profesional (Dra. Ana Pérez) | `profesional@example.com` | `profesional-ejemplo` |
| Profesional (Dr. Bruno Gómez) | `profesional2@example.com` | `profesional-ejemplo` |
| Recepcionista | `recepcion@example.com` | `recepcion-ejemplo` |
| Paciente | `paciente1@example.com` | `paciente-ejemplo` |
| Paciente demo (Mario Santos) | `santos@example.com` | `simulador-ejemplo` |

`npm start` también carga **pacientes de demostración** con nombres de personajes de ficción argentinos (`src/shared/seed-demo.ts`): Mario Santos, Emilio Ravenna, Gabriel Medina y Pablo Lamponne, de *Los simuladores*, y Mafalda y Felipe, de *Mafalda*, con dentición mixta. Cada uno tiene historia clínica, un odontograma armado en varias visitas para recorrerlo con la máquina del tiempo, turnos atendidos (que suman en Ganancias) y turnos próximos. Las fechas se calculan desde el momento en que arranca la API. Los tests no cargan estos datos.

Los datos viven en memoria: al reiniciar la API se pierden los turnos creados y vuelven los seeds.

### Variables de entorno (opcionales)

La API lee variables del entorno del proceso; no carga un archivo `.env` por su cuenta. `.env.example` lista las disponibles.

| Variable | Para qué | Si no se define |
|---|---|---|
| `PORT` | Puerto de la API | `3000` (la web reenvía `/api` a este puerto) |
| `APP_TZ` | Zona horaria del consultorio | `America/Argentina/Mendoza` |
| `JWT_SECRET` | Firma de los tokens de sesión | Un secreto aleatorio por proceso (las sesiones no sobreviven a un reinicio). Es obligatoria con `NODE_ENV=production`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Envío real de emails de confirmación | Los emails quedan en un outbox en memoria |

Ejemplo en PowerShell: `$env:APP_TZ = "America/Argentina/Buenos_Aires"; npm start`. En bash: `APP_TZ=America/Argentina/Buenos_Aires npm start`.

## Estructura

```
src/
├── app.ts            buildApp(overrides): registra módulos, sesión, precios por rol y errores (congelado)
├── server.ts         arranque con PORT
├── shared/           contratos comunes congelados: entidades, errores, Clock, zona, repos en memoria, seeds, sesión, lock
└── modules/<cap>/    un módulo por change (DD-13)
tests/<cap>/          un test por escenario del spec
web/                  React + Vite; cada área agrega web/src/pages/<area>/routes.tsx
```

Después de C-01, solo EP cambia `src/shared/`, `src/app.ts`, `package.json`, el lockfile, `tsconfig*` y la configuración de lint y Vitest. Los pedidos van como `chore(shared): …`.

## Cómo escribir un módulo

1. Creá `src/modules/<capability>/routes.ts`, que exporte por defecto un plugin de Fastify. Se publica solo bajo `/api`:

   ```ts
   import type { FastifyInstance } from 'fastify';
   import { z } from 'zod';
   import { requireRol, sesionDe } from '../../shared/sesion';

   const esquema = z.object({ inicio: z.string().datetime({ offset: true }) });

   export default async function rutas(app: FastifyInstance) {
     app.post('/turnos', { preHandler: requireRol('profesional', 'recepcionista') }, async (request, reply) => {
       const body = esquema.parse(request.body);       // inválido → 400 FORMATO_INVALIDO
       const { repos, clock, conLockDeAgenda } = app.deps;
       // ...caso de uso; una regla violada lanza new ReglaDeNegocioError('SOLAPAMIENTO_BOX') → 409
       return reply.status(201).send({ ok: true, sesion: sesionDe(request).rol });
     });
   }
   ```

2. Comportamiento que ya resuelve la plataforma:
   - Toda ruta exige `Authorization: Bearer <token>` (si falta o es inválido, `401`), salvo `/api/health` y `/api/public/*`.
   - Las respuestas a la recepcionista, al paciente y a las rutas públicas **pierden `precio` y `precioAlReservar`**.
   - Los errores se mapean así: Zod → `400`, `ReglaDeNegocioError` → `409 {code}` (`NO_ENCONTRADO` → `404`), sin permiso → `403` y cualquier otro → `500`.
3. En `dominio/` no se usa `Date.now()`, Fastify ni repositorios concretos. La hora llega por `Clock` y la zona por `enZonaConsultorio()`.
4. Tests en `tests/<capability>/`, con una API aislada por test:

   ```ts
   import { buildApp } from '../../src/app';
   import { FixedClock } from '../../src/shared/clock';
   import { SEED } from '../../src/shared/seed';

   const app = await buildApp({ clock: new FixedClock('2026-11-23T12:00:00Z'), auth: miAuthDeTest });
   // SEED.profesionales.anaPerez.id, SEED.boxes.box1.id, SEED.prestaciones.consulta.id…
   ```

   Usá fechas dentro del horario semilla (lunes a viernes, 09:00–13:00) y datos siempre ficticios.

## Estado

Los 15 changes de [CHANGES.md](CHANGES.md) están mergeados en `main` y archivados en `openspec/changes/archive/`. El change evaluado es **C-02 `crear-turno-sin-solapamientos`**: su spec está en `openspec/specs/turnos-alta/` y sus tests en `tests/turnos-alta/`.

| Change | Código |
|---|---|
| C-01 fundación y dominio base | `src/app.ts`, `src/shared/` |
| C-02 crear turno sin solapamientos | `src/modules/turnos-alta/` |
| C-03 configuración del consultorio | `src/modules/configuracion/` |
| C-04 cuentas y pacientes | `src/modules/cuentas/` |
| C-05 cancelar y cambiar estado | `src/modules/turnos-estados/` |
| C-06 email y Google Calendar | `src/modules/notificaciones/` |
| C-07 agenda y auditoría | `src/modules/agenda/` |
| C-08 ganancias del profesional | `src/modules/ganancias/` |
| C-09 historia clínica y odontograma | `src/modules/clinica/` |
| C-10 reprogramar turno | `src/modules/turnos-reprogramacion/` |
| C-11 reserva y autogestión del paciente | `src/modules/reserva-online/` |
| C-12 web base | `web/src/base/`, `web/src/pages/auth/` |
| C-13 web de recepción | `web/src/pages/recepcion/` |
| C-14 web del paciente | `web/src/pages/paciente/` |
| C-15 web del profesional | `web/src/pages/profesional/` |

Los tests de cada módulo de la API están en `tests/<capability>/`, y los de la web junto a cada pantalla, en `web/src/`.
