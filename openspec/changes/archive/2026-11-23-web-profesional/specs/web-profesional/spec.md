# Spec Delta

## Purpose

Interfaz web exclusiva del rol `profesional` (`web/src/pages/profesional/`) para Clínica Dental Alvear: catálogo de prestaciones con precios en ARS, boxes y profesionales, horarios y bloqueos en grilla de 15 minutos, ganancias estrictamente propias, historia clínica append-only con odontograma SVG FDI interactivo, y agenda con auditoría de turnos.

## ADDED Requirements

### Requirement: Protección RBAC de rutas del módulo profesional
Las rutas de `/profesional/*` SHALL exigir una sesión activa con rol `profesional`: sin sesión redirigen a `/login`, y con rol `recepcionista` o `paciente` muestran acceso denegado (`SIN_PERMISO`) sin disparar llamadas a la API profesional.

#### Scenario: Usuario sin sesión es redirigido a login
- **GIVEN** no existe una sesión activa en `useSesion`
- **WHEN** se navega a `/profesional/catalogo`
- **THEN** la aplicación redirige a `/login` y no invoca ningún endpoint profesional

#### Scenario: Recepcionista recibe acceso denegado SIN_PERMISO sin llamadas a la API
- **GIVEN** existe una sesión activa con rol `recepcionista`
- **WHEN** intenta acceder a `/profesional/ganancias`
- **THEN** se muestra `AlertaErrorNegocio` con código `SIN_PERMISO` y no se ejecuta ninguna petición HTTP a `/api/profesionales` ni `/api/agenda`

#### Scenario: Paciente recibe acceso denegado SIN_PERMISO sin llamadas a la API
- **GIVEN** existe una sesión activa con rol `paciente`
- **WHEN** intenta acceder a `/profesional/clinica`
- **THEN** se muestra `AlertaErrorNegocio` con código `SIN_PERMISO` y no se ejecuta ninguna petición HTTP a `/api/pacientes` ni `/api/profesionales`

### Requirement: Catálogo de prestaciones, boxes y profesionales
`/profesional/catalogo` SHALL permitir consultar, crear y editar prestaciones (precios ARS y duración mediante `<select>` en múltiplos de 15 min de `15` a `180`), **boxes** (siempre `box`) y profesionales, mostrando errores `400`/`409` (`DURACION_INVALIDA`) en `AlertaErrorNegocio`.

#### Scenario: Listado inicial muestra prestaciones con precios ARS, boxes y profesionales
- **GIVEN** una sesión activa de `profesional` y datos ficticios en `/api/prestaciones`, `/api/boxes` y `/api/profesionales`
- **WHEN** se abre `/profesional/catalogo` y se recorren sus pestañas
- **THEN** se visualizan los precios formateados en ARS, los boxes identificados como "Box 1"/"Box 2" (nunca "sillón") y el listado de profesionales

#### Scenario: Alta y edición de prestación actualiza el catálogo
- **GIVEN** un profesional en la pestaña Prestaciones de `/profesional/catalogo`
- **WHEN** selecciona `30` min en el `<select>` de duración y `precio: 18000`, crea la prestación y luego actualiza su precio vía `PATCH /api/prestaciones/:id`
- **THEN** se invocan `POST /api/prestaciones` y `PATCH /api/prestaciones/:id` y la tabla refleja los valores actualizados en ARS

#### Scenario: Selector de duración en múltiplos de 15 y alerta defensiva DURACION_INVALIDA
- **GIVEN** un profesional en el formulario de prestación de `/profesional/catalogo`
- **WHEN** inspecciona el control de duración y la API responde `409 {"code":"DURACION_INVALIDA"}` al guardar
- **THEN** la duración es un `<select>` con únicamente múltiplos de 15 min (`15` a `180`, sin campo libre) y se renderiza `AlertaErrorNegocio` (`role="alert"`) con `DURACION_INVALIDA`

#### Scenario: Gestión de boxes y profesionales con errores 400 y 409 visibles
- **GIVEN** un profesional en las pestañas Boxes y Profesionales de `/profesional/catalogo`
- **WHEN** da de alta un nuevo box exitosamente y luego recibe `409 DUPLICADO` o `400 FORMATO_INVALIDO` al crear otro recurso
- **THEN** el alta válida actualiza la lista y los errores `400`/`409` se muestran de forma accesible mediante `AlertaErrorNegocio`

### Requirement: Horarios propios y bloqueos de agenda en grilla de 15 minutos
`/profesional/horarios` SHALL gestionar franjas semanales en múltiplos de 15 min (`:00`, `:15`, `:30`, `:45`), informar `409 FUERA_DE_GRILLA`, y crear bloqueos propios o de box (XOR) por rango de fechas calendario con día completo por defecto u horas opcionales de 15 min (`POST /api/bloqueos`, `DELETE 204`).

#### Scenario: Carga de horarios propios con selectores múltiplos de 15 minutos
- **GIVEN** una sesión activa de `profesional` cuyo `usuarioId` corresponde a `prof-1` en `GET /api/profesionales`
- **WHEN** se abre `/profesional/horarios`
- **THEN** se consultan `GET /api/profesionales/prof-1/horarios` y `GET /api/bloqueos`, y los selectores de hora ofrecen únicamente bloques `:00`, `:15`, `:30` y `:45`

#### Scenario: Guardado de horarios propios vía POST /api/profesionales/:id/horarios
- **GIVEN** el profesional editó una franja horaria de Lunes de `09:00` a `13:00`
- **WHEN** pulsa "Guardar horarios"
- **THEN** se envía `POST /api/profesionales/prof-1/horarios` con el arreglo de franjas y se confirma el guardado en pantalla

#### Scenario: Conflicto 409 FUERA_DE_GRILLA al guardar horarios se muestra en alerta
- **GIVEN** el profesional intenta guardar cambios de horario en `/profesional/horarios`
- **WHEN** la API responde `409 {"code":"FUERA_DE_GRILLA"}`
- **THEN** se muestra `AlertaErrorNegocio` con el código `FUERA_DE_GRILLA` y su explicación en español rioplatense

#### Scenario: Alta de bloqueo día completo y rango horario opcional respetando exclusión XOR
- **GIVEN** el profesional en la sección Bloqueos de `/profesional/horarios` con `Día desde`, `Día hasta` y "Bloquear día completo" activo por defecto
- **WHEN** registra un bloqueo personal de varios días con día completo activo y luego cambia a "Box 1" desmarcando día completo y eligiendo `08:00` a `09:00`
- **THEN** el primer `POST /api/bloqueos` envía solo `profesionalId` con `[diaDesdeT00:00:00-03:00, diaSiguiente(diaHasta)T00:00:00-03:00)` y el segundo envía solo `boxId` con `inicio` `08:00-03:00` y `fin` `09:00-03:00`

#### Scenario: Eliminación de bloqueo existente vía DELETE 204
- **GIVEN** existe un bloqueo visible en la tabla de `/profesional/horarios`
- **WHEN** el profesional pulsa "Eliminar" y la API responde `204`
- **THEN** se invoca `DELETE /api/bloqueos/:id` y el bloqueo desaparece del listado sin errores

#### Scenario: Tira semanal Lun–Dom para sumar franjas en un clic
- **GIVEN** el profesional en `/profesional/horarios` con la tira semanal `Lun`–`Dom` y el día Lunes ya configurado
- **WHEN** pulsa un día ya configurado (`Lun`) y luego pulsa un día libre (`Sáb`) y guarda horarios
- **THEN** tocar el día ya configurado no duplica franjas, tocar `Sáb` agrega una franja `09:00`–`13:00` y `POST /api/profesionales/:id/horarios` incluye ambas franjas

#### Scenario: Chips de box sincronizados con el selector de bloqueo
- **GIVEN** el profesional en la sección Bloqueos de `/profesional/horarios` con boxes activos e inactivos cargados
- **WHEN** elige alcance "Un box del consultorio", pulsa el chip del box activo `Box 2`, elige fecha y motivo y registra el bloqueo
- **THEN** solo se muestran chips de boxes activos sincronizados con el `<select>` de box, el resumen previo refleja la selección y `POST /api/bloqueos` envía únicamente `boxId` sin `profesionalId`

#### Scenario: Atajos de fecha y franja horaria con autoajuste de Hora hasta
- **GIVEN** el profesional en el formulario de bloqueos de `/profesional/horarios` con "Bloquear día completo" activo por defecto
- **WHEN** usa los atajos de fecha (`Hoy`, `Mañana`, `Próxima semana`), activa "Elegir franja horaria", cambia `Hora desde` a una hora posterior a `Hora hasta` en el mismo día, prueba los presets horarios y fuerza un rango inválido
- **THEN** los atajos completan las fechas, `Hora hasta` se autoajusta a `Hora desde + 1 h` (tope `21:45`), los presets actualizan la franja y el rango inválido muestra validación inline sin enviar `POST /api/bloqueos`

#### Scenario: Filtros Todos, Mi agenda y Boxes sobre los bloqueos vigentes
- **GIVEN** la tabla de bloqueos vigentes en `/profesional/horarios` con bloqueos propios del profesional y bloqueos de box
- **WHEN** el profesional alterna entre los filtros `Mi agenda`, `Boxes` y `Todos`
- **THEN** la tabla muestra únicamente los bloqueos correspondientes a cada categoría con sus badges (`Mi agenda`, `Box`, `Día completo`) y muestra estado vacío cuando un filtro no tiene coincidencias

### Requirement: Ganancias privadas exclusivas del profesional logueado
`/profesional/ganancias` SHALL consultar únicamente el `profesionalId` del profesional autenticado sin ofrecer selector de otros profesionales, mostrando KPI total en ARS, desglose de turnos `atendido` con precio congelado, estado vacío en `$ 0` y alertas ante `403 SIN_PERMISO`.

#### Scenario: Consulta exclusiva del profesional logueado con KPI ARS y desglose de atendidos
- **GIVEN** una sesión de `profesional` asociada a `prof-1` con turnos `atendido` y `cancelado` en el período seleccionado
- **WHEN** abre `/profesional/ganancias`
- **THEN** invoca únicamente `/api/profesionales/prof-1/ganancias` y `/api/agenda?profesionalId=prof-1`, no muestra selector de otros profesionales, presenta el KPI total en ARS y lista solo los turnos `atendido` con su `precioAlReservar` congelado

#### Scenario: Período sin turnos atendidos muestra total en cero y estado vacío
- **GIVEN** el profesional selecciona un período sin turnos atendidos (`total: 0`, agenda vacía)
- **WHEN** finaliza la consulta en `/profesional/ganancias`
- **THEN** el KPI muestra `$ 0,00` y se renderiza `EstadoVacio` indicando que no hubo turnos atendidos en ese rango

#### Scenario: Respuesta 403 SIN_PERMISO al consultar ganancias se informa en alerta
- **GIVEN** el profesional accede a `/profesional/ganancias`
- **WHEN** `GET /api/profesionales/:id/ganancias` responde `403 {"code":"SIN_PERMISO"}`
- **THEN** se muestra `AlertaErrorNegocio` con el código `SIN_PERMISO` sin exponer montos ni datos parciales

### Requirement: Historia clínica append-only y odontograma SVG FDI interactivo
`/profesional/clinica` SHALL permitir elegir paciente, agregar evoluciones o correcciones (`corrigeAId`) sin editar ni borrar, y operar un odontograma SVG FDI fluido de 5 caras (`11–48` y `51–85`) sin scroll horizontal (`1440×900` y `390×844`), con orientación anatómica y `cara` deshabilitada en pieza completa.

#### Scenario: Carga de paciente e historia clínica append-only sin edición ni borrado
- **GIVEN** el profesional selecciona a "Paciente Ficticio Uno" desde `GET /api/pacientes` en `/profesional/clinica`
- **WHEN** cargan `GET /api/pacientes/:id/historia` y `GET /api/pacientes/:id/odontograma`
- **THEN** se muestran las entradas cronológicas sin ningún botón de editar o eliminar y el odontograma SVG FDI con las 32 piezas permanentes

#### Scenario: Alta de nueva evolución y de corrección referenciando corrigeAId
- **GIVEN** la historia clínica de un paciente cargada con al menos una entrada previa `hc-1`
- **WHEN** el profesional guarda una evolución nueva y luego agrega una corrección desde `hc-1`
- **THEN** el primer `POST /api/pacientes/:id/historia` envía `{ texto }` y el segundo envía `{ texto, corrigeAId: "hc-1" }`, agregando ambas entradas al historial sin mutar las anteriores

#### Scenario: Selección de pieza y cara en odontograma FDI con orientación anatómica y toggle temporario
- **GIVEN** el odontograma SVG FDI visible en `/profesional/clinica`
- **WHEN** el profesional selecciona la cara mesial de la pieza `16` (derecha del glifo en cuadrante 1) y activa el toggle de dentición temporaria
- **THEN** el panel de edición muestra la pieza `16`, la cara `mesial` y el odontograma incorpora las 20 piezas temporarias (`51–85`) con etiquetas ARIA accesibles

#### Scenario: Estados de pieza completa deshabilitan cara y actualizan odontograma vía PUT
- **GIVEN** la pieza `26` seleccionada en el odontograma SVG FDI
- **WHEN** el profesional elige el estado `corona` (o `ausente`, `endodoncia`, `a_extraer`) y pulsa "Guardar en odontograma"
- **THEN** el selector de `cara` queda deshabilitado automáticamente, `PUT /api/pacientes/:id/odontograma` se envía sin propiedad `cara`, y la vista actualiza tanto `piezas` como la tabla cronológica de `historial`

#### Scenario: Fallback automático al mapa clásico 2D sin WebGL 2
- **GIVEN** un paciente seleccionado en `/profesional/clinica` en un entorno sin soporte de WebGL 2
- **WHEN** se monta el odontograma
- **THEN** hace fallback automático al Mapa clásico 2D SVG sin errores mostrando las 32 piezas permanentes, mantiene activo el botón "Mapa clásico" y deja deshabilitado el botón "3D"

#### Scenario: Vista Rayos X disponible en modo 3D y deshabilitada en mapa clásico 2D
- **GIVEN** el componente `Odontograma3d` montado con el motor 3D activo
- **WHEN** el profesional activa "Rayos X" en vista 3D y luego alterna a "Mapa clásico"
- **THEN** en vista 3D el botón "Rayos X" está habilitado y actualiza `aria-pressed` y el estado del motor, y al cambiar a "Mapa clásico" queda deshabilitado con `aria-pressed="false"`

#### Scenario: Borrador multi-cambio guardado en un solo PUT
- **GIVEN** un paciente cargado en `/profesional/clinica` con el odontograma visible
- **WHEN** el profesional agrega dos cambios al borrador, quita el primero con "Deshacer" y pulsa "Guardar en odontograma"
- **THEN** no aparecen botones de editar ni borrar, el borrador conserva solo el cambio restante y envía un único `PUT /api/pacientes/:id/odontograma` con ese lote

#### Scenario: Máquina del tiempo en solo lectura sobre el historial
- **GIVEN** un paciente en `/profesional/clinica` con múltiples consultas en `historial` del odontograma
- **WHEN** el profesional desplaza la Máquina del tiempo a una consulta anterior y luego pulsa "Volver al presente"
- **THEN** el odontograma proyecta el estado de esa consulta histórica deshabilitando el guardado y la edición, y al volver al presente restaura el estado actual y rehabilita los cambios

### Requirement: Agenda profesional y auditoría append-only de turnos
`/profesional/agenda` y `/profesional/turnos/:id/auditoria` SHALL listar turnos mediante `GET /api/agenda` y abrir la cronología append-only de auditoría vía `GET /api/turnos/:id/auditoria` mostrando acción, actor, fecha y detalle sin controles de modificación.

#### Scenario: Listado de turnos en agenda profesional mediante GET /api/agenda
- **GIVEN** una sesión activa de `profesional` en `/profesional/agenda`
- **WHEN** se carga la agenda del rango seleccionado y se aplican filtros de profesional o box
- **THEN** se invoca `GET /api/agenda` con los parámetros correspondientes y se listan los turnos con su `BadgeEstadoTurno` y botón "Ver auditoría"

#### Scenario: Panel de auditoría muestra cronología append-only de un turno
- **GIVEN** un turno `turno-1` seleccionado desde `/profesional/agenda` o navegado directamente en `/profesional/turnos/turno-1/auditoria`
- **WHEN** responde `GET /api/turnos/turno-1/auditoria` con registros `creado` y `estado_cambiado`
- **THEN** se muestra la cronología ordenada con acción, actor, fecha y detalle antes/después sin botones de edición ni borrado

### Requirement: Datos ficticios, terminología box y layout sin scroll horizontal
Todas las vistas y mockups de `web-profesional` SHALL emplear exclusivamente datos ficticios (`RN-DA-01`), usar siempre el término `box` (nunca "sillón") y adaptarse a `1440×900` y `390×844` sin scroll horizontal (`overflow-x: auto` ni anchos mínimos desbordantes).

#### Scenario: Interfaz y textos visibles cumplen RN-DA-01, usan box y evitan scroll horizontal
- **GIVEN** las rutas renderizadas y mockups de `web-profesional` con datos ficticios de la clínica
- **WHEN** se inspeccionan los textos y estilos de catálogo, horarios, ganancias, clínica y agenda
- **THEN** no aparece el término "sillón" ni datos reales, todas las etiquetas utilizan "Box" y ningún panel, tabla ni odontograma introduce scroll horizontal en `1440×900` ni `390×844`
