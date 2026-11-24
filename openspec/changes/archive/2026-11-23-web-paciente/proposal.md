# Proposal — `C-14 web-paciente`

## Why

El backend ya expone todo el flujo de reserva online y autogestión del paciente (`C-11`), el perfil editable del paciente (`C-04`) y el generador de calendario `.ics`/Google Calendar (`C-06`), mientras que `C-12 web-base` dejó montado el shell autenticado de **Clínica Dental Alvear** con tres vistas de marcador de posición en el menú del paciente (*Reservar turno*, *Mis turnos* y *Mis datos*).

`C-14 web-paciente` completa la fase 4 del proyecto entregando las pantallas operativas reales del rol `paciente` dentro de `web/src/pages/paciente/`, alineadas al design system aprobado (revisión 2) y a las convenciones adoptadas en `C-13 web-recepcion` y `C-15 web-profesional`.

## What Changes

- **Nuevo módulo UI en `web/src/pages/paciente/`**, descubierto automáticamente por `web/src/main.tsx` mediante `export const routes: RouteObject[]`, protegido por `GuardiaPaciente` (solo rol `paciente`, cero fetches para otros roles) y con `ITEMS_PACIENTE` pasado como `itemsExtra` a `AppLayout` sin editar `web/src/base/menu.ts`.
- **Reservar turno** (`/paciente/reservar`, `ReservarPage.tsx`):
  - Lista únicamente prestaciones activas con reserva online habilitada (`GET /api/public/prestaciones`, sin precios).
  - Permite elegir fecha (con atajos y botón "Probar el día siguiente") y profesional opcional, consultando `GET /api/public/disponibilidad` y agrupando los huecos libres en **Mañana** y **Tarde**.
  - Reserva el hueco seleccionado mediante `POST /api/paciente/turnos` y muestra la pantalla de **confirmación** con bloque de fecha, botón **Agregar a Google Calendar** y descarga de archivo **`.ics`** (`GET /api/paciente/turnos/:id/calendario.ics`).
  - Si otro paciente o recepción tomó el hueco instantes antes (`409 SOLAPAMIENTO_PROFESIONAL` / `SOLAPAMIENTO_BOX`), muestra el error legible, recarga los huecos disponibles y ofrece elegir otro sin perder la selección de prestación ni fecha.
- **Mis turnos** (`/paciente/turnos`, `MisTurnosPage.tsx`):
  - Consulta los turnos propios (`GET /api/paciente/turnos`), separados en **Próximos turnos** e **Historial**, con bloque de fecha calendario, estado (`BadgeEstadoTurno`), profesional, box, botón **Agregar a Google Calendar** y descarga **`.ics`**.
  - Muestra el aviso permanente de anticipación mínima de **24 horas** (`RN-RE-02`).
  - Permite **cancelar** (con confirmación explícita vía `POST /api/paciente/turnos/:id/cancelar`) y navegar a **reprogramar** cuando el turno está activo y faltan **24 horas o más** (borde exacto `>= 24 h` habilitado). Cuando faltan menos de 24 horas, o si el backend responde `409 PLAZO_VENCIDO`, las acciones de cancelar y reprogramar quedan **deshabilitadas** con explicación clara.
- **Reprogramar turno** (`/paciente/turnos/:id/reprogramar`, `ReprogramarTurnoPage.tsx`):
  - Muestra el horario actual (tachado) y permite elegir un nuevo hueco libre con el mismo `SelectorHuecosPaciente`, ejecutando `PATCH /api/paciente/turnos/:id/reprogramar`. Maneja `409 SOLAPAMIENTO_*` recargando huecos y deshabilita la confirmación ante `PLAZO_VENCIDO`.
- **Mis datos personales** (`/paciente/datos`, `MisDatosPage.tsx`):
  - Consulta y edita los datos permitidos (`GET`/`PATCH /api/paciente/datos`: nombre, apellido, teléfono, obra social, plan y nro. de afiliado), manteniendo DNI y correo electrónico en solo lectura.
- **Confidencialidad y privacidad**: ninguna pantalla muestra precios ni importes (`RN-RO-01`), se usa siempre la terminología **box** (nunca "sillón") y el 100 % de los ejemplos, mockups y tests usan datos ficticios (`RN-DA-01`).
- **Tres mockups HTML responsive** (`390×844` y `1440×900`) en `openspec/changes/web-paciente/mockups/`: `disponibilidad.html`, `confirmacion.html` y `mis-turnos.html` (incluyendo un turno con plazo vencido).

## Capabilities

### New Capabilities
- `web-paciente`: interfaz web del paciente para elegir prestación, consultar huecos libres, reservar turnos online, agregar a Google Calendar / descargar `.ics`, consultar "Mis turnos", cancelar o reprogramar respetando la regla de 24 horas y gestionar sus datos personales, sin mostrar precios.

### Modified Capabilities
<!-- Ninguna: consume las capabilities existentes del backend (C-04, C-06, C-11) y web-base (C-12) sin modificar contratos. -->

## Impact

- **Archivos creados/editados**: únicamente `web/src/pages/paciente/`, `openspec/changes/web-paciente/` (incluidos los 3 mockups HTML) y la fila final en `evidencias/bitacora-decisiones.md`.
- **Archivos congelados intactos**: no se modifican `web/src/base/`, `web/src/main.tsx`, `design-system/`, `src/`, `tests/`, `package.json`, `CHANGES.md`, `AGENTS.md` ni `CLAUDE.md`. EP quitará `proximamente: true` del menú de paciente en `web/src/base/menu.ts` al integrar el PR.
- **Dependencias nuevas**: ninguna (reutiliza React 19, React Router, Vitest y Testing Library ya provistos por `C-12`).
