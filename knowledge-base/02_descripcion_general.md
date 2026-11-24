# Descripción General

## Stack tecnológico

> **Confirmado por EP en la revisión de la etapa 3 (2026-11-21).** Justificación y alternativas en [DD-01](09_decisiones_y_supuestos.md#dd-01--stack-nodejs--typescript); frontend en [DD-12](09_decisiones_y_supuestos.md#dd-12--interfaz-web-con-react--vite).

| Capa | Tecnología | Versión mínima |
|---|---|---|
| Frontend web | React + Vite + TypeScript, con los tokens de `design-system/tokens.css` | React 19, Vite 7 |
| Runtime | Node.js (LTS) | 22.20 (la misma que ya exige OpenSpec en todas las PC del equipo) |
| Lenguaje | TypeScript (modo `strict`) | 5.x |
| API HTTP | Fastify | 5.x |
| Validación de entrada | Zod | 3.x |
| Tests | Vitest | 3.x |
| Persistencia (MVP) | Repositorios en memoria por defecto; PostgreSQL en Supabase optativo detrás de los mismos puertos | PostgreSQL 17 en C-16 |
| Email | Adaptador SMTP (Nodemailer) con un "outbox" en memoria para tests | — |
| Calendario | Link "Agregar a Google Calendar" y archivo `.ics` (RFC 5545), sin OAuth | — |

## Arquitectura general

Monolito modular con **arquitectura hexagonal**: el dominio (reglas de agenda) no depende de HTTP ni de la base de datos. Por eso se puede testear cada escenario del spec sin levantar servidor.

```
              ┌──────────────────────────────────────────┐
 Paciente ───►│  HTTP (Fastify)  /api/...                │
 Recepción ──►│  autenticación + autorización por rol    │
 Profesional─►└───────────────┬──────────────────────────┘
                              │ casos de uso (application)
                ┌─────────────▼─────────────┐
                │  Dominio: Agenda, Turno,   │  ← RN-AG-*, RN-TU-*
                │  Prestación, Box, Bloqueo  │     (puro, sin I/O)
                └─────────────┬─────────────┘
                              │ puertos (interfaces)
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  Repositorios          Notificador email      Reloj (Clock)
  (memoria o Postgres)  (SMTP / outbox)        (inyectable en tests)
```

Decisiones de alto nivel:
- **Dominio puro**: la detección de solapamientos es una función determinística sobre los turnos activos del profesional y del box. Es el corazón del change evaluado.
- **Reloj inyectable**: las reglas dependen de "ahora" (no crear turnos en el pasado, regla de 24 h). Los tests fijan la hora.
- **Persistencia detrás de puertos**: el MVP arranca en memoria. Con `DATABASE_URL` utiliza PostgreSQL en Supabase sin modificar dominio, casos de uso ni rutas; `TEST_DATABASE_URL` habilita únicamente las pruebas PostgreSQL aisladas (DD-14).

## Integraciones externas

| Servicio | Propósito | Tipo | En el MVP |
|---|---|---|---|
| Servidor SMTP | Email de confirmación del turno al paciente | SMTP (Nodemailer) | Sí. En tests, outbox en memoria |
| Google Calendar (del lado del paciente) | Agregar el turno a su calendario | Link `calendar.google.com/calendar/render?action=TEMPLATE…` y `.ics` adjunto | Sí, sin OAuth |
| WhatsApp Business API | Recordatorios y confirmación | REST | No (post-MVP) |
| Mercado Pago, ARCA, PUCO, ReNaPDiS | Cobros, facturación, cobertura, recetas | REST / SOAP | No (post-MVP) |

## API REST (resumen)

Prefijo `/api`. Todas las rutas requieren autenticación salvo las indicadas en [03 · Rutas públicas](03_actores_y_roles.md#rutas-públicas).

| Recurso | Endpoints principales | Roles |
|---|---|---|
| Profesionales | `GET/POST /profesionales`, `PATCH /profesionales/:id` | profesional (alta) · recepción (lectura) |
| Boxes | `GET/POST /boxes`, `PATCH /boxes/:id` | profesional (alta) · recepción (lectura) |
| Prestaciones | `GET/POST /prestaciones`, `PATCH /prestaciones/:id` | profesional (precio y duración) · recepción (lectura sin precio) |
| Horarios y bloqueos | `GET/POST /profesionales/:id/horarios`, `POST /bloqueos`, `DELETE /bloqueos/:id` | profesional |
| Agenda | `GET /agenda?desde&hasta&profesionalId&boxId` | profesional, recepción |
| Turnos | `POST /turnos`, `PATCH /turnos/:id/reprogramar`, `POST /turnos/:id/cancelar`, `POST /turnos/:id/estado` | profesional, recepción |
| Cuenta del paciente | `POST /public/pacientes/registro`, `POST /public/login` | público |
| Reserva online | `GET /public/disponibilidad`, `POST /paciente/turnos`, `GET /paciente/turnos`, `POST /paciente/turnos/:id/cancelar`, `PATCH /paciente/turnos/:id/reprogramar`, `GET /paciente/turnos/:id/calendario.ics` | paciente autenticado (solo sus turnos) |
| Ganancias | `GET /profesionales/:id/ganancias?desde&hasta` | solo el profesional dueño |
| Clínica | `GET/POST /pacientes/:id/historia`, `GET/PUT /pacientes/:id/odontograma` | solo profesional |
| Auditoría | `GET /turnos/:id/auditoria` | profesional |

Errores de negocio: `409 Conflict` con un código estable (por ejemplo `SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `FUERA_DE_GRILLA`, `PLAZO_VENCIDO`) para que los tests verifiquen el motivo exacto.
