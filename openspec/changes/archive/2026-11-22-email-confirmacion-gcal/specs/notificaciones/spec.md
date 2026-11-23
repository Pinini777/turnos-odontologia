# Spec Delta

## Purpose

Notificaciones de confirmación de turno para el paciente (alta presencial, reserva online y reprogramación): armado del correo sin precio, enlace "Agregar a Google Calendar" sin OAuth, generación manual de archivo `.ics` (RFC 5545) y envío por SMTP con `nodemailer` (o outbox en memoria para tests) tolerante a fallos (`US-030`, `F-05`, `RN-NO-01` a `RN-NO-03`, `DD-06`).

## ADDED Requirements

### Requirement: Contenido del email de confirmación de turno
Al crear o reprogramar un turno, el módulo SHALL construir un `MensajeEmail` dirigido al email del paciente con la fecha y hora en la zona del consultorio (`APP_TZ`), el nombre del profesional, el nombre del box, el nombre de la prestación, el link "Agregar a Google Calendar" y el archivo `turno.ics` adjunto (`RN-NO-01`, `US-030`).

#### Scenario: Email de confirmación al crear un turno (flujo feliz)
- **WHEN** se arma el email de confirmación para un turno creado (`2026-11-23T12:00:00Z` a `2026-11-23T12:30:00Z`, Dra. Ana Pérez, Box 1, Consulta, Paciente Ficticio Uno `paciente1@example.com`) en zona `America/Argentina/Mendoza`
- **THEN** el `MensajeEmail` va dirigido a `paciente1@example.com`, indica en `asunto`, `texto` y `html` la fecha `23/11/2026`, horario `09:00` a `09:30`, "Dra. Ana Pérez", "Box 1" y "Consulta", incluye el link de Google Calendar y trae un adjunto `turno.ics` de tipo `text/calendar`

#### Scenario: Email de confirmación al reprogramar un turno (integración con C-10 y C-11)
- **WHEN** se arma el email con `tipo: 'reprogramado'` para el mismo turno movido a `2026-11-23T13:00:00Z`–`2026-11-23T13:30:00Z`
- **THEN** el `asunto` y el cuerpo reflejan que el turno fue reprogramado con el nuevo horario `10:00` a `10:30`, y el adjunto `turno.ics` conserva el mismo `UID` del turno con `SEQUENCE:1`

#### Scenario: Escape de caracteres HTML en los datos del turno (borde)
- **WHEN** alguno de los campos textuales (por ejemplo, el nombre de una prestación o del paciente) contiene `<script>` o `&`
- **THEN** el cuerpo `html` escapa esos caracteres como entidades HTML seguras (`&lt;`, `&gt;`, `&amp;`) sin ejecutar ni inyectar etiquetas

### Requirement: Ausencia total de precios en notificaciones
El email de confirmación (asunto, texto plano y HTML), el link de Google Calendar y el archivo `.ics` SHALL omitir por completo el precio de la prestación y `precioAlReservar` (`RN-NO-03`).

#### Scenario: Entidades con precio no filtran monto en ninguna salida
- **WHEN** se arma la confirmación, el link de Google Calendar y el `.ics` pasando una prestación con `precio: 15000` y un turno con `precioAlReservar: 15000`
- **THEN** ni `asunto`, ni `texto`, ni `html`, ni el link de Google Calendar, ni el contenido del `.ics` contienen `15000`, `15.000`, `$` ni la palabra `precio`

### Requirement: Link "Agregar a Google Calendar" sin OAuth
El módulo SHALL generar un enlace directo de Google Calendar (`https://calendar.google.com/calendar/render`) con `action=TEMPLATE`, título, fechas de inicio y fin en UTC (`YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ`), detalle del turno (sin precio) y ubicación del box (`DD-06`, `RN-NO-01`).

#### Scenario: Generación de link con fechas en UTC (flujo feliz)
- **WHEN** se genera el link para un turno de `2026-11-23T12:00:00Z` a `2026-11-23T12:30:00Z` con Dra. Ana Pérez, Box 1 y Consulta
- **THEN** la URL apunta a `https://calendar.google.com/calendar/render` con `action=TEMPLATE`, `dates=20261123T120000Z/20261123T123000Z`, `text` con prestación y profesional, `details` con profesional, box y prestación (sin precio) y `location` con "Box 1"

#### Scenario: Turno nocturno que cambia de día al convertir a UTC (borde)
- **WHEN** se genera el link para un turno que comienza a las `22:00` y termina a las `22:30` en `America/Argentina/Mendoza` (`2026-11-24T01:00:00Z` a `2026-11-24T01:30:00Z`)
- **THEN** el parámetro `dates` es exactamente `20261124T010000Z/20261124T013000Z`

### Requirement: Generación manual de archivo `.ics` según RFC 5545
La función `generarIcs` SHALL producir un documento iCalendar (`VCALENDAR` 2.0) válido según RFC 5545 sin dependencias externas, utilizable tanto como adjunto del email como para descarga directa desde la autogestión del paciente (`C-11`, `DD-06`).

#### Scenario: Archivo `.ics` válido (flujo feliz)
- **WHEN** se llama a `generarIcs` para un turno con `inicio: 2026-11-23T12:00:00Z`, `fin: 2026-11-23T12:30:00Z` y `dtstamp: 2026-11-22T20:00:00Z`
- **THEN** el resultado usa saltos `\r\n`, empieza con `BEGIN:VCALENDAR` y termina con `END:VCALENDAR`, incluye `VERSION:2.0`, `PRODID`, `METHOD:PUBLISH`, un bloque `VEVENT` con `UID` basado en el id del turno, `DTSTAMP:20261122T200000Z`, `DTSTART:20261123T120000Z`, `DTEND:20261123T123000Z`, `SUMMARY`, `DESCRIPTION`, `LOCATION` y `STATUS:CONFIRMED`

#### Scenario: Escapado de caracteres especiales y doblado de líneas RFC 5545 (borde)
- **WHEN** los campos contienen comas, punto y coma, barras invertidas o superan 75 octetos UTF-8 en una línea
- **THEN** el `.ics` escapa `\`, `;`, `,` y saltos de línea según RFC 5545 y pliega las líneas largas con `\r\n ` para que ninguna línea física exceda 75 octetos

#### Scenario: Intervalo de turno inválido (error de negocio / invariante)
- **WHEN** se invoca `generarIcs` o `generarLinkGoogleCalendar` con `fin <= inicio`
- **THEN** la función rechaza la entrada lanzando un `RangeError` en lugar de emitir un evento corrupto

### Requirement: Envío por SMTP y outbox en memoria tolerante a fallos
El adaptador de `src/modules/notificaciones/adapter.ts` SHALL soportar envío real vía SMTP (`nodemailer`, usando `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) exigiendo conexión cifrada (TLS implícito en puerto `465` o `requireTLS: true` / STARTTLS obligatorio en otros puertos, salvo excepción explícita `SMTP_ALLOW_INSECURE_LOCAL=true` restringida a hosts loopback `localhost`/`127.0.0.1`/`::1`) y modo outbox en memoria para tests. Ante cualquier error del transporte SMTP —incluso si el callback `onError` también falla—, el adaptador SHALL registrar el fallo y resolver sin lanzar excepción para que el turno nunca se revierta (`RN-NO-02`, `RN-DA-02`).

#### Scenario: Outbox en memoria por defecto sin configuración SMTP
- **WHEN** se llama a `crearNotificador()` sin `SMTP_HOST` en el entorno y se invoca `enviar(mensaje)`
- **THEN** el mensaje queda almacenado en `bandeja` y no se intenta ninguna conexión de red

#### Scenario: Envío SMTP exitoso con adjunto `.ics`
- **WHEN** se configura el adaptador SMTP (con transporte inyectado o `SMTP_*`) y se invoca `enviar(mensaje)` con texto, HTML y adjunto `turno.ics`
- **THEN** llama al transporte con `from` igual a `MAIL_FROM`, `to`, `subject`, `text`, `html` y `attachments` mapeado con `filename: 'turno.ics'` y `contentType` de calendario, y registra el mensaje en `bandeja`

#### Scenario: Exigencia de cifrado TLS / STARTTLS y excepción explícita local
- **WHEN** se configura `SMTP_HOST` en un puerto distinto de `465` sin excepción explícita (o en un host no local aun con `SMTP_ALLOW_INSECURE_LOCAL=true`)
- **THEN** el transporte exige `requireTLS: true` (`secure: false`), en puerto `465` usa `secure: true` (`requireTLS: false`), y solo un host loopback (`localhost`, `127.0.0.1`, `::1`) con `SMTP_ALLOW_INSECURE_LOCAL=true` puede desactivar `requireTLS`

#### Scenario: Fallo de SMTP no lanza excepción ni revierte el turno (`RN-NO-02`)
- **WHEN** el transporte SMTP rechaza el envío con un error de conexión o autenticación
- **THEN** `notificador.enviar(mensaje)` resuelve sin lanzar excepción, registra el error en `fallos` (sin exponer contraseñas) e invoca el callback `onError`

#### Scenario: Doble fallo (SMTP y `onError` fallan simultáneamente)
- **WHEN** el transporte SMTP rechaza el envío y además el callback `onError` lanza una excepción síncrona o rechaza de forma asíncrona
- **THEN** `notificador.enviar(mensaje)` aísla el error de `onError`, resuelve sin rechazar y conserva el registro del fallo en `fallos`

### Requirement: Caso de uso de envío de confirmación para alta y reserva online
El caso de uso `enviarConfirmacionTurno` SHALL orquestar el armado del email (inyectando la hora actual desde `Clock` y la zona del consultorio) y su despacho al `Notificador`, de forma lista para ser llamada por `C-02` (alta), `C-10` (reprogramación) y `C-11` (reserva y reprogramación online).

#### Scenario: Despacho completo con reloj inyectable (flujo feliz)
- **WHEN** un módulo consumidor ejecuta `enviarConfirmacionTurno({ notificador, clock: FixedClock('2026-11-22T20:00:00Z') }, datosTurno)`
- **THEN** se despacha al `notificador` el correo completo sin precio, con link de Google Calendar y adjunto `turno.ics` cuyo `DTSTAMP` coincide exactamente con el reloj fijo

#### Scenario: Despacho resiliente ante fallo de SMTP
- **WHEN** `enviarConfirmacionTurno` corre con un notificador SMTP cuyo transporte falla
- **THEN** el caso de uso completa normalmente sin lanzar excepción
