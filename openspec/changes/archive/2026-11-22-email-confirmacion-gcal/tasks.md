# Tasks

> TDD obligatorio (regla dura 8): en cada tarea con lógica se escribe primero el test en `tests/notificaciones/` y se lo ve fallar antes de implementar. Datos 100 % ficticios (`@example.com`, `SEED`).

## 1. Dominio puro: tipos, Google Calendar e `.ics` (RFC 5545)

- [x] 1.1 Definir `src/modules/notificaciones/dominio/tipos.ts` con `DatosCalendario`, `DatosConfirmacionTurno`, `TipoNotificacionTurno` y `OpcionesEmailConfirmacion` (compatibles estructuralmente con las entidades de `src/shared/entidades.ts`, sin requerir ni leer precios)
- [x] 1.2 (TDD) Escribir tests en `tests/notificaciones/calendario.test.ts` para `generarLinkGoogleCalendar`: flujo feliz con fechas UTC, borde de cambio de día en UTC (`22:00` Mendoza → día siguiente `01:00Z`), ausencia total de precio y error (`RangeError`) con `fin <= inicio`
- [x] 1.3 Implementar `generarLinkGoogleCalendar` en `src/modules/notificaciones/dominio/calendario.ts` y verificar tests en verde
- [x] 1.4 (TDD) Escribir tests en `tests/notificaciones/calendario.test.ts` para `generarIcs`: `.ics` RFC 5545 válido (`VCALENDAR`, `VEVENT`, `UID`, `DTSTAMP`/`DTSTART`/`DTEND` en UTC, `\r\n`), `SEQUENCE:0` vs `SEQUENCE:1` en reprogramación, escapado de `\`, `;`, `,` y `\n`, line folding `<= 75` octetos UTF-8, ausencia de precio y `RangeError` con `fin <= inicio`
- [x] 1.5 Implementar `generarIcs` en `src/modules/notificaciones/dominio/calendario.ts` (a mano, sin dependencias nuevas, sin `Date.now()` ni `new Date()`) y verificar tests en verde

## 2. Dominio puro: armado del email de confirmación (`RN-NO-01`, `RN-NO-03`)

- [x] 2.1 (TDD) Escribir tests en `tests/notificaciones/confirmacion.test.ts` para `armarEmailConfirmacion`: turno creado (fecha/hora en `APP_TZ`, profesional, box, prestación, link GCal y adjunto `turno.ics`), turno reprogramado, escape de caracteres HTML y verificación estricta de ausencia de precios (`precio` y `precioAlReservar`)
- [x] 2.2 Implementar `src/modules/notificaciones/dominio/confirmacion.ts` usando `enZonaConsultorio(fecha, tz)` y verificar tests en verde

## 3. Adaptador SMTP / outbox y caso de uso (`RN-NO-02`)

- [x] 3.1 (TDD) Escribir tests en `tests/notificaciones/adapter.test.ts`: `crearNotificador()` sin `SMTP_HOST` usa outbox en memoria; adaptador SMTP con transporte inyectado envía `from`, `to`, `subject`, `text`, `html` y adjunto `.ics`; fallo de SMTP NO lanza excepción, registra en `fallos` sin credenciales e invoca `onError`; lectura de variables `SMTP_*` / `MAIL_FROM`
- [x] 3.2 Reemplazar el stub `src/modules/notificaciones/adapter.ts` con la implementación dual (outbox en memoria + SMTP `nodemailer`), manteniendo compatibilidad exacta con `src/app.ts` y `tests/plataforma/shared.test.ts`
- [x] 3.3 (TDD) Escribir tests en `tests/notificaciones/enviar-confirmacion.test.ts` para `enviarConfirmacionTurno` con `FixedClock` (alta, reprogramación y resiliencia ante fallo SMTP)
- [x] 3.4 Implementar `src/modules/notificaciones/aplicacion/enviar-confirmacion.ts` y el barrel público `src/modules/notificaciones/index.ts`, y verificar tests en verde

## 4. Verificación integral y cierre en `dev-lucas`

- [x] 4.1 Correr `npm run typecheck`, `npm run lint` y `npm test` (toda la suite: `plataforma`, `configuracion`, `turnos-estados`, `notificaciones` y `web`) en verde
- [x] 4.2 Verificar cumplimiento de reglas duras: cero `any`, cero `@ts-ignore`, cero `Date.now()`/`new Date()` en `src/modules/notificaciones/dominio/`, cero archivos editados fuera del scope de `C-06`, cero datos reales o secretos
- [x] 4.3 Archivar el change con `openspec archive email-confirmacion-gcal` (actualizando `openspec/specs/notificaciones/spec.md`) y agregar la fila de `C-06` al final de `evidencias/bitacora-decisiones.md`
