# Turnos Odontología

API de agenda para consultorios odontológicos de 1 a 3 profesionales. Garantiza que **ningún profesional ni box tenga turnos superpuestos**: usa intervalos `[inicio, fin)`, grilla de 15 minutos y no admite sobreturnos.

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
```

## Levantar la API

```bash
npm start           # http://localhost:3000/api/health → {"status":"ok"}
```

Para cambiar el puerto o la zona horaria, copiá `.env.example` a `.env`, o pasá las variables de entorno: `PORT` y `APP_TZ` (por defecto `America/Argentina/Mendoza`).

La web (sin pantallas hasta C-12) se levanta con `npm run dev -w web`.

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

## Dependencias provisionales

| Archivo | Hoy | Lo reemplaza |
|---|---|---|
| `src/modules/cuentas/adapter.ts` | rechaza todo token (`401`) | C-04 |
| `src/modules/notificaciones/adapter.ts` | outbox en memoria | C-06 |
| `src/modules/configuracion/disponibilidad.ts` | acepta cualquier horario | C-03 |
