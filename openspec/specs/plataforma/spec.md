# plataforma Specification

## Purpose

Contratos transversales de la API de turnos que usan todos los módulos: arranque y registro de módulos, formato de errores, sesión y roles, ocultamiento de precios por rol, hora y zona del consultorio, datos semilla ficticios y exclusión mutua al guardar en la agenda.

## Requirements

### Requirement: Chequeo de salud
La API SHALL responder `GET /api/health` sin autenticación con `200` y el cuerpo `{"status":"ok"}`.

#### Scenario: La API está viva
- **WHEN** un cliente sin token pide `GET /api/health`
- **THEN** recibe `200` con `{"status":"ok"}`

### Requirement: Registro automático de módulos
La API SHALL publicar bajo `/api` las rutas de cada módulo de `src/modules/<capability>/` sin que ningún archivo central las enumere. Agregar un módulo no requiere editar archivos fuera de su carpeta.

#### Scenario: Un módulo nuevo queda publicado
- **WHEN** existe un módulo que declara la ruta `GET /eco`
- **THEN** `GET /api/eco` responde lo que ese módulo define

#### Scenario: Una ruta inexistente
- **WHEN** un cliente pide una ruta que ningún módulo declara
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Errores de formato
Una entrada que no cumple el esquema de validación del endpoint SHALL responder `400` con `{"code":"FORMATO_INVALIDO","detalles":[...]}`, donde cada detalle indica el campo y el motivo.

#### Scenario: Cuerpo con un campo inválido
- **WHEN** un endpoint que exige un `inicio` en ISO 8601 recibe `{"inicio":"mañana"}`
- **THEN** responde `400` con `code` `FORMATO_INVALIDO` y un detalle cuyo campo es `inicio`

### Requirement: Errores de regla de negocio
La violación de una regla de negocio SHALL responder `409` con `{"code":"<CODIGO>"}`, donde el código pertenece a la lista cerrada de RN-EX-01 más `RECURSO_INACTIVO` y `DUPLICADO` (un dato que debe ser único ya existe). El código `NO_ENCONTRADO` responde `404`. No se aceptan códigos fuera de la lista.

#### Scenario: Regla violada
- **WHEN** un caso de uso rechaza una operación con el código `SOLAPAMIENTO_BOX`
- **THEN** la API responde `409` con `{"code":"SOLAPAMIENTO_BOX"}`

#### Scenario: Recurso que no existe o no es del usuario
- **WHEN** un caso de uso rechaza una operación con el código `NO_ENCONTRADO`
- **THEN** la API responde `404` con `{"code":"NO_ENCONTRADO"}`

#### Scenario: Lista cerrada de códigos
- **WHEN** se enumeran los códigos de negocio disponibles
- **THEN** son exactamente `SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `FUERA_DE_GRILLA`, `DURACION_INVALIDA`, `EN_BLOQUEO`, `FUERA_DE_HORARIO`, `EN_EL_PASADO`, `PLAZO_VENCIDO`, `TRANSICION_INVALIDA`, `NO_ENCONTRADO`, `RECURSO_INACTIVO` y `DUPLICADO`

### Requirement: Errores inesperados
Un error no previsto SHALL responder `500` con `{"code":"ERROR_INTERNO"}`, sin mensaje, traza ni datos internos en el cuerpo.

#### Scenario: Falla interna
- **WHEN** un handler lanza un error que no es de formato, sesión ni negocio
- **THEN** la API responde `500` con `{"code":"ERROR_INTERNO"}` y nada más

### Requirement: Sesión obligatoria y permisos por rol
Toda ruta fuera de `/api/health` y `/api/public/*` SHALL exigir una sesión válida (`401 NO_AUTENTICADO` si falta o es inválida). Una ruta restringida a ciertos roles SHALL responder `403 SIN_PERMISO` a una sesión válida con otro rol.

#### Scenario: Sin token
- **WHEN** un cliente sin `Authorization` pide una ruta protegida
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Rol no permitido
- **WHEN** una sesión de `recepcionista` pide una ruta reservada al rol `profesional`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Rol permitido
- **WHEN** una sesión de `profesional` pide una ruta reservada al rol `profesional`
- **THEN** la ruta responde normalmente y conoce el `usuarioId`, el `rol` y el `profesionalId` de la sesión

#### Scenario: Autenticación todavía no implementada
- **WHEN** la API arranca sin un autenticador real y llega cualquier token
- **THEN** toda ruta protegida responde `401` con `{"code":"NO_AUTENTICADO"}`

### Requirement: Precios ocultos por rol
Toda respuesta dirigida a una sesión `recepcionista` o `paciente` SHALL omitir los campos `precio` y `precioAlReservar` en cualquier nivel de anidamiento. Una sesión `profesional` los recibe.

#### Scenario: Recepcionista lista prestaciones
- **WHEN** se serializa una lista de prestaciones con `precio` para una sesión `recepcionista`
- **THEN** ningún elemento contiene `precio` y el resto de los campos se conserva

#### Scenario: Paciente ve un turno anidado
- **WHEN** se serializa `{turno:{precioAlReservar:5000, prestacion:{precio:5000}}}` para una sesión `paciente`
- **THEN** la respuesta no contiene `precioAlReservar` ni `precio` en ningún nivel

#### Scenario: Profesional ve sus precios
- **WHEN** se serializa la misma prestación para una sesión `profesional`
- **THEN** la respuesta conserva `precio`

### Requirement: Hora del sistema inyectable
Las reglas que dependen de "ahora" SHALL obtener la hora de un reloj provisto por quien arma la API. En tests, un reloj fijo devuelve siempre el instante configurado.

#### Scenario: Reloj fijo
- **WHEN** la API se arma con un reloj fijo en `2026-11-23T12:00:00Z`
- **THEN** toda lectura de "ahora" devuelve ese instante, sin importar cuánto tiempo real pase

### Requirement: Día y hora en la zona del consultorio
La plataforma SHALL convertir un instante al día de la semana (1 = lunes … 7 = domingo) y la hora `HH:mm` en la zona `APP_TZ`, que por defecto es `America/Argentina/Mendoza`.

#### Scenario: Instante en UTC
- **WHEN** se convierte `2026-11-23T12:00:00Z` con la zona por defecto
- **THEN** el resultado es día `1` (lunes) y hora `09:00`

#### Scenario: Cambio de día por la zona
- **WHEN** se convierte `2026-11-24T02:30:00Z` con la zona por defecto
- **THEN** el resultado es día `1` (lunes) y hora `23:30`

### Requirement: Datos semilla ficticios
En memoria, la API SHALL arrancar con los datos semilla de `04_modelo_de_datos.md`: dos profesionales, dos boxes, cuatro prestaciones, horarios de lunes a viernes de 09:00 a 13:00 y de 15:00 a 19:00, y pacientes y usuarios ficticios. En PostgreSQL, SHALL sembrar solo si las tablas de aplicación están vacías. Ningún dato semilla puede parecer real (RN-DA-01).

#### Scenario: Contenido de la semilla
- **WHEN** se cargan los datos semilla
- **THEN** existen "Dra. Ana Pérez" y "Dr. Bruno Gómez", "Box 1" y "Box 2", y las prestaciones Consulta (30), Limpieza (45), Extracción simple (60) y Control (15), todas con duración múltiplo de 15

#### Scenario: Pacientes y usuarios ficticios
- **WHEN** se revisan los pacientes y usuarios de la semilla base
- **THEN** todos los emails terminan en `@example.com`, todos los documentos tienen la forma `0000000N` y cada nombre completo de paciente es un personaje de ficción aprobado por EP ("Susanita Chirusi" o "Manolito Goreiro")

#### Scenario: Sin contraseñas en claro
- **WHEN** se revisan los usuarios semilla
- **THEN** ninguno guarda su contraseña en texto plano

#### Scenario: Base existente al iniciar en PostgreSQL
- **GIVEN** un esquema PostgreSQL con datos de aplicación existentes
- **WHEN** arranca la API
- **THEN** conserva esos datos y no aplica las semillas nuevamente

#### Scenario: Falla la siembra inicial en PostgreSQL
- **GIVEN** un esquema PostgreSQL vacío y una falla durante la siembra
- **WHEN** la API intenta iniciarse
- **THEN** el arranque no se completa y no quedan filas de una siembra parcial

### Requirement: Datos aislados por instancia
Cada instancia de la API en modo memoria SHALL tener su propio almacenamiento, de modo que un test ordinario no vea los datos que escribió otro. En modo PostgreSQL, el contenido SHALL persistir entre instancias que se suceden y apuntan al mismo esquema; las pruebas de PostgreSQL usan esquemas propios.

#### Scenario: Dos instancias independientes
- **GIVEN** el modo en memoria
- **WHEN** una instancia guarda un paciente nuevo
- **THEN** otra instancia armada después no lo ve

#### Scenario: Un test fallido no deja datos en otra instancia de memoria
- **GIVEN** un test con la API en memoria que termina con error después de guardar un paciente
- **WHEN** el siguiente test crea una nueva instancia en memoria
- **THEN** no encuentra al paciente escrito por el test anterior

#### Scenario: Dos arranques PostgreSQL contra el mismo esquema
- **GIVEN** una instancia en modo PostgreSQL que guarda un paciente y luego se cierra
- **WHEN** otra instancia inicia contra el mismo esquema
- **THEN** encuentra al paciente ya guardado

### Requirement: Operaciones de agenda en exclusión mutua
Las operaciones que validan y guardan turnos SHALL ejecutarse de a una: una operación empieza solo cuando terminó la anterior, aunque la anterior haya fallado (RN-RE-04).

#### Scenario: Dos operaciones simultáneas
- **WHEN** dos operaciones de agenda se lanzan al mismo tiempo y cada una espera antes de terminar
- **THEN** la segunda empieza recién cuando terminó la primera

#### Scenario: Una operación falla
- **WHEN** la primera operación lanza un error
- **THEN** el error llega a quien la lanzó y la segunda operación se ejecuta igual

### Requirement: Dependencias provisionales
Hasta que sus changes dueños las reemplacen, la API SHALL incluir un notificador que guarda los mensajes en una bandeja en memoria (C-06) y una consulta de disponibilidad que acepta cualquier horario (C-03).

#### Scenario: Notificación provisional
- **WHEN** un caso de uso envía una notificación
- **THEN** el mensaje queda en la bandeja en memoria y no sale ningún email

#### Scenario: Disponibilidad provisional
- **WHEN** se consulta si un profesional atiende en un intervalo
- **THEN** la respuesta es que sí

### Requirement: Reproducible en cualquier PC del equipo
El repositorio SHALL instalarse con `npm ci` y verificarse con `npm test`, `npm run typecheck` y `npm run lint` en Windows, Linux y macOS con Node 22.20 o superior, sin servicios externos. Cada PR a `main` SHALL correr esa verificación en CI.

#### Scenario: Clonado limpio
- **WHEN** alguien clona el repo y corre `npm ci` y `npm test`
- **THEN** todos los tests pasan sin configurar variables de entorno ni levantar servicios
