# Design — `C-14 web-paciente`

## Context

`C-12 web-base` dejó en `main` el shell autenticado (`AppLayout`, `useSesion`, `apiConsultorio`, `ErrorApi`, `AlertaErrorNegocio`, `Boton`, `Campo`, `BadgeEstadoTurno`, `AvatarIniciales`, `EstadoVacio`, `Skeleton`, `CLINICA`), el autoload de rutas en `web/src/main.tsx` (`import.meta.glob('./pages/*/routes.tsx')`) y el design system revisión 2 aprobado por EP (**Clínica Dental Alvear**, `design-system/tokens.css`).

Los endpoints necesarios ya existen y están probados en `main`:
- `GET /api/public/prestaciones` (`C-03`): prestaciones activas con `reservableOnline: true`, sin `precio`.
- `GET /api/public/disponibilidad?prestacionId&desde&hasta[&profesionalId]` (`C-11`): huecos libres `{ inicio, fin, profesionalId, boxIds }` en grilla de 15 min, máximo 31 días por consulta, sin precios ni datos de otros pacientes.
- `POST /api/paciente/turnos` (`C-11`): crea el turno online (`boxId` opcional, asignación automática del primer box libre) y responde `409 SOLAPAMIENTO_PROFESIONAL` / `SOLAPAMIENTO_BOX` / `EN_BLOQUEO` / `EN_EL_PASADO` si el hueco ya no está disponible.
- `GET /api/paciente/turnos` (`C-11`): lista solo los turnos del paciente autenticado ordenados por `inicio` ascendente (sin `precio` ni `precioAlReservar`).
- `GET /api/paciente/turnos/:id/calendario.ics` (`C-11` + `C-06`): devuelve `200 text/calendar; charset=utf-8` (RFC 5545) con `Content-Disposition: attachment; filename="turno-<id>.ics"`.
- `POST /api/paciente/turnos/:id/cancelar` (`C-11` + `C-05`) y `PATCH /api/paciente/turnos/:id/reprogramar` (`C-11` + `C-10`): aplican la regla de 24 horas (`ahora > inicio - 24 h` → `409 PLAZO_VENCIDO`; exactamente 24 horas se permite).
- `GET` y `PATCH /api/paciente/datos` (`C-04`): consulta y edición del perfil del paciente autenticado.

Restricciones: regla dura 3 (solo `web/src/pages/paciente/` y `openspec/changes/web-paciente/`), regla 4 (nunca exponer precios), regla 6 (TypeScript `strict`, sin `any`), regla 8 (un test Vitest por escenario del spec), regla 9 (sin `Date.now()` / `new Date()` sin argumentos en el dominio puro) y política visual `system-and-mockups`.

## Goals / Non-Goals

**Goals:**
- Entregar las 4 vistas operativas del paciente (`/paciente/reservar`, `/paciente/turnos`, `/paciente/turnos/:id/reprogramar`, `/paciente/datos`) integradas visualmente con Clínica Dental Alvear y las convenciones de `C-13` y `C-15`.
- Garantizar recuperación clara ante conflictos `409` (recarga automática de huecos para elegir otro horario) y deshabilitación clara de cancelar/reprogramar cuando faltan menos de 24 horas o el servidor responde `409 PLAZO_VENCIDO`.
- Proveer botones funcionales de **Agregar a Google Calendar** y **Descargar .ics** tanto al confirmar una reserva como en cada turno activo de "Mis turnos".
- Mantener la lógica de ventanas de 24 h, fechas en `America/Argentina/Mendoza` (`-03:00`) y armado de URLs de Google Calendar en funciones puras testeables sin React.

**Non-Goals:**
- No editar `web/src/base/` (incluido `menu.ts` e `InicioPage.tsx`), `web/src/main.tsx`, `package.json` ni endpoints del backend.
- No instalar librerías externas; todas las animaciones (60 fps, 150–280 ms, `transform`/`opacity`, `prefers-reduced-motion`) e íconos SVG se implementan en CSS y TSX propios.
- No exponer precios, ganancias, agenda de otros pacientes ni historia clínica.

## Architecture (`web/src/pages/paciente/`)

```text
web/src/pages/paciente/
├── routes.tsx                 # export const routes: RouteObject[] (/paciente, reservar, turnos, reprogramar, datos)
├── GuardiaPaciente.tsx        # RBAC guard (sin sesión -> /login; otro rol -> SIN_PERMISO sin fetches)
├── menuPaciente.ts            # ITEMS_PACIENTE (itemsExtra para AppLayout sin editar web/src/base/menu.ts)
├── apiPaciente.ts             # Cliente tipado sobre apiConsultorio + descarga autenticada de .ics (Blob)
├── dominio.ts                 # Puras: ventana 24 h con reloj inyectable, Google Calendar URL sin precios,
│                              #   rangos -03:00, agrupación Mañana/Tarde, nombres de profesional/box sin 403
├── SelectorHuecosPaciente.tsx # Selector reutilizable para reservar y reprogramar (recarga automática ante 409)
├── ReservarPage.tsx           # /paciente/reservar (prestación -> fecha/huecos -> confirmar -> confirmación + GCal/.ics)
├── MisTurnosPage.tsx          # /paciente/turnos (próximos + historial, aviso 24 h, cancelar, GCal, .ics, PLAZO_VENCIDO)
├── ReprogramarTurnoPage.tsx   # /paciente/turnos/:id/reprogramar (antes tachado -> nuevo hueco, 409 y PLAZO_VENCIDO)
├── MisDatosPage.tsx           # /paciente/datos (DNI/email solo lectura + edición vía PATCH /api/paciente/datos)
├── paciente.css               # Estilos responsive (1440×900 y 390×844, cero scroll horizontal, tokens rev. 2)
├── dominio.test.ts            # Tests unitarios de dominio puro (24 h exacta/vencida, GCal sin precios, rangos)
└── paciente.test.tsx          # Tests de componentes (1+ it por cada escenario del spec + test sin-precios)
```

## Decisions

### D1 — Rutas propias, guardia RBAC y menú sin tocar `web/src/base/menu.ts`
- `routes.tsx` registra:
  - `/paciente` → redirección a `/paciente/reservar`
  - `/paciente/reservar` → `ReservarPage`
  - `/paciente/turnos` → `MisTurnosPage`
  - `/paciente/turnos/:id/reprogramar` → `ReprogramarTurnoPage`
  - `/paciente/datos` → `MisDatosPage`
- `GuardiaPaciente` valida `sesion` antes de montar efectos: sin sesión redirige a `/login`; con rol `profesional` o `recepcionista` renderiza `AppLayout` + `AlertaErrorNegocio` (`code="SIN_PERMISO"`) y un botón para volver a `/inicio`, garantizando cero llamadas a `/api/paciente/*`.
- `ITEMS_PACIENTE` repite los 3 ítems de `MENU_BASE` sin `proximamente` y se pasa como `itemsExtra` en cada página. Al mergear, EP quita `proximamente: true` en `web/src/base/menu.ts` igual que hizo con `C-13` y `C-15`.

### D2 — Selector de huecos reutilizable y recuperación ante `409`
- `SelectorHuecosPaciente` consulta `GET /api/public/disponibilidad` para el día elegido en zona `America/Argentina/Mendoza` (`YYYY-MM-DDT00:00:00-03:00` a `23:59:59-03:00`, respetando siempre el límite máximo de 31 días de `C-11`).
- Agrupa los huecos en **Mañana** (`< 13:00`) y **Tarde** (`>= 13:00`). Si un día no tiene huecos, ofrece el botón **"Probar el día siguiente"**.
- Recibe un contador `recarga`. Cuando `POST /api/paciente/turnos` o `PATCH /api/paciente/turnos/:id/reprogramar` devuelve `409` (`SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `EN_BLOQUEO` o `EN_EL_PASADO`), la página muestra `AlertaErrorNegocio`, limpia el hueco elegido e incrementa `recarga` para volver a pedir los huecos libres y ofrecer elegir otro de inmediato.

### D3 — Integración con Google Calendar y descarga autenticada de `.ics`
- **Google Calendar**: `generarLinkGoogleCalendarPaciente` en `dominio.ts` replica el formato de `C-06` (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ&details=...&location=...`), usando `CLINICA.nombre` + `CLINICA.direccion`, la prestación y el profesional, **sin incluir nunca precios ni montos**. Abre en nueva pestaña con `rel="noopener noreferrer"`.
- **Descarga `.ics`**: como `apiConsultorio` espera JSON, `descargarIcsTurno(turnoId)` en `apiPaciente.ts` realiza un `fetch` directo con el header `Authorization: Bearer <token>` (obtenido desde `obtenerSesionActual()`) contra `GET /api/paciente/turnos/:id/calendario.ics`, lee el texto `text/calendar`, crea un `Blob` (`text/calendar;charset=utf-8`) y dispara la descarga de `turno-<id>.ics`. Si responde `401`, limpia la sesión y lanza `ErrorApi(401, 'NO_AUTENTICADO')`.

### D4 — Regla de 24 horas y manejo defensivo de `PLAZO_VENCIDO`
- `estadoPlazoAutogestion(inicioIso, ahora)` en `dominio.ts` calcula `inicioMs - ahoraMs >= 24 * 60 * 60 * 1000` (24 horas exactas **habilitado**, `< 24 h` **bloqueado**), aceptando `ahora` inyectado (y `reloj` opcional en los componentes para pruebas deterministas, sin `Date.now()` dentro de `dominio.ts`).
- En `MisTurnosPage` y `ReprogramarTurnoPage`:
  - Siempre se muestra el aviso claro de anticipación mínima de 24 h (`RN-RE-02`).
  - Si un turno activo (`reservado` o `confirmado`) está a menos de 24 h, los botones **Cancelar turno** y **Reprogramar** se muestran deshabilitados (`disabled`) con la leyenda explicativa junto al turno.
  - Si el reloj del cliente estaba desfasado y el backend responde `409 PLAZO_VENCIDO`, la vista muestra `AlertaErrorNegocio` y marca ese turno en estado `plazoVencido` para deshabilitar inmediatamente la acción sin requerir recargar la página.

### D5 — Resolución de nombres de profesional y box sin llamar endpoints `403`
- Los endpoints `GET /api/profesionales` y `GET /api/boxes` están restringidos a `profesional` y `recepcionista` (`403` para `paciente`), mientras que `disponibilidad` y `GET /api/paciente/turnos` devuelven `profesionalId`, `boxId` y `prestacionId`.
- `prestacionId` se resuelve contra `GET /api/public/prestaciones` (con fallback legible `"Consulta odontológica"` si una prestación dejó de ser reservable online).
- `profesionalId` y `boxId` se resuelven con un mapa liviano de nombres del consultorio semilla (`Dra. Ana Pérez`, `Dr. Bruno Gómez`, `Box 1`, `Box 2`) y un fallback legible (`"Profesional asignado"` / `"Box asignado"`) para cualquier ID nuevo, evitando mostrar UUIDs crudos en la interfaz y sin hacer llamadas que devuelvan `403`.

### D6 — Confidencialidad de precios (`RN-RO-01`)
- Ningún tipo en `apiPaciente.ts` declara `precio` ni `precioAlReservar`.
- Ningún componente renderiza objetos completos ni formatea moneda.
- La suite de tests incluye una prueba dedicada que inyecta campos `precio` y `precioAlReservar` en las respuestas simuladas y comprueba que ni el importe ni el símbolo `$` aparezcan en el DOM.

### D7 — Accesibilidad, estética clínica y rendimiento
- Respeta los tokens de `design-system/tokens.css` (teal `#0E7490`, esmeralda `#059669`, porcelana `#F4F8F9`), micro-interacciones 60 fps (`transform`/`opacity`, `150ms–280ms`, `prefers-reduced-motion`) y layout responsive fluido en `1440×900` y `390×844` con cero scroll horizontal.
- Cero jerga técnica en la interfaz del paciente (no se mencionan códigos de change, endpoints ni "datos ficticios").
- Controles accesibles: `aria-pressed` en huecos y chips, `role="alert"` / `aria-live="polite"` para errores y confirmaciones, foco visible (`--focus-ring`) y labels asociados.

## Risks / Trade-offs

- [Profesionales o boxes creados dinámicamente después del seed no tienen endpoint público de nombres] → Se resuelve con el mapa de semilla + fallback legible ("Profesional asignado" / "Box asignado") sin tocar el backend ni disparar `403`.
- [El menú base en `/inicio` mantiene `proximamente: true` hasta el `chore(shared)` de EP] → Mitigado pasando `ITEMS_PACIENTE` vía `itemsExtra` en todas las páginas de `C-14`, idéntico a `C-13` y `C-15`.
- [Reprogramar no ofrece mover 15 minutos sobre el propio turno en el selector] → Límite conocido de `/api/public/disponibilidad` (igual que en `C-13`), aceptado para el MVP.

## UI Mockups

- Design system revision: 2 (`design-system/tokens.css`, `design-system/brand.js`, `design-system/assets/logo.svg`)
- Decision: yes — 2026-11-23
- Mockups: `openspec/changes/archive/2026-11-23-web-paciente/mockups/` (`disponibilidad.html`, `confirmacion.html`, `mis-turnos.html`, ver `mockups/README.md`)
- Preview: manual (390×844 y 1440×900, 2026-11-23)
- Approval: pending (pendiente de revisión de EP en PR)
