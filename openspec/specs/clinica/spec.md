# clinica Specification

## Purpose
Gestiona el registro clínico del consultorio de forma exclusiva para profesionales: historia clínica append-only con autor, fecha, vinculación opcional a turnos y correcciones referenciadas (`RN-CL-01`), y odontograma por paciente en notación FDI con proyección del estado vigente e historial completo append-only (`RN-CL-02`), bajo control de acceso estricto (`RN-RO-03`) y datos 100 % ficticios (`RN-DA-01`).

## Requirements

### Requirement: Consulta cronológica de la historia clínica
La API SHALL exponer `GET /api/pacientes/:id/historia` solo para `profesional`, devolviendo `200` con las `EntradaHistoriaClinica` del paciente ordenadas por `fecha` ascendente (orden de inserción ante empates), o `404 NO_ENCONTRADO` si el paciente no existe.

#### Scenario: Profesional consulta la historia clínica con múltiples entradas ordenadas cronológicamente
- **GIVEN** una sesión válida de `profesional` y el paciente ficticio `Paciente Ficticio Uno` con tres entradas de historia clínica registradas en fechas distintas
- **WHEN** el profesional solicita `GET /api/pacientes/:id/historia`
- **THEN** recibe `200` con las tres entradas ordenadas ascendentemente por `fecha`, incluyendo en cada una `id`, `pacienteId`, `profesionalId`, `fecha` y `texto` (y `turnoId`/`corrigeAId` cuando existan)

#### Scenario: Empate de marca temporal preserva el orden de inserción en la historia clínica
- **GIVEN** una sesión válida de `profesional` y un paciente ficticio con dos entradas registradas en el mismo instante exacto del reloj del sistema
- **WHEN** el profesional solicita `GET /api/pacientes/:id/historia`
- **THEN** recibe `200` con la primera entrada insertada antes que la segunda

#### Scenario: Profesional consulta la historia clínica de un paciente sin entradas previas
- **GIVEN** una sesión válida de `profesional` y el paciente ficticio `Paciente Ficticio Dos` sin entradas registradas
- **WHEN** el profesional solicita `GET /api/pacientes/:id/historia`
- **THEN** recibe `200` con un arreglo vacío `[]`

#### Scenario: Consulta de historia clínica de un paciente inexistente
- **GIVEN** una sesión válida de `profesional`
- **WHEN** el profesional solicita `GET /api/pacientes/:id/historia` con un `id` que no corresponde a ningún paciente
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Registro append-only de entradas de historia clínica
La API SHALL exponer `POST /api/pacientes/:id/historia` solo para `profesional`, agregando una `EntradaHistoriaClinica` con `texto` recortado de 1 a 5000 caracteres, `profesionalId` de la sesión y `fecha` del reloj. SHALL validar `turnoId` y `corrigeAId` del mismo paciente (`404`) y rechazar campos extra (`400 FORMATO_INVALIDO`).

#### Scenario: Profesional registra una evolución clínica básica
- **GIVEN** una sesión válida de `Dra. Ana Pérez` (`profesional`) y un reloj fijo en `2026-11-23T10:00:00.000Z`
- **WHEN** envía `POST /api/pacientes/:id/historia` para `Paciente Ficticio Uno` con `{"texto":"  Control general sin hallazgos relevantes.  "}`
- **THEN** recibe `201` con la nueva entrada persistida con `texto` recortado (`"Control general sin hallazgos relevantes."`), `pacienteId` del parámetro de ruta, `profesionalId` igual al de `Dra. Ana Pérez` y `fecha` igual a `2026-11-23T10:00:00.000Z`

#### Scenario: Profesional registra una evolución vinculada a un turno del mismo paciente
- **GIVEN** una sesión válida de `profesional` y un turno existente perteneciente a `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` para `Paciente Ficticio Uno` con `texto` y ese `turnoId`
- **THEN** recibe `201` con la entrada persistida incluyendo el `turnoId` indicado

#### Scenario: Profesional registra una corrección referenciando una entrada previa del mismo paciente
- **GIVEN** una sesión válida de `profesional` y una entrada previa `E1` de historia clínica perteneciente a `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` para `Paciente Ficticio Uno` con `texto` aclaratorio y `corrigeAId` igual al `id` de `E1`
- **THEN** recibe `201` con la nueva entrada que referencia `corrigeAId = E1.id`, y al consultar `GET /api/pacientes/:id/historia` tanto `E1` (sin alteraciones) como la nueva corrección aparecen en orden cronológico

#### Scenario: Registro de historia clínica para un paciente inexistente
- **GIVEN** una sesión válida de `profesional`
- **WHEN** envía `POST /api/pacientes/:id/historia` con un `id` de paciente inexistente y `texto` válido
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no persiste ninguna entrada

#### Scenario: Rechazo de turnoId inexistente al registrar evolución
- **GIVEN** una sesión válida de `profesional` y el paciente existente `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` con un `turnoId` que no existe en el repositorio de turnos
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no persiste ninguna entrada

#### Scenario: Rechazo de turnoId perteneciente a otro paciente
- **GIVEN** una sesión válida de `profesional` y un turno existente perteneciente a `Paciente Ficticio Dos`
- **WHEN** envía `POST /api/pacientes/:id/historia` para `Paciente Ficticio Uno` con el `turnoId` de `Paciente Ficticio Dos`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no persiste ninguna entrada

#### Scenario: Rechazo de corrigeAId inexistente al registrar corrección
- **GIVEN** una sesión válida de `profesional` y el paciente existente `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` con un `corrigeAId` que no corresponde a ninguna entrada registrada
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no persiste ninguna entrada

#### Scenario: Rechazo de corrigeAId perteneciente a otro paciente
- **GIVEN** una sesión válida de `profesional` y una entrada de historia clínica registrada para `Paciente Ficticio Dos`
- **WHEN** envía `POST /api/pacientes/:id/historia` para `Paciente Ficticio Uno` con el `corrigeAId` de `Paciente Ficticio Dos`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no persiste ninguna entrada

#### Scenario: Rechazo de texto vacío o compuesto solo por espacios
- **GIVEN** una sesión válida de `profesional` y el paciente existente `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` con `{"texto":"   "}`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y los detalles de validación, sin persistir entradas

#### Scenario: Aceptación de texto de 5000 caracteres y rechazo al superar 5000 caracteres
- **GIVEN** una sesión válida de `profesional` y el paciente existente `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` con un `texto` recortado de exactamente `5000` caracteres y luego otro de `5001` caracteres
- **THEN** el de `5000` caracteres responde `201` y persiste la entrada, mientras el de `5001` caracteres responde `400` con `code` `FORMATO_INVALIDO` sin persistir ninguna entrada

#### Scenario: Rechazo de campos controlados por el servidor en el alta de historia clínica
- **GIVEN** una sesión válida de `profesional` y el paciente existente `Paciente Ficticio Uno`
- **WHEN** envía `POST /api/pacientes/:id/historia` incluyendo `profesionalId`, `fecha`, `id` o `pacienteId` en el cuerpo JSON
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ninguna entrada

### Requirement: Inmutabilidad append-only de la historia clínica y ausencia de borrado en odontograma
La API SHALL impedir modificar o borrar entradas de historia clínica y no exponer `PATCH` ni `DELETE` sobre odontograma; cualquier solicitud a esos métodos o rutas inexistentes SHALL responder `404 NO_ENCONTRADO` sin alterar los datos persistidos.

#### Scenario: No existe ruta PUT para modificar la historia clínica
- **GIVEN** una sesión válida de `profesional` y una entrada existente en la historia clínica de `Paciente Ficticio Uno`
- **WHEN** el cliente envía `PUT /api/pacientes/:id/historia` o `PUT /api/pacientes/:id/historia/:entradaId`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y la entrada original permanece sin modificaciones

#### Scenario: No existe ruta PATCH para modificar la historia clínica
- **GIVEN** una sesión válida de `profesional` y una entrada existente en la historia clínica de `Paciente Ficticio Uno`
- **WHEN** el cliente envía `PATCH /api/pacientes/:id/historia` o `PATCH /api/pacientes/:id/historia/:entradaId`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y la entrada original permanece sin modificaciones

#### Scenario: No existe ruta DELETE para borrar la historia clínica
- **GIVEN** una sesión válida de `profesional` y una entrada existente en la historia clínica de `Paciente Ficticio Uno`
- **WHEN** el cliente envía `DELETE /api/pacientes/:id/historia` o `DELETE /api/pacientes/:id/historia/:entradaId`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y la entrada original sigue existiendo en la historia clínica

#### Scenario: No existe ruta PATCH sobre el odontograma
- **GIVEN** una sesión válida de `profesional` y un paciente con odontograma registrado
- **WHEN** el cliente envía `PATCH /api/pacientes/:id/odontograma`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y el odontograma permanece sin cambios

#### Scenario: No existe ruta DELETE sobre el odontograma
- **GIVEN** una sesión válida de `profesional` y un paciente con odontograma registrado
- **WHEN** el cliente envía `DELETE /api/pacientes/:id/odontograma`
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y tanto el odontograma como su historial siguen existiendo

### Requirement: Consulta y proyección vigente del odontograma
La API SHALL exponer `GET /api/pacientes/:id/odontograma` solo para `profesional`, devolviendo `200` con `{ odontogramaId, pacienteId, actualizadoEn, piezas, historial }` sin crear registros en pacientes vacíos, o `404 NO_ENCONTRADO` si el paciente no existe. `piezas` SHALL proyectar el estado vigente no contradictorio preservando `historial` intacto.

#### Scenario: Profesional consulta el odontograma de un paciente sin registros previos sin crear efectos secundarios
- **GIVEN** una sesión válida de `profesional` y el paciente ficticio `Paciente Ficticio Uno` sin `Odontograma` persistido
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma`
- **THEN** recibe `200` con `{"odontogramaId":null,"pacienteId":"<id>","actualizadoEn":null,"piezas":[],"historial":[]}` y en el repositorio de odontogramas sigue sin crearse ningún registro para ese paciente

#### Scenario: Profesional consulta el odontograma con proyección vigente e historial completo
- **GIVEN** una sesión válida de `profesional` y un paciente cuya pieza `16` (cara `oclusal`) pasó de `caries` en `T1` a `obturado` en `T2`, y cuya pieza `21` (sin cara) fue registrada como `sano` en `T1`
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma`
- **THEN** recibe `200` con `odontogramaId` no nulo, `actualizadoEn` igual a `T2`, `piezas` conteniendo exactamente dos elementos vigentes (`16/oclusal = obturado` y `21 = sano`) y `historial` conteniendo los tres registros append-only ordenados cronológicamente con su `registradoPor` y `fecha` (sin campos derivados como `fechaDefecto` o `fechaSanado`)

#### Scenario: Múltiples caras distintas de la misma pieza coexisten en la proyección actual
- **GIVEN** una sesión válida de `profesional` y un paciente con registros sobre la pieza `16` con `cara: 'oclusal'` (`estado: 'caries'`) y con `cara: 'mesial'` (`estado: 'obturado'`)
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma`
- **THEN** `piezas` incluye ambos estados vigentes (`16/mesial = obturado` y `16/oclusal = caries`) sin que una cara sobrescriba a la otra, y `historial` preserva ambos registros completos

#### Scenario: Un registro de cara específica desplaza a un estado previo de pieza completa en piezas preservando historial
- **GIVEN** una sesión válida de `profesional` y un paciente cuya pieza `16` fue registrada sin cara como `sano` en `T1` y luego actualizada en `T2` con `cara: 'oclusal'` y `estado: 'caries'`
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma`
- **THEN** `piezas` contiene únicamente `16/oclusal = caries` (removiendo la entrada previa de pieza completa `16 = sano`), mientras `historial` preserva ambos registros append-only intactos en orden cronológico

#### Scenario: Un registro de pieza completa desplaza a los estados previos por cara en piezas preservando historial
- **GIVEN** una sesión válida de `profesional` y un paciente cuya pieza `16` tiene registros previos en `T1` para `cara: 'oclusal'` (`estado: 'caries'`) y `cara: 'mesial'` (`estado: 'obturado'`), y en `T2` se registra la pieza `16` sin cara como `corona` (o `ausente` / `sano`)
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma`
- **THEN** `piezas` contiene únicamente el estado vigente de pieza completa `16 = corona` (removiendo de `piezas` las entradas previas `16/oclusal` y `16/mesial`), mientras `historial` preserva los tres registros append-only intactos en orden cronológico

#### Scenario: Consulta del odontograma de un paciente inexistente
- **GIVEN** una sesión válida de `profesional`
- **WHEN** el profesional solicita `GET /api/pacientes/:id/odontograma` con un `id` de paciente inexistente
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}`

### Requirement: Actualización incremental y concurrencia del odontograma
La API SHALL exponer `PUT /api/pacientes/:id/odontograma` solo para `profesional`, recibiendo `{ piezas }` de 1 a 260 ítems en esquema estricto. Dentro de `conLockDeAgenda`, SHALL obtener o crear el `Odontograma` 1 a 1, anexar cada `EstadoPieza` con autor de sesión y fecha del reloj, y devolver `200` con la vista proyectada (`404` si el paciente no existe).

#### Scenario: Primera actualización crea el odontograma 1 a 1 y registra las piezas
- **GIVEN** una sesión válida de `Dra. Ana Pérez` (`profesional`), un reloj fijo en `T1` y `Paciente Ficticio Uno` sin odontograma previo
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con `{"piezas":[{"pieza":16,"cara":"oclusal","estado":"caries"},{"pieza":21,"estado":"sano"}]}`
- **THEN** recibe `200` con `odontogramaId` no nulo, `actualizadoEn` igual a `T1`, los dos registros en `piezas` y en `historial` con `registradoPor` igual al de `Dra. Ana Pérez` y `fecha` igual a `T1`, y en el repositorio existe exactamente 1 `Odontograma` para ese paciente

#### Scenario: Actualización incremental conserva otras piezas y acumula historial de la pieza actualizada
- **GIVEN** una sesión válida de `profesional` y un paciente con pieza `16` (`cara: 'oclusal'`, `estado: 'caries'`) y pieza `21` (`estado: 'sano'`) registradas en `T1`
- **WHEN** el reloj avanza a `T2` y envía `PUT /api/pacientes/:id/odontograma` con `{"piezas":[{"pieza":16,"cara":"oclusal","estado":"obturado"}]}`
- **THEN** recibe `200` manteniendo el mismo `odontogramaId`, actualizando `actualizadoEn` a `T2`, conservando la pieza `21` (`sano`) y actualizando `16/oclusal` a `obturado` en `piezas`, mientras `historial` conserva los 3 registros completos (`16 caries` en `T1`, `21 sano` en `T1`, `16 obturado` en `T2`)

#### Scenario: Rechazo de campos controlados por el servidor en PUT odontograma
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` incluyendo campos no permitidos como `odontogramaId`, `registradoPor`, `fecha` o `actualizadoEn` en el objeto raíz o en un ítem de `piezas`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ningún cambio

#### Scenario: Actualización de odontograma para un paciente inexistente
- **GIVEN** una sesión válida de `profesional`
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con un `id` de paciente inexistente y un lote FDI válido
- **THEN** recibe `404` con `{"code":"NO_ENCONTRADO"}` y no crea ningún odontograma

#### Scenario: Dos actualizaciones simultáneas sobre un paciente sin odontograma previo
- **GIVEN** una sesión válida de `profesional` y `Paciente Ficticio Uno` sin odontograma previo en el repositorio
- **WHEN** llegan dos solicitudes simultáneas `PUT /api/pacientes/:id/odontograma` para ese paciente (una registrando pieza `16` como `caries` y la otra registrando pieza `21` como `obturado`)
- **THEN** ambas responden `200`, en `repos.odontogramas` existe exactamente **1 `Odontograma`** para ese paciente, y al consultar el odontograma ambos cambios figuran tanto en `piezas` como en `historial`

### Requirement: Validación FDI, estados por cara y consistencia intra-lote del odontograma
En `PUT /api/pacientes/:id/odontograma`, la API SHALL validar las 52 piezas FDI (`11–48` y `51–85` sin huecos), `EstadoDePieza`, `CaraPieza` opcional y rechazar con `400 FORMATO_INVALIDO` lotes vacíos o `> 260` ítems, estados de pieza completa (`ausente`, `corona`, `endodoncia`, `a_extraer`) con `cara`, duplicados `(pieza, cara)` o mezcla de pieza completa y cara sobre la misma pieza.

#### Scenario: Aceptación de todos los límites válidos de notación FDI permanente y temporaria
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` incluyendo los extremos de los 8 cuadrantes FDI (`11, 18, 21, 28, 31, 38, 41, 48` permanentes y `51, 55, 61, 65, 71, 75, 81, 85` temporarias) con estados válidos de `EstadoDePieza` y caras opcionales compatibles
- **THEN** recibe `200` y registra todas las piezas válidas

#### Scenario: Rechazo de códigos FDI en huecos o fuera de rango
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con una pieza en un hueco FDI o fuera de rango (por ejemplo `19`, `20`, `29`, `30`, `39`, `40`, `49`, `50`, `56`, `60`, `66`, `70`, `76`, `80` u `86`)
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ningún cambio en el odontograma

#### Scenario: Rechazo de códigos FDI no enteros o menores o iguales a cero
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con `pieza` igual a `0`, `-11` o `11.5`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ningún cambio

#### Scenario: Rechazo de estados o caras fuera de los contratos congelados
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con un estado no definido en `EstadoDePieza` (por ejemplo `danado`, `sensible` o `en_recambio`) o una `cara` no definida en `CaraPieza`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ningún cambio

#### Scenario: Rechazo de estados exclusivos de pieza completa enviados con cara
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con `cara` informada para cualquiera de los estados de pieza completa (`ausente`, `corona`, `endodoncia`, `a_extraer`, por ejemplo `{"pieza":16,"cara":"oclusal","estado":"ausente"}`)
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ningún cambio; en cambio esos 4 estados sin `cara` responden `200`, y `caries`, `obturado` y `sano` responden `200` tanto con `cara` como sin `cara`

#### Scenario: Rechazo de lote vacío en actualización de odontograma
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con `{"piezas":[]}`
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no crea ni modifica ningún odontograma

#### Scenario: Rechazo de lote que supera el máximo de 260 ítems en actualización de odontograma
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con un arreglo `piezas` de `261` elementos
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no crea ni modifica ningún odontograma

#### Scenario: Aceptación de múltiples caras distintas de la misma pieza en un mismo lote
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con `{"piezas":[{"pieza":16,"cara":"oclusal","estado":"caries"},{"pieza":16,"cara":"mesial","estado":"obturado"}]}`
- **THEN** recibe `200`, ambas caras de la pieza `16` coexisten en `piezas` y ambos registros quedan persistidos en `historial`

#### Scenario: Rechazo de pares pieza-cara duplicados dentro del mismo pedido
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` con dos ítems que comparten el mismo `(pieza, cara)` (por ejemplo dos ítems para `(16, 'oclusal')` o dos ítems para `(21, undefined)`)
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ninguno de los ítems del lote

#### Scenario: Rechazo de mezcla de pieza completa y cara específica sobre la misma pieza en el mismo pedido
- **GIVEN** una sesión válida de `profesional` y un paciente existente
- **WHEN** envía `PUT /api/pacientes/:id/odontograma` mezclando un ítem de pieza completa sin `cara` y al menos un ítem con `cara` específica para la misma `pieza` (por ejemplo `(16, undefined)` junto con `(16, 'oclusal')`)
- **THEN** recibe `400` con `code` `FORMATO_INVALIDO` y no persiste ninguno de los ítems del lote

### Requirement: Control de acceso por rol y visibilidad multiprofesional
Las cuatro rutas clínicas SHALL exigir autenticación (`401 NO_AUTENTICADO`) y rol `profesional` (`403 SIN_PERMISO` para `recepcionista` y `paciente`, antes de verificar existencia del paciente). Cualquier profesional autenticado SHALL poder consultar y registrar sobre cualquier paciente preservando siempre su propio `profesionalId`.

#### Scenario: Acceso sin autenticación o con token inválido en rutas clínicas
- **WHEN** un cliente invoca cualquiera de las cuatro rutas clínicas sin encabezado `Authorization: Bearer` o con un token inválido
- **THEN** recibe `401` con `{"code":"NO_AUTENTICADO"}`

#### Scenario: Recepcionista rechazada en rutas de historia clínica incluso con paciente inexistente
- **GIVEN** una sesión válida de `recepcionista`
- **WHEN** invoca `GET /api/pacientes/:id/historia` o `POST /api/pacientes/:id/historia` (tanto con un paciente existente como con un `id` inexistente)
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Recepcionista rechazada en rutas de odontograma incluso con paciente inexistente
- **GIVEN** una sesión válida de `recepcionista`
- **WHEN** invoca `GET /api/pacientes/:id/odontograma` o `PUT /api/pacientes/:id/odontograma` (tanto con un paciente existente como con un `id` inexistente)
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Paciente rechazado en rutas de historia clínica incluso sobre su propio identificador
- **GIVEN** una sesión válida de `paciente` correspondiente a `Paciente Ficticio Uno`
- **WHEN** invoca `GET /api/pacientes/:id/historia` o `POST /api/pacientes/:id/historia` usando su propio `pacienteId` o cualquier otro `id`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Paciente rechazado en rutas de odontograma incluso sobre su propio identificador
- **GIVEN** una sesión válida de `paciente` correspondiente a `Paciente Ficticio Uno`
- **WHEN** invoca `GET /api/pacientes/:id/odontograma` o `PUT /api/pacientes/:id/odontograma` usando su propio `pacienteId` o cualquier otro `id`
- **THEN** recibe `403` con `{"code":"SIN_PERMISO"}`

#### Scenario: Visibilidad y registro colaborativo entre dos profesionales del consultorio
- **GIVEN** `Dra. Ana Pérez` registró en `T1` una entrada `E1` en la historia clínica y el estado `caries` en la pieza `16` (cara `oclusal`) del odontograma de `Paciente Ficticio Uno`
- **WHEN** `Dr. Bruno Gómez` inicia sesión como `profesional` en `T2`, consulta historia clínica y odontograma, registra una corrección `E2` con `corrigeAId = E1.id` y actualiza la pieza `16` (cara `oclusal`) a `obturado`
- **THEN** `Dr. Bruno Gómez` visualiza los registros de `Dra. Ana Pérez`, `E1` conserva `profesionalId` de `Dra. Ana Pérez`, `E2` queda con `profesionalId` de `Dr. Bruno Gómez`, y el `historial` del odontograma conserva ambos `EstadoPieza` con sus respectivos `registradoPor` (`Ana Pérez` en `T1`, `Bruno Gómez` en `T2`)

### Requirement: Datos 100 % ficticios en registros clínicos de prueba
Todos los fixtures, seeds, ejemplos y pruebas automatizadas del módulo `clinica` SHALL utilizar exclusivamente datos ficticios de pacientes, profesionales y textos clínicos (`RN-DA-01`), sin incluir datos personales o clínicos reales.

#### Scenario: Suite clínica libre de datos reales de pacientes
- **WHEN** se inspeccionan los fixtures y casos de prueba de `tests/clinica/` y los artefactos de `openspec/changes/historia-clinica-y-odontograma/`
- **THEN** únicamente aparecen entidades ficticias (como `Paciente Ficticio Uno`, `Paciente Ficticio Dos`, `Dra. Ana Pérez`, `Dr. Bruno Gómez` y evoluciones genéricas ficticias)
