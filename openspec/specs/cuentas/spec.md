# cuentas Specification

## Purpose
Gestiona la autenticación con tokens de acceso para los tres roles del consultorio, el registro y vinculación de cuentas de pacientes, la administración del padrón de pacientes por el personal y la autogestión aislada de los datos propios del paciente.

## Requirements

### Requirement: Inicio de sesión con credenciales
La API SHALL exponer `POST /api/public/login` sin requerir sesión previa para los roles `profesional`, `recepcionista` y `paciente`, emitiendo un token de acceso de corta duración junto con los datos públicos del usuario (sin `hashPassword`). Las credenciales inválidas, los correos inexistentes y las cuentas inactivas SHALL responder el mismo error `401 NO_AUTENTICADO`.

#### Scenario: Login exitoso de personal o paciente
- **GIVEN** un usuario activo existente (por ejemplo un profesional, una recepcionista o un paciente con cuenta)
- **WHEN** el cliente envía `POST /api/public/login` con su email y contraseña válidos
- **THEN** recibe `200` con `{"token":"...","usuario":{"id":"...","email":"...","rol":"...","activo":true}}` sin incluir `hashPassword`, y el token es aceptado en rutas protegidas

#### Scenario: Normalización de email en el login
- **GIVEN** un usuario activo registrado con `profesional@example.com`
- **WHEN** el cliente envía `POST /api/public/login` con `"  PROFESIONAL@Example.com  "` y su contraseña válida
- **THEN** recibe `200` con un token válido y los datos públicos del usuario

#### Scenario: Credenciales inválidas o usuario inactivo
- **GIVEN** un email inexistente, una contraseña incorrecta o un usuario con `activo = false`
- **WHEN** el cliente envía `POST /api/public/login`
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}` sin revelar cuál condición falló

#### Scenario: Entrada con formato inválido en login
- **WHEN** el cliente envía `POST /api/public/login` con un email mal formado o sin contraseña
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y los detalles de los campos inválidos

### Requirement: Verificación de sesión con token de acceso
Toda solicitud a una ruta protegida SHALL validar el token Bearer verificando firma criptográfica, algoritmo permitido (`HS256`), emisor (`turnos-odontologia`), expiración respecto del reloj del sistema, existencia del usuario, estado `activo = true`, coincidencia entre el rol del token y el rol persistido, y resolución del vínculo correspondiente (`profesionalId` para `profesional`, `pacienteId` para `paciente`). Cualquier verificación fallida SHALL responder `401 NO_AUTENTICADO`.

#### Scenario: Sesión válida resuelta según el rol
- **GIVEN** tokens emitidos mediante `POST /api/public/login` para un `profesional`, una `recepcionista` y un `paciente`
- **WHEN** cada cliente invoca una ruta protegida permitida para su rol con `Authorization: Bearer <token>`
- **THEN** la sesión incluye `usuarioId` y `rol`, además de `profesionalId` para el profesional y `pacienteId` para el paciente

#### Scenario: Token vigente en el límite previo a la expiración
- **GIVEN** un token emitido en el instante `T` con vigencia de 2 horas
- **WHEN** el reloj del sistema avanza a `T + 2 horas - 1 segundo` y el cliente invoca una ruta protegida con ese token
- **THEN** la sesión se resuelve correctamente y el acceso es permitido

#### Scenario: Token vencido rechazado en el instante exacto de expiración
- **GIVEN** un token emitido en el instante `T` con vigencia de 2 horas
- **WHEN** el reloj del sistema avanza exactamente a `T + 2 horas` y el cliente invoca una ruta protegida con ese token
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Token alterado, mal formado o con algoritmo no permitido
- **WHEN** el cliente invoca una ruta protegida con un token firmado con otro secreto, mal formado o con algoritmo distinto de `HS256`
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Token de usuario desactivado tras el login
- **GIVEN** un usuario que obtuvo un token válido y luego pasó a `activo = false`
- **WHEN** el cliente invoca una ruta protegida con ese token todavía no expirado
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Token con rol inconsistente o vínculo faltante
- **GIVEN** un token cuyo rol no coincide con el rol actual del usuario persistido, o un usuario con rol `paciente` o `profesional` sin registro asociado
- **WHEN** el cliente invoca una ruta protegida con ese token
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

### Requirement: Registro público de pacientes y vinculación de ficha previa
La API SHALL exponer `POST /api/public/pacientes/registro` sin sesión previa para crear cuentas de rol `paciente` con contraseña de al menos 8 caracteres y como máximo 72 bytes en UTF-8 (`Buffer.byteLength(password, 'utf8') <= 72`, límite de truncado de bcrypt), normalizando email (recortado y en minúsculas) y documento (recortado). Si ya existe una ficha de paciente sin cuenta con el mismo documento y el mismo email (PA-10), SHALL vincular esa ficha conservando su `id` y preservando los datos opcionales ya cargados que no se envíen en el registro.

#### Scenario: Registro de un paciente nuevo
- **GIVEN** un email y un documento que no existen ni en usuarios ni en pacientes
- **WHEN** el cliente envía `POST /api/public/pacientes/registro` con nombre, apellido, documento, email y contraseña válida
- **THEN** recibe `201` con `{"token":"...","usuario":{...},"paciente":{...}}` sin `hashPassword`, `usuario.rol` es `paciente`, `paciente.usuarioId` coincide con `usuario.id` y el token permite consultar `GET /api/paciente/datos`

#### Scenario: Vinculación de paciente preexistente sin cuenta por documento y email
- **GIVEN** un paciente ya cargado por recepción sin `usuarioId`, con documento `00000002`, email `paciente2@example.com` y teléfono previo cargado
- **WHEN** el cliente envía `POST /api/public/pacientes/registro` con el mismo documento y el mismo email, informando `obraSocial` pero omitiendo `telefono`
- **THEN** recibe `201` con `token`, `usuario` y `paciente`, conserva exactamente el mismo `paciente.id`, asigna `paciente.usuarioId = usuario.id`, actualiza `obraSocial` y preserva el `telefono` previo

#### Scenario: Rechazo por email duplicado o ficha ya vinculada
- **GIVEN** un email ya asociado a un usuario existente, a un paciente con distinto documento o a un paciente ya vinculado a una cuenta
- **WHEN** el cliente envía `POST /api/public/pacientes/registro` con ese email
- **THEN** recibe `409` con `{"code":"DUPLICADO"}` y no crea nuevos registros

#### Scenario: Rechazo por documento duplicado con distinto email
- **GIVEN** un paciente existente con documento `00000002` y email `paciente2@example.com`
- **WHEN** el cliente envía `POST /api/public/pacientes/registro` con documento `00000002` y email `otro@example.com`
- **THEN** recibe `409` con `{"code":"DUPLICADO"}` y no vincula ni crea registros

#### Scenario: Contraseña o datos con formato inválido en registro
- **WHEN** el cliente envía `POST /api/public/pacientes/registro` con una contraseña de menos de 8 caracteres, más de 72 bytes en UTF-8 (incluyendo caracteres multibyte que excedan 72 bytes aunque tengan menos de 72 caracteres), o un email inválido
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y los detalles de validación

### Requirement: Gestión de pacientes por el personal del consultorio
La API SHALL exponer `GET /api/pacientes`, `POST /api/pacientes` y `PATCH /api/pacientes/:id` exclusivamente para los roles `profesional` y `recepcionista`, garantizando unicidad de email y documento y sincronizando el email de la cuenta vinculada cuando corresponde.

#### Scenario: Personal lista el padrón de pacientes
- **GIVEN** una sesión válida de `recepcionista` o `profesional`
- **WHEN** solicita `GET /api/pacientes`
- **THEN** recibe `200` con el arreglo de todos los pacientes registrados

#### Scenario: Personal da de alta un paciente sin cuenta
- **GIVEN** una sesión válida de `recepcionista` o `profesional`
- **WHEN** envía `POST /api/pacientes` con nombre, apellido, documento y email no registrados (y opcionalmente contacto y obra social)
- **THEN** recibe `201` con el `Paciente` creado, con `email` normalizado en minúsculas y sin `usuarioId`

#### Scenario: Alta de paciente rechazada por email duplicado
- **GIVEN** una sesión válida de `recepcionista` o `profesional`
- **WHEN** envía `POST /api/pacientes` con un email ya registrado en `pacientes` o `usuarios`
- **THEN** recibe `409` con `{"code":"DUPLICADO"}`

#### Scenario: Alta de paciente rechazada por documento duplicado
- **GIVEN** una sesión válida de `recepcionista` o `profesional`
- **WHEN** envía `POST /api/pacientes` con un documento ya registrado en `pacientes`
- **THEN** recibe `409` con `{"code":"DUPLICADO"}`

#### Scenario: Personal actualiza un paciente y sincroniza el email de su usuario vinculado
- **GIVEN** una sesión válida de `recepcionista` o `profesional` y un paciente con `usuarioId` asociado
- **WHEN** envía `PATCH /api/pacientes/:id` modificando su `email` a uno libre y su `obraSocial`
- **THEN** recibe `200` con el paciente actualizado, y el usuario vinculado pasa a autenticar con el nuevo email y ya no con el anterior

#### Scenario: Personal actualiza un paciente conservando su propio email y documento
- **GIVEN** una sesión válida de `recepcionista` o `profesional` y un paciente existente (con o sin `usuarioId`) con `documento` `00000001` y `email` `paciente1@example.com`
- **WHEN** envía `PATCH /api/pacientes/:id` reenviando el mismo `documento` y el mismo `email` junto con un nuevo `telefono`
- **THEN** recibe `200` con el `telefono` actualizado sin disparar `409` `DUPLICADO` (la validación de unicidad excluye al propio paciente y a su usuario vinculado)

#### Scenario: Actualización de paciente inexistente
- **GIVEN** una sesión válida de `recepcionista` o `profesional`
- **WHEN** envía `PATCH /api/pacientes/:id` con un `id` inexistente
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

#### Scenario: Actualización de paciente rechazada por email duplicado de otro registro
- **GIVEN** una sesión válida de `recepcionista` o `profesional` y un paciente existente
- **WHEN** envía `PATCH /api/pacientes/:id` con un `email` ya perteneciente a otro paciente o a otro usuario
- **THEN** recibe `409` con `{"code":"DUPLICADO"}`

#### Scenario: Actualización de paciente rechazada por documento duplicado de otro registro
- **GIVEN** una sesión válida de `recepcionista` o `profesional` y un paciente existente
- **WHEN** envía `PATCH /api/pacientes/:id` con un `documento` ya perteneciente a otro paciente
- **THEN** recibe `409` con `{"code":"DUPLICADO"}`

#### Scenario: Paciente no tiene permiso sobre las rutas de gestión del personal
- **GIVEN** una sesión válida de `paciente`
- **WHEN** intenta invocar `GET /api/pacientes`, `POST /api/pacientes` o `PATCH /api/pacientes/:id`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

### Requirement: Autogestión aislada de datos del propio paciente
La API SHALL exponer `GET /api/paciente/datos` y `PATCH /api/paciente/datos` exclusivamente para el rol `paciente`, operando únicamente sobre el paciente vinculado a la sesión actual. En `PATCH /api/paciente/datos` SHALL permitir editar únicamente `nombre`, `apellido`, `telefono`, `obraSocial`, `plan` y `nroAfiliado`, rechazando cualquier intento de modificar `documento`, `email`, `id` o `usuarioId`.

#### Scenario: Paciente consulta solo sus propios datos
- **GIVEN** una sesión válida del paciente A y al menos otro paciente B en el repositorio
- **WHEN** el paciente A solicita `GET /api/paciente/datos`
- **THEN** recibe `200` únicamente con la ficha del paciente A y nunca datos del paciente B

#### Scenario: Paciente actualiza sus campos editables
- **GIVEN** una sesión válida de `paciente`
- **WHEN** envía `PATCH /api/paciente/datos` actualizando `telefono`, `obraSocial`, `plan` y `nroAfiliado`
- **THEN** recibe `200` con su ficha actualizada conservando intactos `id`, `usuarioId`, `documento` y `email`

#### Scenario: Paciente intenta modificar campos restringidos
- **GIVEN** una sesión válida de `paciente`
- **WHEN** envía `PATCH /api/paciente/datos` incluyendo `documento`, `email`, `id` o `usuarioId`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y su ficha permanece sin cambios

#### Scenario: Personal no puede operar rutas exclusivas de paciente
- **GIVEN** una sesión válida de `profesional` o `recepcionista`
- **WHEN** invoca `GET /api/paciente/datos` o `PATCH /api/paciente/datos`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

### Requirement: Protección de credenciales y ausencia de borrado físico
El sistema SHALL almacenar contraseñas únicamente como hash irreversible, SHALL omitir `hashPassword` de toda respuesta HTTP y SHALL abstenerse de exponer operaciones de borrado físico sobre pacientes o usuarios o de alta de cuentas de personal por HTTP.

#### Scenario: Ninguna respuesta expone el hash de contraseña
- **WHEN** se ejecutan flujos de login, registro, listado, alta o actualización de pacientes
- **THEN** ningún cuerpo de respuesta contiene la propiedad `hashPassword` en ningún nivel y la contraseña en texto plano nunca se persiste en el repositorio

#### Scenario: No existe borrado físico de pacientes
- **GIVEN** un paciente registrado y una sesión válida de `profesional` o `recepcionista`
- **WHEN** el cliente solicita `DELETE /api/pacientes/:id`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y el paciente sigue existiendo en el padrón
