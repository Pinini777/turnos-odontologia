# Spec Delta

## Purpose

Interfaz web de la recepcionista (US-010 a US-014, F-01, F-02): ver la agenda por día, semana, profesional o box, dar turnos eligiendo entre huecos libres, reprogramarlos, cancelarlos, cambiarles el estado y dar de alta pacientes, siempre sin precios.

> Convenciones de los escenarios: sesión de recepcionista; datos semilla ficticios (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1, Box 2, "Consulta" de 30 minutos, "Paciente Ficticio Uno"). Horas en la zona del consultorio. "La API responde" significa la respuesta simulada en el test de componentes.

## ADDED Requirements

### Requirement: Área de recepción en el menú
El menú de la recepcionista SHALL mostrar "Agenda del día" y "Pacientes" como rutas reales (`/recepcion/agenda` y `/recepcion/pacientes`), no como vistas previas. Las rutas `/recepcion/*` MUST mostrarse solo con sesión de recepcionista; sin sesión se redirige al login y con otro rol se muestra un aviso de acceso no permitido.

#### Scenario: La recepcionista ve la agenda en el menú
- **GIVEN** una sesión de recepcionista
- **WHEN** abre la aplicación
- **THEN** el menú tiene "Agenda del día" con destino `/recepcion/agenda` y "Pacientes" con destino `/recepcion/pacientes`

#### Scenario: Un paciente entra a una ruta de recepción
- **GIVEN** una sesión de paciente
- **WHEN** navega a `/recepcion/agenda`
- **THEN** ve un aviso de acceso no permitido y no se pide la agenda a la API

### Requirement: Agenda por día y por semana
La agenda SHALL mostrar los turnos del día o de la semana elegidos, pedidos a `GET /api/agenda` con ese rango, ordenados por hora. Cada turno SHALL mostrar hora de inicio y fin, paciente, prestación, profesional, box y estado con su color y su texto.

#### Scenario: Vista del día con turnos
- **GIVEN** la API devuelve dos turnos del martes 24/11/2026
- **WHEN** la recepcionista abre la agenda de ese día
- **THEN** ve los dos turnos ordenados por hora, cada uno con paciente, prestación, profesional, box y estado

#### Scenario: Cambiar a la vista semanal
- **WHEN** la recepcionista elige "Semana" en la agenda del martes 24/11/2026
- **THEN** se pide a la API el rango del lunes 23 al domingo 29 y los turnos se agrupan por día

#### Scenario: Día sin turnos
- **GIVEN** la API devuelve una lista vacía
- **WHEN** la recepcionista abre la agenda
- **THEN** ve un estado vacío con la acción "Nuevo turno"

### Requirement: Filtro por profesional o por box
La agenda SHALL permitir filtrar por un profesional o por un box, y pedir a la API solo esos turnos. Sin filtro muestra todos.

#### Scenario: Filtrar por box
- **WHEN** la recepcionista elige "Box 1" en el filtro
- **THEN** la agenda se pide con el filtro de Box 1 y solo muestra turnos de ese box

### Requirement: Turnos contiguos sin conflicto
Dos turnos donde uno empieza justo cuando termina el otro (intervalos `[inicio, fin)`) SHALL mostrarse como turnos normales, sin ninguna marca de conflicto o error.

#### Scenario: Turno contiguo se muestra como válido
- **GIVEN** el Box 1 tiene un turno de 10:00 a 10:30 y otro de 10:30 a 11:00
- **WHEN** la recepcionista ve la agenda de ese día
- **THEN** los dos turnos se muestran uno a continuación del otro y ninguno tiene marca de conflicto

### Requirement: Acciones según el estado del turno
Cada turno SHALL ofrecer solo las acciones válidas para su estado: `reservado` → confirmar, cancelar, reprogramar; `confirmado` → marcar atendido, marcar ausente, cancelar, reprogramar; `atendido`, `ausente` y `cancelado` → ninguna. Después de una acción exitosa, la agenda se vuelve a pedir.

#### Scenario: Acciones de un turno reservado
- **GIVEN** un turno `reservado`
- **WHEN** la recepcionista abre sus acciones
- **THEN** ve "Confirmar", "Reprogramar" y "Cancelar", y no ve "Atendido" ni "Ausente"

#### Scenario: Un turno cancelado no tiene acciones
- **GIVEN** un turno `cancelado`
- **WHEN** la recepcionista lo ve en la agenda
- **THEN** no tiene acciones disponibles

#### Scenario: Confirmar un turno
- **WHEN** la recepcionista confirma un turno `reservado` y la API responde `200`
- **THEN** se llama a `POST /api/turnos/:id/estado` con `{"estado":"confirmado"}` y la agenda se actualiza

### Requirement: Cancelar con confirmación
Cancelar un turno SHALL pedir una confirmación explícita antes de llamar a `POST /api/turnos/:id/cancelar`. Si la recepcionista desiste, no se llama a la API.

#### Scenario: Cancelar un turno
- **WHEN** la recepcionista elige "Cancelar" y confirma
- **THEN** se llama a `POST /api/turnos/:id/cancelar` y la agenda se actualiza

#### Scenario: Desistir de cancelar
- **WHEN** la recepcionista elige "Cancelar" y después "Volver"
- **THEN** no se llama a la API y el turno sigue igual

### Requirement: Nuevo turno en un hueco libre
El formulario de nuevo turno SHALL pedir prestación (todas las activas), profesional y día, y mostrar los huecos libres de `GET /api/recepcion/disponibilidad`. La recepcionista elige un hueco, un paciente y, opcionalmente, un box entre los libres de ese hueco (por defecto "Automático"), y se crea con `POST /api/recepcion/turnos`. Al crear, vuelve a la agenda de ese día.

#### Scenario: Elegir un hueco libre y crear el turno
- **GIVEN** la API devuelve los huecos 10:00, 10:30 y 11:00 para la Dra. Pérez el martes
- **WHEN** la recepcionista elige "Consulta", la Dra. Pérez, el martes, el hueco de 10:30 y a "Paciente Ficticio Uno", y confirma
- **THEN** se llama a `POST /api/recepcion/turnos` con ese paciente, profesional, prestación e inicio 10:30, sin `boxId`
- **AND** vuelve a la agenda del martes

#### Scenario: Sin huecos libres
- **GIVEN** la API no devuelve huecos para ese día
- **WHEN** la recepcionista busca huecos
- **THEN** ve el mensaje de que no hay huecos libres y la opción de probar otro día

#### Scenario: Elegir un box del hueco
- **GIVEN** el hueco de 10:30 tiene libres el Box 1 y el Box 2
- **WHEN** la recepcionista elige el Box 2 y confirma
- **THEN** el turno se pide con el `boxId` del Box 2

### Requirement: Paciente existente o nuevo en el mismo formulario
El formulario SHALL permitir buscar un paciente existente por nombre, apellido o documento, o cargar uno nuevo (nombre, apellido, documento, email y teléfono) que se envía dentro del mismo `POST /api/recepcion/turnos`.

#### Scenario: Dar turno a un paciente nuevo
- **WHEN** la recepcionista elige "Paciente nuevo", carga los datos de "Paciente Ficticio Tres" y confirma un hueco
- **THEN** se llama a `POST /api/recepcion/turnos` con el objeto `paciente` y sin `pacienteId`

### Requirement: Errores de negocio legibles
Un `409` de la API SHALL mostrarse con el mensaje legible de su código, sin perder lo que la recepcionista cargó. Ante `SOLAPAMIENTO_PROFESIONAL` o `SOLAPAMIENTO_BOX`, el formulario SHALL volver a pedir los huecos libres para que elija otro.

#### Scenario: El hueco se ocupó mientras se cargaba el turno
- **GIVEN** la recepcionista eligió el hueco de 10:30
- **WHEN** confirma y la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}`
- **THEN** ve el mensaje legible de que el profesional ya tiene un turno en ese horario
- **AND** los datos del paciente siguen cargados y la lista de huecos se vuelve a pedir

#### Scenario: El box ya está ocupado
- **WHEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`
- **THEN** ve el mensaje legible de que el box ya está ocupado en ese horario

### Requirement: Reprogramar eligiendo un hueco libre
Reprogramar SHALL mostrar el turno actual y los huecos libres para su prestación y profesional en el día elegido (se puede cambiar de profesional), y llamar a `PATCH /api/turnos/:id/reprogramar` con el hueco elegido. Un `409` se muestra con su mensaje legible y se vuelven a pedir los huecos.

#### Scenario: Mover un turno a otro hueco
- **GIVEN** un turno de 10:00 de la Dra. Pérez y los huecos libres 11:00 y 11:30
- **WHEN** la recepcionista elige el hueco de 11:00 y confirma
- **THEN** se llama a `PATCH /api/turnos/:id/reprogramar` con inicio 11:00 y la agenda se actualiza

#### Scenario: Reprogramar falla por solapamiento
- **WHEN** la API responde `409` con `{"code":"SOLAPAMIENTO_PROFESIONAL"}` al reprogramar
- **THEN** ve el mensaje legible y la lista de huecos se vuelve a pedir

### Requirement: Pacientes
La pantalla de pacientes SHALL listar los pacientes de `GET /api/pacientes` con un buscador por nombre, apellido o documento, y permitir dar de alta uno con `POST /api/pacientes`. Un documento o email repetido muestra el mensaje legible de `DUPLICADO`.

#### Scenario: Buscar un paciente
- **GIVEN** la API devuelve "Paciente Ficticio Uno" y "Paciente Ficticio Dos"
- **WHEN** la recepcionista escribe "Dos" en el buscador
- **THEN** solo ve a "Paciente Ficticio Dos"

#### Scenario: Alta con documento repetido
- **WHEN** la recepcionista da de alta un paciente y la API responde `409` con `{"code":"DUPLICADO"}`
- **THEN** ve el mensaje legible de dato repetido y el formulario conserva lo cargado

### Requirement: Sin precios en ninguna pantalla
Ninguna pantalla de recepción SHALL mostrar precios ni ganancias, aunque la respuesta de la API trajera un campo de precio (RN-RO-01).

#### Scenario: Una respuesta con precio no se muestra
- **GIVEN** la API devuelve un turno que, por error, incluye `precioAlReservar` 15000
- **WHEN** la recepcionista ve la agenda y las acciones de ese turno
- **THEN** en la pantalla no aparece "15000" ni el símbolo `$`
