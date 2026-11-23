# Design

## Context

`C-01` congeló `src/app.ts` y `src/shared/`:
- `src/app.ts` importa `{ crearNotificador } from './modules/notificaciones/adapter'` y lo invoca sin argumentos (`crearNotificador()`).
- `src/shared/puertos.ts` define `Notificador { enviar(mensaje: MensajeEmail): Promise<void> }`, `MensajeEmail { para, asunto, texto, html?, adjuntos? }` y `Adjunto { nombre, contenido, tipo }`.
- `src/shared/config.ts` expone `APP_TZ` (`America/Argentina/Mendoza` por defecto) y `src/shared/zona.ts` expone `enZonaConsultorio(instante, tz)`.
- `tests/plataforma/shared.test.ts` prueba que `crearNotificador()` sin `.env` almacena el mensaje en `notificador.bandeja`.
- `package.json` ya incluye `nodemailer@10.6.1` y `@types/nodemailer@8.0.2`.

Además, este módulo será consumido directamente por:
- **`C-02` (`crear-turno-sin-solapamientos`)**: al crear un turno presencial/profesional.
- **`C-10` (`reprogramar-turno`)**: al reprogramar un turno existente.
- **`C-11` (`reserva-y-autogestion-paciente`)**: al reservar online (`origen = 'online'`), al reprogramar un turno desde la cuenta del paciente y al servir `GET /api/paciente/turnos/:id/calendario.ics` usando `generarIcs`.

## Goals / Non-Goals

**Goals:**
- Generar emails de confirmación claros en español con fecha y hora en `APP_TZ`, profesional, box y prestación, garantizando que **nunca** aparezca el precio (`RN-NO-01`, `RN-NO-03`).
- Generar links `"Agregar a Google Calendar"` sin OAuth (`DD-06`) y archivos `.ics` válidos según RFC 5545 escritos a mano, sin nuevas dependencias.
- Soportar tanto alta (`creado`) como reprogramación (`reprogramado`) manteniendo el mismo `UID` de evento con `SEQUENCE` incremental para que el calendario del paciente actualice el turno en vez de duplicarlo.
- Proveer transporte SMTP con `nodemailer` y outbox en memoria para tests, con garantía de que un fallo SMTP nunca lance excepción ni revierta el turno (`RN-NO-02`).
- Mantener 100 % de compatibilidad con `src/app.ts` y `tests/plataforma/shared.test.ts` **sin editar ningún archivo fuera de `src/modules/notificaciones/` y `tests/notificaciones/`**.
- Mantener el dominio 100 % puro (regla dura 9): sin `Date.now()`, sin `new Date()` sin argumentos, sin `process.env`, sin `nodemailer` ni Fastify dentro de `dominio/`.

**Non-Goals:**
- Sincronización OAuth con la cuenta de Google del profesional o del paciente (`DD-06`, fuera de alcance v1.0).
- Email al cancelar un turno (PA-08, supuesto por defecto documentado en `C-05`: en el MVP no se envía).
- Cola persistente o worker de reintentos automáticos en background (en el MVP el fallo queda registrado en memoria/log para auditoría y reintento manual/posterior).
- Rutas HTTP propias (`routes.ts`): `GET /api/paciente/turnos/:id/calendario.ics` corresponde a `C-11`.
- WhatsApp o recordatorios programados (fuera de alcance v1.0).

## Decisions

### D1. Estructura hexagonal dentro de `src/modules/notificaciones/`
```text
src/modules/notificaciones/
├── dominio/
│   ├── tipos.ts          # DatosCalendario, DatosConfirmacionTurno, TipoNotificacionTurno
│   ├── calendario.ts     # generarLinkGoogleCalendar(), generarIcs() (RFC 5545 puro)
│   └── confirmacion.ts   # armarEmailConfirmacion() (texto + HTML escapado + adjunto .ics, sin precio)
├── aplicacion/
│   └── enviar-confirmacion.ts  # enviarConfirmacionTurno({ notificador, clock, zonaHoraria? }, datos)
├── adapter.ts            # crearNotificador(), crearNotificadorEnMemoria(), crearNotificadorSmtp()
└── index.ts              # Barrel público para C-02, C-10 y C-11
```
El dominio solo importa tipos de `src/shared/` y `enZonaConsultorio` (puro cuando recibe `tz` explícito). Nunca lee `process.env`, nunca llama a `Date.now()` / `new Date()`, ni importa `nodemailer`.

### D2. Tipos desacoplados y blindaje estructural contra fuga de precios (`RN-NO-03`)
`DatosCalendario` y `DatosConfirmacionTurno` reciben subconjuntos mínimos de las entidades de `src/shared/entidades.ts`:
- `turno: { id: string; inicio: Date; fin: Date; creadoEn?: Date }`
- `paciente: { nombre: string; apellido: string; email: string }`
- `profesional: { nombre: string }`
- `box: { nombre: string }`
- `prestacion: { nombre: string; duracionMin?: number }`
- `tipo?: 'creado' | 'reprogramado'` (por defecto `'creado'`)
- `consultorio?: string` (por defecto `'Consultorio Odontológico'`)

Por tipado estructural de TypeScript, `C-02`, `C-10` y `C-11` pueden pasar directamente las entidades `Turno`, `Paciente`, `Profesional`, `Box` y `Prestacion` obtenidas de `repos`, y aun cuando `Turno` tenga `precioAlReservar` y `Prestacion` tenga `precio`, ninguna función de `notificaciones` los accede ni serializa objetos completos.

### D3. Google Calendar sin OAuth y archivo `.ics` RFC 5545 a mano (`DD-06`)
- **Fechas UTC deterministas:** se formatea `YYYYMMDDTHHMMSSZ` usando exclusivamente `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`, `getUTCHours()`, `getUTCMinutes()` y `getUTCSeconds()`, evitando cualquier dependencia de la zona horaria del sistema operativo.
- **Validación de intervalo:** tanto `generarLinkGoogleCalendar` como `generarIcs` validan `fin.getTime() > inicio.getTime()` (y fechas válidas `!Number.isNaN(...)`); si el intervalo es inválido lanzan `RangeError` en dominio para no producir enlaces ni `.ics` corruptos.
- **Link de Google Calendar:**
  - Base: `https://calendar.google.com/calendar/render`
  - Parámetros (`URLSearchParams`): `action=TEMPLATE`, `text=<Prestación> - <Profesional>`, `dates=<inicioUTC>/<finUTC>`, `details` (prestación, profesional, box, paciente; nunca precio), `location=<Box> - <Consultorio>`.
- **Archivo `.ics` (RFC 5545):**
  - Saltos de línea `CRLF` (`\r\n`) y terminación con `\r\n`.
  - `PRODID:-//Turnos Odontologia//Agenda//ES`, `VERSION:2.0`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`.
  - `UID`: `turno-${turno.id}@turnos-odontologia.local` (estable entre alta y reprogramación).
  - `SEQUENCE`: `0` para `'creado'`, `1` para `'reprogramado'` (permite sobrescribir/actualizar el evento al reprogramar).
  - `DTSTAMP`: usa `dtstamp` inyectado (en aplicación viene de `clock.ahora()`). Si un llamador invoca `generarIcs(datos)` sin segundo parámetro, usa `datos.turno.creadoEn ?? datos.turno.inicio` como fallback determinista, sin invocar nunca `new Date()` ni `Date.now()` en dominio (regla dura 9).
  - **Escapado RFC 5545** en `SUMMARY`, `DESCRIPTION` y `LOCATION`: `\` → `\\`, `;` → `\;`, `,` → `\,`, `\r\n`/`\n` → `\\n`.
  - **Line folding RFC 5545:** toda línea que supere 75 octetos UTF-8 se pliega insertando `\r\n ` sin partir secuencias multibyte UTF-8.

### D4. Formato del email en zona horaria del consultorio (`DD-08`) y escape HTML
- La fecha y hora visibles en el email se calculan con `enZonaConsultorio(turno.inicio, zonaHoraria)` y `enZonaConsultorio(turno.fin, zonaHoraria)` (por defecto `APP_TZ` inyectado desde `aplicacion/`). Formato legible en español: `DD/MM/YYYY` y `HH:mm a HH:mm`.
- El `MensajeEmail` incluye:
  - `para`: `paciente.email`
  - `asunto`: `"Confirmación de turno - <Prestación> (<DD/MM/YYYY> <HH:mm>)"` o `"Turno reprogramado - <Prestación> (<DD/MM/YYYY> <HH:mm>)"`
  - `texto`: versión texto plano completa con datos del turno (sin precio) y el link de Google Calendar
  - `html`: versión HTML limpia con todos los campos dinámicos escapados (`&`, `<`, `>`, `"`, `'`) y el botón/enlace `"Agregar a Google Calendar"`
  - `adjuntos`: `[{ nombre: 'turno.ics', contenido: ics, tipo: 'text/calendar; charset=utf-8; method=PUBLISH' }]`

### D5. Adaptador dual (outbox en memoria / SMTP `nodemailer`) y tolerancia a fallos (`RN-NO-02`)
- `adapter.ts` exporta:
  - `NotificadorConBandeja`: extiende `Notificador` con `readonly bandeja: MensajeEmail[]` y `readonly fallos: FalloEnvio[]`.
  - `crearNotificadorEnMemoria()`: guarda `structuredClone(mensaje)` en `bandeja`.
  - `crearNotificadorSmtp(opciones)`: usa `nodemailer.createTransport(...)` (o un `transporte` inyectable para tests sin red real) y mapea cada `Adjunto` `{ nombre, contenido, tipo }` → `{ filename, content, contentType }`.
  - `crearNotificador(opciones?)`: firma compatible con `src/app.ts` (`crearNotificador()` sin argumentos).
    - Si se provee `opciones?.transporte` o `opciones?.smtp`, o si `process.env.SMTP_HOST` está definido y no vacío, instancia el adaptador SMTP usando `SMTP_HOST`, `SMTP_PORT` (default `1025`), `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM` (default `'turnos@example.com'`).
    - Si no hay `SMTP_HOST` ni configuración explícita (por ejemplo durante `npm test` sin `.env`), opera como outbox en memoria. Así `tests/plataforma/shared.test.ts` sigue pasando en verde sin tocarlo.
- **Cifrado obligatorio en SMTP (revisión PR #3):**
  - Puerto `465`: `secure: true`, `requireTLS: false` (TLS implícito desde el inicio).
  - Cualquier otro puerto: `secure: false`, `requireTLS: true` (Nodemailer exige `STARTTLS` y falla si el servidor no lo ofrece, evitando transmisión en claro de correos o credenciales).
  - Excepción explícita solo para pruebas locales sin TLS: `SMTP_ALLOW_INSECURE_LOCAL=true` **únicamente** cuando `SMTP_HOST` es un host loopback (`localhost`, `127.0.0.1` o `::1`). Si se define esa variable contra un host remoto, se ignora y se mantiene `requireTLS: true`.
- **Manejo de fallos (`RN-NO-02`):** en modo SMTP, `sendMail` corre dentro de `try/catch`. Si falla, captura el error como `unknown`, extrae un mensaje seguro sin credenciales, lo agrega a `fallos[]`, invoca `await onError(fallo)` (por defecto `console.error`) dentro de su propio `try/catch` para aislar también cualquier error síncrono o asíncrono del callback, y **resuelve sin lanzar excepción**.

### D6. Uso desde `C-02`, `C-10` y `C-11` (reserva online)
- En `C-02` (alta) y `C-11` (reserva online):
  ```ts
  await enviarConfirmacionTurno(
    { notificador: app.deps.notificador, clock: app.deps.clock },
    { turno, paciente, profesional, box, prestacion, tipo: 'creado' },
  );
  ```
- En `C-10` y `C-11` (reprogramación): misma llamada con `tipo: 'reprogramado'`.
- En `C-11` (`GET /api/paciente/turnos/:id/calendario.ics`):
  ```ts
  const ics = generarIcs({ turno, paciente, profesional, box, prestacion }, app.deps.clock.ahora());
  ```

## Risks / Trade-offs

- [Fallo SMTP silencioso para el llamador por `RN-NO-02`] → Mitigado exponiendo `fallos[]` y hook `onError` para trazabilidad y futura cola de reintento, sin comprometer la atomicidad del turno.
- [`C-02`, `C-10` o `C-11` podrían llamar directamente a `app.deps.notificador.enviar(...)` sin pasar por `enviarConfirmacionTurno`] → `adapter.ts` implementa `Notificador` directamente, así que ambos caminos funcionan y son igualmente tolerantes a fallos SMTP.
- [Diferencias en el nombre del parámetro `consultorio` cuando exista nombre definitivo en el design system] → Se deja parámetro opcional `consultorio` con valor por defecto `'Consultorio Odontológico'`, fácil de parametrizar luego sin romper firmas.
- [Múltiples reprogramaciones del mismo turno] → `sequence` opcional permite pasar un número mayor si se necesita en el futuro; por defecto usa `0` (`creado`) y `1` (`reprogramado`).

## Migration Plan

No requiere migración de datos ni cambios en variables de entorno existentes (`.env.example` ya documenta `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` y `APP_TZ`). Reemplaza `src/modules/notificaciones/adapter.ts` de forma retrocompatible con `C-01`.

## UI Mockups

- Design system revision: 1
- Decision: no (no UI). `C-06` es un módulo puramente backend (dominio, aplicación y adaptador SMTP/outbox).
- Date: 2026-11-22

## Open Questions

- **Nombre del consultorio en el email y el evento de calendario**: por defecto `'Consultorio Odontológico'` (parametrizable por opción `consultorio`). Confirmar si se prefiere otro texto o dejarlo así hasta que se cierre el branding del design system.
- **Modo por defecto de `crearNotificador()` sin `SMTP_HOST`**: se propone outbox en memoria cuando `SMTP_HOST` no está seteado (mantiene `npm test` sin servicios externos ni tocar `tests/plataforma/shared.test.ts`), y SMTP real apenas se define `SMTP_HOST`. Confirmar con Lucas antes de `apply`.
- **PA-08 (email al cancelar)**: fuera de `C-06`, siguiendo el supuesto por defecto documentado en `CHANGES.md` (`C-05`).
