# web-paciente Specification

## Purpose
Proveer la interfaz web de autogestión para el rol `paciente` en Clínica Dental Alvear: consulta de prestaciones reservables online y huecos libres, reserva de turnos con recuperación ante conflictos `409`, integración con Google Calendar y descarga `.ics`, visualización de "Mis turnos" con cancelación y reprogramación sujetas a la regla de 24 horas (`RN-RE-02`), y gestión de datos personales (`GET`/`PATCH /api/paciente/datos`), sin exponer precios ni datos de otros pacientes.

## Requirements

### Requirement: Protección de rutas por rol y navegación del paciente

Las pantallas bajo `/paciente/*` SHALL exigir una sesión activa con rol `paciente` y renderizar los ítems de navegación del paciente mediante `itemsExtra` de `AppLayout` sin modificar `web/src/base/menu.ts`.

#### Scenario: Usuario sin sesión es redirigido al login
- **WHEN** un visitante sin sesión accede a `/paciente/reservar`, `/paciente/turnos`, `/paciente/turnos/:id/reprogramar` o `/paciente/datos`
- **THEN** la aplicación redirige a `/login` sin invocar endpoints privados del paciente

#### Scenario: Usuario con rol profesional o recepcionista no puede operar pantallas de paciente
- **WHEN** un usuario autenticado con rol `recepcionista` o `profesional` navega a `/paciente/turnos`
- **THEN** se muestra una alerta `SIN_PERMISO` con acceso para volver a `/inicio` y no se ejecuta ningún pedido a `/api/paciente/*`

#### Scenario: Paciente autenticado navega entre sus secciones
- **WHEN** un usuario con rol `paciente` accede a cualquiera de sus pantallas
- **THEN** la barra lateral muestra activos los enlaces `Reservar turno` (`/paciente/reservar`), `Mis turnos` (`/paciente/turnos`) y `Mis datos` (`/paciente/datos`)

---

### Requirement: Selección de prestación y visualización de huecos libres

La pantalla de reserva (`/paciente/reservar`) SHALL consultar `GET /api/public/prestaciones` y `GET /api/public/disponibilidad` para mostrar únicamente prestaciones reservables online y huecos libres del día elegido agrupados por mañana y tarde.

#### Scenario: Elegir prestación y ver huecos disponibles agrupados por mañana y tarde
- **WHEN** el paciente abre `/paciente/reservar`, selecciona una prestación reservable online y un día con disponibilidad
- **THEN** la pantalla muestra los huecos libres devueltos por `GET /api/public/disponibilidad` separados en los grupos "Mañana" y "Tarde", permitiendo elegir un horario

#### Scenario: Día sin disponibilidad ofrece pasar al día siguiente
- **WHEN** `GET /api/public/disponibilidad` devuelve una lista vacía para la fecha elegida
- **THEN** se informa que no hay horarios libres para ese día y se ofrece el botón "Probar el día siguiente" que avanza la fecha y vuelve a consultar disponibilidad

---

### Requirement: Reserva online con confirmación, Google Calendar y descarga `.ics`

Al confirmar un hueco seleccionado, la pantalla SHALL enviar `POST /api/paciente/turnos` y, si la reserva tiene éxito, mostrar la pantalla de confirmación con el resumen del turno, el botón "Agregar a Google Calendar" y el botón "Descargar .ics". Si el hueco ya fue ocupado (`409`), SHALL informar el motivo y recargar los huecos para elegir otro.

#### Scenario: Reserva exitosa muestra confirmación con Google Calendar y descarga `.ics`
- **WHEN** el paciente selecciona un hueco libre y pulsa "Confirmar turno" y la API responde `201`
- **THEN** se muestra la vista de confirmación con fecha, horario, prestación, profesional, box, un enlace "Agregar a Google Calendar" apuntando a `calendar.google.com/calendar/render` sin precios y un botón "Descargar .ics" que solicita `GET /api/paciente/turnos/:id/calendario.ics` con token Bearer

#### Scenario: Si el hueco ya lo tomó otro paciente (`409`) se ofrece elegir otro horario
- **WHEN** el paciente confirma un hueco y la API responde `409` con código `SOLAPAMIENTO_PROFESIONAL` o `SOLAPAMIENTO_BOX`
- **THEN** se muestra el mensaje legible del conflicto, se mantiene la prestación y la fecha seleccionadas, se vuelve a consultar `GET /api/public/disponibilidad` y se ofrece elegir otro hueco disponible

---

### Requirement: Listado "Mis turnos" y restricción de 24 horas (`RN-RE-02`)

La pantalla `/paciente/turnos` SHALL listar los turnos del paciente (`GET /api/paciente/turnos`) con aviso visible de la anticipación mínima de 24 horas, acceso a Google Calendar y descarga `.ics`, y acciones de cancelar y reprogramar habilitadas solo para turnos activos (`reservado` o `confirmado`) cuyo inicio sea al menos 24 horas posterior a la hora actual.

#### Scenario: Ver próximos turnos propios con bloque de fecha, Google Calendar y `.ics`
- **WHEN** el paciente abre `/paciente/turnos` y tiene turnos activos a más de 24 horas
- **THEN** cada turno se muestra en una tarjeta con su bloque de fecha calendario, horario, prestación, profesional, box, estado, enlace "Agregar a Google Calendar", botón "Descargar .ics" y acciones "Reprogramar" y "Cancelar turno" habilitadas

#### Scenario: Turno a menos de 24 horas deshabilita cancelar y reprogramar
- **WHEN** un turno activo comienza en menos de 24 horas respecto de la hora actual
- **THEN** las acciones de cancelar y reprogramar aparecen deshabilitadas junto a un aviso claro que explica la regla de 24 horas

#### Scenario: Turno exactamente a 24 horas del inicio permite autogestión (borde)
- **WHEN** un turno activo comienza exactamente 24 horas después de la hora actual (`inicio - ahora === 24 h`)
- **THEN** las acciones de cancelar y reprogramar permanecen habilitadas

#### Scenario: Respuesta `409 PLAZO_VENCIDO` del servidor deshabilita la acción
- **WHEN** el paciente intenta cancelar un turno y el servidor responde `409` con código `PLAZO_VENCIDO`
- **THEN** se muestra `AlertaErrorNegocio` con el mensaje legible de 24 horas y las acciones de cancelar y reprogramar de ese turno quedan deshabilitadas

---

### Requirement: Cancelación y reprogramación del turno por el paciente

El paciente SHALL poder cancelar un turno elegible previa confirmación explícita (`POST /api/paciente/turnos/:id/cancelar`) y reprogramarlo eligiendo un nuevo hueco libre (`/paciente/turnos/:id/reprogramar` → `PATCH /api/paciente/turnos/:id/reprogramar`).

#### Scenario: Cancelar un turno dentro del plazo lo marca como cancelado
- **WHEN** el paciente confirma la cancelación de un turno activo a más de 24 horas y la API responde `200`
- **THEN** el turno pasa a mostrarse con estado `Cancelado` en el historial y deja de ofrecer acciones de modificación

#### Scenario: Reprogramar un turno a otro hueco libre confirma el cambio
- **WHEN** el paciente abre `/paciente/turnos/:id/reprogramar`, selecciona un nuevo hueco disponible y pulsa "Confirmar nuevo horario"
- **THEN** se envía `PATCH /api/paciente/turnos/:id/reprogramar` con el nuevo `inicio` y `profesionalId`, y se muestra la confirmación actualizada con Google Calendar y `.ics`

#### Scenario: Reprogramar hacia un hueco recién ocupado (`409`) recarga los huecos
- **WHEN** `PATCH /api/paciente/turnos/:id/reprogramar` devuelve `409 SOLAPAMIENTO_PROFESIONAL` o `409 SOLAPAMIENTO_BOX`
- **THEN** se muestra la alerta legible, se conservan los datos del turno a reprogramar y se recarga `GET /api/public/disponibilidad` para elegir otro horario

---

### Requirement: Consulta y actualización de datos personales del paciente

La pantalla `/paciente/datos` SHALL consultar `GET /api/paciente/datos` y permitir editar únicamente los campos permitidos por `PATCH /api/paciente/datos` (`nombre`, `apellido`, `telefono`, `obraSocial`, `plan`, `nroAfiliado`), mostrando `documento` y `email` en solo lectura.

#### Scenario: Consultar datos actuales y guardar una actualización válida
- **WHEN** el paciente abre `/paciente/datos`, visualiza su DNI y correo electrónico en solo lectura, modifica su teléfono y obra social y pulsa "Guardar cambios"
- **THEN** se envía `PATCH /api/paciente/datos` solo con los campos editables y se muestra una confirmación de guardado exitoso

---

### Requirement: Confidencialidad de precios (`RN-RO-01`)

Ninguna pantalla ni enlace generado por `web-paciente` SHALL mostrar precios, montos ni símbolos monetarios.

#### Scenario: Respuestas con campos de precio no se muestran en la interfaz del paciente
- **WHEN** las respuestas de prestaciones o turnos contienen campos `precio` o `precioAlReservar`
- **THEN** ni los montos numéricos ni el símbolo `$` aparecen en el DOM ni en el enlace de Google Calendar
