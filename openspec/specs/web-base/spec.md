# web-base Specification

## Purpose
Capa base de la aplicación web (`web/`) de **Clínica Dental Alvear**: sistema de diseño renovado, cliente HTTP autenticado con traducción de errores de negocio (`409`), gestión reactiva de sesión, componentes compartidos accesibles, pantallas de inicio de sesión y registro de paciente conectadas a `C-04`, y layout + inicio diferenciados por rol (`profesional`, `recepcionista`, `paciente`).

## Requirements

### Requirement: Cliente HTTP autenticado y manejo de errores de negocio
El cliente HTTP de `web/src/base/api.ts` SHALL adjuntar el encabezado `Authorization: Bearer <token>` en toda solicitud cuando exista una sesión activa, traducir los errores `409` con códigos de negocio (`RN-EX-01` + `DUPLICADO`) a mensajes legibles en español rioplatense, e invocar la limpieza de sesión cuando la API responda `401 NO_AUTENTICADO`.

#### Scenario: Adjunta token Bearer en solicitudes autenticadas
- **WHEN** existe un token de sesión activo y se invoca una ruta protegida con `crearClienteHttp`
- **THEN** la solicitud incluye `Authorization: Bearer <token>` y devuelve el cuerpo parseado

#### Scenario: Error 409 de negocio traducido a mensaje legible
- **WHEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`
- **THEN** el cliente rechaza con `ErrorApi` que expone `status: 409`, `code: "SOLAPAMIENTO_BOX"` y un `mensajeLegible` claro que explica el choque de box

#### Scenario: Sesión vencida o inválida (401)
- **WHEN** la API responde `401` con `{"code":"NO_AUTENTICADO"}`
- **THEN** el cliente invoca `onUnauthorized` para limpiar la sesión y rechaza con `ErrorApi` `401`

### Requirement: Pantallas de inicio de sesión y registro contra C-04
La aplicación SHALL proveer las pantallas `/login` (contra `POST /api/public/login`) y `/registro` (contra `POST /api/public/pacientes/registro`), validando en cliente la contraseña del registro (`>= 8` caracteres y `<= 72` bytes UTF-8) y mostrando errores claros e inline ante `400`, `401` o `409 DUPLICADO`.

#### Scenario: Login fallido muestra alerta accesible (401)
- **WHEN** el usuario envía credenciales incorrectas en `/login` y la API responde `401 NO_AUTENTICADO`
- **THEN** se muestra una alerta `role="alert"` con el código `NO_AUTENTICADO` y un mensaje claro sin revelar qué dato falló

#### Scenario: Registro valida contraseña menor a 8 caracteres antes de enviar
- **WHEN** un paciente intenta registrarse con una contraseña de 7 caracteres
- **THEN** el formulario muestra un error inline accesible (`role="alert"`) indicando el mínimo de 8 caracteres y no realiza ninguna llamada HTTP

### Requirement: Menú lateral y layout responsive diferenciados por rol
`AppLayout` y `obtenerMenuPorRol` SHALL adaptar las opciones de navegación al rol autenticado, incluir un indicador activo deslizante en el menú, íconos finos por sección y avatares con iniciales, garantizando que `recepcionista` y `paciente` nunca vean opciones de precios, ganancias ni historia clínica (`RN-RO-01`, `RN-RO-03`).

#### Scenario: Menú cambia según rol respetando RBAC
- **WHEN** se consulta el menú para `profesional`, `recepcionista` y `paciente`
- **THEN** solo `profesional` incluye "Mis ganancias" e "Historia clínica", `recepcionista` incluye "Agenda del día" y "Pacientes" sin ganancias, y `paciente` incluye "Reservar turno", "Mis turnos" y "Mis datos"

#### Scenario: Layout renderiza el indicador deslizante y oculta ganancias a recepción
- **WHEN** se renderiza `AppLayout` con una sesión de `recepcionista`
- **THEN** muestra el rol "Recepcionista", el ítem "Agenda del día", el indicador activo deslizante del sidebar y omite "Mis ganancias"

### Requirement: Panel de inicio diferenciado por rol y libre de jerga técnica
`InicioPage` SHALL mostrar una vista específica para cada rol conectada a datos reales de la API sin datos hardcodeados ni etiquetas `"Datos de ejemplo"`: métricas y agenda real (`GET /api/agenda`) con acciones `POST /api/turnos/:id/estado` para `profesional` y `recepcionista` (con `+ Nuevo turno` hacia `/recepcion/turnos/nuevo`), y tarjeta `Tu próximo turno` desde `GET /api/paciente/turnos` para `paciente` (`RN-RE-03`).

#### Scenario: Profesional ve métricas del día y su agenda sin jerga técnica
- **GIVEN** una sesión de `profesional` y turnos del día devueltos por `GET /api/agenda`
- **WHEN** el `profesional` accede a `/inicio`
- **THEN** visualiza "Turnos de hoy", "Próximo paciente", "Box asignado" y "Tu agenda de hoy" con los turnos reales de la API, sin etiquetas `"Datos de ejemplo"`, IDs de change, tokens ni endpoints

#### Scenario: Recepcionista ve boxes, pendientes, botón + Nuevo turno y actualiza estados en vivo
- **GIVEN** una sesión de `recepcionista` y turnos del día devueltos por `GET /api/agenda`
- **WHEN** la `recepcionista` accede a `/inicio` y pulsa `Confirmar` o `Marcar atendido` en una fila
- **THEN** visualiza el estado de Box 1 y Box 2, el botón `+ Nuevo turno` que navega a `/recepcion/turnos/nuevo`, invoca `POST /api/turnos/:id/estado` y refresca la agenda real de `GET /api/agenda`

#### Scenario: Paciente ve solo su próximo turno con bloque calendario y nunca turnos ajenos
- **GIVEN** una sesión de `paciente` cuyos turnos propios provienen de `GET /api/paciente/turnos`
- **WHEN** el `paciente` accede a `/inicio`
- **THEN** visualiza "Tu próximo turno" con los datos reales de su próximo turno activo (o estado vacío hacia `/paciente/reservar`), sin etiquetas `"Datos de ejemplo"` y sin exponer turnos de otros pacientes

### Requirement: Componentes compartidos accesibles y estados de carga
Los componentes compartidos (`Boton`, `AlertaErrorNegocio`, `BadgeEstadoTurno`, `AvatarIniciales`, `Tabla`, `EstadoVacio`, `Skeleton`) SHALL cumplir accesibilidad básica (`role="alert"`, `role="status"`, `aria-busy`), distinguir turnos activos (`reservado`/`confirmado`) con pulso sutil, generar iniciales ignorando títulos profesionales (`Dra.`/`Dr.`) y respetar `prefers-reduced-motion`.

#### Scenario: Tabla en carga muestra skeleton loader y Boton en carga muestra spinner
- **WHEN** se renderizan `Tabla` con `cargando={true}` y `Boton` con `cargando={true}`
- **THEN** el botón queda deshabilitado con `aria-busy="true"` y la tabla muestra el skeleton con `role="status"` y `aria-busy="true"`

#### Scenario: Badge activo y AvatarIniciales
- **WHEN** se renderiza `BadgeEstadoTurno` para `confirmado` y `atendido`, y `AvatarIniciales` para "Dra. Ana Pérez" y "Lucía Fernández"
- **THEN** solo `confirmado` marca `data-estado-activo="true"` y las iniciales generadas son `AP` y `LF`

### Requirement: Nombre real del usuario en la barra lateral y catálogo de errores
`AppLayout` SHALL resolver y mostrar el nombre real del usuario autenticado consultando `GET /api/paciente/datos` para `paciente` y `GET /api/profesionales` para `profesional` (sin cadenas fijas como `"Lucía Fernández"`), y `web/src/base/errores.ts` SHALL traducir `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE` a mensajes legibles en español rioplatense.

#### Scenario: Barra lateral muestra el nombre real del paciente desde la API y traduce nuevos códigos 409
- **GIVEN** una sesión activa de `paciente` cuyo perfil en `GET /api/paciente/datos` es `"Mario Santos"`
- **WHEN** se renderiza `AppLayout` y se consultan las traducciones de `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE`
- **THEN** la barra lateral muestra `"Mario Santos"` con iniciales `"MS"` (nunca `"Lucía Fernández"`) y ambos códigos devuelven mensajes legibles específicos en español
