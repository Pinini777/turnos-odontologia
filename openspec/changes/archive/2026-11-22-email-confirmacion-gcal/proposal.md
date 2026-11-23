# Proposal

## Why

Hoy `C-01` dejó solo un stub en `src/modules/notificaciones/adapter.ts` que acumula mensajes genéricos en memoria sin construir el contenido del correo, sin link de Google Calendar, sin archivo `.ics` y sin transporte SMTP tolerante a fallos. Para que los flujos de alta de turno (`C-02`), reprogramación (`C-10`) y reserva online / autogestión del paciente (`C-11`) cumplan `US-030`, `F-05` y `RN-NO-01` a `RN-NO-03`, es necesario implementar el módulo `notificaciones` completo, desacoplado y listo para integrarse en una línea con los demás módulos del equipo.

## What Changes

- **Dominio puro de calendario y confirmación (`src/modules/notificaciones/dominio/`):**
  - `generarLinkGoogleCalendar(datos)`: construye el enlace `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…` sin OAuth (`DD-06`), con fechas en UTC y sin precios.
  - `generarIcs(datos, dtstamp?)`: genera un archivo `.ics` válido según **RFC 5545**, escrito a mano y sin dependencias nuevas, con fechas UTC, `UID` estable por turno, `SEQUENCE` para distinguir creación (`0`) y reprogramación (`1`), escapado de caracteres especiales y doblado de líneas (`<= 75` octetos). Queda exportado para que `C-11` lo reutilice en `GET /api/paciente/turnos/:id/calendario.ics`.
  - `armarEmailConfirmacion(datos, opciones)`: construye el `MensajeEmail` (`para`, `asunto`, `texto`, `html` con escape HTML y botón a Google Calendar, más el `.ics` adjunto) con fecha y hora en la zona del consultorio (`APP_TZ`), profesional, box y prestación, **nunca el precio** (`RN-NO-03`). Soporta tanto alta (`creado`, presencial u online) como reprogramación (`reprogramado`).
- **Caso de uso de integración (`src/modules/notificaciones/aplicacion/`):**
  - `enviarConfirmacionTurno(deps, datos)`: orquesta el armado del correo (usando `Clock` inyectable y `APP_TZ`) y su despacho mediante `Notificador`, pensado para ser invocado directamente desde `C-02`, `C-10` y `C-11`.
- **Adaptador SMTP y outbox en memoria (`src/modules/notificaciones/adapter.ts`):**
  - Reemplaza el stub de `C-01` manteniendo la firma `crearNotificador()` sin argumentos obligatorios (sin editar `src/app.ts` ni romper `tests/plataforma/shared.test.ts`).
  - Cuando existe `SMTP_HOST` (o configuración/transporte explícito) envía mediante `nodemailer` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`); sin `SMTP_HOST` funciona como outbox en memoria para tests.
  - Tolerancia a fallos (`RN-NO-02`): si falla el envío SMTP, registra el error de forma segura (sin credenciales) y **no lanza excepción**, evitando revertir el turno.
- **Punto de entrada del módulo (`src/modules/notificaciones/index.ts`):** re-exporta funciones y tipos públicos para los módulos consumidores (`C-02`, `C-10`, `C-11`). No expone rutas HTTP propias (el endpoint de descarga `.ics` pertenece a `C-11`).

## Capabilities

### New Capabilities
- `notificaciones`: armado de emails de confirmación (alta y reprogramación) sin precio, generación de link "Agregar a Google Calendar" (sin OAuth) y archivo `.ics` (RFC 5545), caso de uso de envío y adaptador SMTP con `nodemailer` + outbox en memoria tolerante a fallos (`RN-NO-01` a `RN-NO-03`, `DD-06`).

### Modified Capabilities
<!-- Ninguna: no se modifica openspec/specs/plataforma/ durante la ola 1 para evitar conflictos entre PRs paralelos. -->

## Impact

- **Código nuevo / modificado:** `src/modules/notificaciones/{dominio,aplicacion}/`, `src/modules/notificaciones/adapter.ts`, `src/modules/notificaciones/index.ts` y `tests/notificaciones/`.
- **Dependencias:** depende de `C-01` (`fundacion-y-dominio-base`, mergeado en `main`). Usa `nodemailer` y `@types/nodemailer` ya instalados en `C-01`. Respeta congelamiento de `src/app.ts`, `src/shared/`, `package.json`, lockfile, `tsconfig*`, ESLint y Vitest.
- **Equipo:** desbloquea la integración de confirmaciones por email en `C-02` (`crear-turno-sin-solapamientos`), `C-10` (`reprogramar-turno`) y `C-11` (`reserva-y-autogestion-paciente`, tanto reserva/reprogramación online como descarga de `.ics`).
- **Governance:** **ALTO** (notificaciones). Lucas revisa y aprueba este spec antes de `apply`.
