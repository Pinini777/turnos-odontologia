# Spec Delta — Persistencia

## Purpose

Conservar los datos del consultorio entre reinicios mediante un backend PostgreSQL optativo que preserve los contratos actuales de la API y de sus repositorios.

## ADDED Requirements

### Requirement: Selección optativa del backend
La API SHALL usar PostgreSQL solo cuando `DATABASE_URL` tenga un valor y conservar el backend en memoria por defecto. La selección no alterará las rutas, casos de uso, interfaces de repositorios ni la autenticación de C-04. El pool SHALL cerrarse ante `SIGINT` y `SIGTERM`.

#### Scenario: Reinicio con persistencia habilitada
- **GIVEN** un esquema migrado y `DATABASE_URL` válida en el entorno o en el `.env` local
- **WHEN** se inicia la API, se autentican el profesional y el paciente ficticio Mario Santos, se crea un turno válido y se reinicia la API
- **THEN** los logins siguen funcionando y la consulta autorizada devuelve el mismo turno, con el mismo ID y estado

#### Scenario: Falla de conexión configurada
- **GIVEN** `DATABASE_URL` configurada pero el destino no está disponible
- **WHEN** se intenta iniciar la API
- **THEN** el arranque falla sin pasar silenciosamente a memoria y no muestra la cadena, sus credenciales ni parámetros SQL

#### Scenario: Arranque y CI sin base
- **GIVEN** que no hay `DATABASE_URL`, incluso si existe `TEST_DATABASE_URL` solo para pruebas
- **WHEN** se inicia la API, se ejecutan los tests ordinarios o se verifican los comandos de CI sin `.env`
- **THEN** se conserva el comportamiento en memoria y la API no abre una conexión remota

#### Scenario: Apagado ordenado en PostgreSQL
- **GIVEN** una API iniciada con el backend PostgreSQL
- **WHEN** el proceso recibe `SIGINT` o `SIGTERM`
- **THEN** se cierra el servidor y se libera el pool

### Requirement: Equivalencia de los repositorios
Los doce repositorios PostgreSQL SHALL implementar los puertos actuales. Guardar reemplaza por ID; buscar, listar y comprobar existencia conservan el contrato de memoria; borrar se limita a horarios y bloqueos; agregar solo inserta. Fechas, importes, opcionales y detalle de auditoría conservan su forma de dominio al volver.

#### Scenario: Contrato común de lectura y escritura
- **GIVEN** repositorios vacíos para la misma batería de pruebas
- **WHEN** se guardan entidades, se consulta por ID, se llama a `existe`, se lista con y sin predicado, se borra un horario y un bloqueo y se agregan registros append-only
- **THEN** se observan las mismas entidades, orden de inserción y efectos que en memoria, sin habilitar borrado en otros puertos

#### Scenario: Documento o correo único duplicado
- **GIVEN** una fila de la tabla correspondiente con un documento de paciente o un correo normalizado ya guardado
- **WHEN** se intenta guardar otra fila de esa tabla con el mismo valor único y un ID distinto
- **THEN** PostgreSQL rechaza la escritura sin actualizar la fila anterior; el adaptador traduce las restricciones de C-04 a `DUPLICADO`

#### Scenario: Upsert, ausencia y representación de datos
- **GIVEN** una entidad con campos opcionales ausentes, un importe de `15000.25` ARS y una auditoría con una fecha anidada y una cadena ISO deliberada
- **WHEN** se actualiza una entidad por el mismo ID y se recuperan las entidades y el detalle, incluyendo la búsqueda de un ID inexistente
- **THEN** no se duplica la fila ni se mueve su posición, la búsqueda inexistente devuelve `undefined`, los campos opcionales siguen ausentes, el importe conserva sus centavos y solo las fechas originales retornan como `Date`

#### Scenario: Una cuenta conserva el correo de su propia ficha
- **GIVEN** una ficha ficticia sin cuenta con documento y correo válidos
- **WHEN** se registra su titular por el flujo de vinculación de C-04
- **THEN** la ficha queda vinculada a la cuenta sin que el mismo correo en ambas tablas se trate como un duplicado ajeno

### Requirement: Exclusión de solapamientos en PostgreSQL
La base SHALL impedir turnos no cancelados solapados por profesional o por box, con intervalos `[inicio, fin)`. Se mantiene el lock de agenda. Cada exclusión SHALL traducirse al código de conflicto vigente para el recurso que la causó.

#### Scenario: Dos recursos disponibles
- **GIVEN** un profesional y un box libres para el horario solicitado
- **WHEN** se guarda un turno válido
- **THEN** PostgreSQL conserva el turno y la aplicación puede recuperarlo

#### Scenario: La barrera de base detecta el mismo profesional
- **GIVEN** que un turno activo de otro box ocupa al profesional y el conflicto llega al adaptador sin ser resuelto por la validación previa
- **WHEN** la exclusión rechaza la escritura
- **THEN** la API devuelve `409 {"code":"SOLAPAMIENTO_PROFESIONAL"}` y no queda otro turno superpuesto

#### Scenario: La barrera de base detecta el mismo box
- **GIVEN** que un turno activo de otro profesional ocupa el box y el conflicto llega al adaptador sin ser resuelto por la validación previa
- **WHEN** la exclusión rechaza la escritura
- **THEN** la API devuelve `409 {"code":"SOLAPAMIENTO_BOX"}` y no queda otro turno superpuesto

#### Scenario: Turnos contiguos
- **GIVEN** un turno activo de 10:00 a 10:30
- **WHEN** se guarda un turno de 10:30 a 11:00 con el mismo profesional y box
- **THEN** ambos turnos quedan guardados

#### Scenario: Un turno cancelado no ocupa el intervalo
- **GIVEN** un turno cancelado
- **WHEN** se guarda un nuevo turno para el mismo intervalo y los mismos recursos
- **THEN** el nuevo turno queda guardado sin borrar el anterior

### Requirement: Inmutabilidad de los registros
PostgreSQL SHALL rechazar el borrado físico de turnos y la actualización o el borrado de auditoría, historia clínica y estados de pieza. Las inserciones y las operaciones válidas de los módulos SHALL conservar el orden de escritura y el resultado visibles actuales.

#### Scenario: Cancelación con auditoría
- **GIVEN** un turno activo y una operación de cancelación autorizada
- **WHEN** se cancela a través de la API
- **THEN** el turno permanece guardado con estado `cancelado` y se agrega la auditoría correspondiente

#### Scenario: SQL directo intenta alterar el historial
- **GIVEN** un turno y filas de auditoría, historia clínica y estados de pieza existentes
- **WHEN** se intenta un `DELETE` directo del turno, o un `UPDATE` o `DELETE` directo en cualquiera de las tres tablas append-only
- **THEN** PostgreSQL rechaza cada operación y conserva las filas sin cambios

#### Scenario: Primera escritura con relaciones aún no materializadas
- **GIVEN** una reserva online válida todavía sin turno, o un paciente sin odontograma previo
- **WHEN** el flujo correspondiente agrega auditoría o estados de pieza antes de guardar la cabecera
- **THEN** la operación válida termina con ambas partes guardadas, sin reordenar ni modificar los casos de uso

### Requirement: Migraciones versionadas y acceso privado
`npm run db:migrar` SHALL aplicar las migraciones pendientes en orden y registrar cada éxito en `schema_migrations`. Todas las tablas administradas, incluido ese registro, SHALL tener RLS activo sin políticas ni permisos de Data API pública. La configuración y los errores no revelarán secretos.

#### Scenario: Primera migración autorizada
- **GIVEN** la base autorizada sin esquema de aplicación
- **WHEN** se ejecuta `npm run db:migrar` con la conexión configurada
- **THEN** se crean las tablas y garantías, cada migración aplicada figura una vez y las tablas tienen RLS activo sin reglas de acceso público

#### Scenario: Falla una migración pendiente
- **GIVEN** una migración pendiente que no puede completarse
- **WHEN** se ejecuta el migrador
- **THEN** termina con error sin registrar esa migración como aplicada ni imprimir la cadena de conexión, credenciales o parámetros de consultas

#### Scenario: Segunda ejecución sin pendientes
- **GIVEN** un esquema ya actualizado
- **WHEN** se vuelve a ejecutar el comando
- **THEN** no se reaplica ninguna migración ni se cambia el contenido de las tablas

### Requirement: Siembra inicial sin duplicación
La API con PostgreSQL SHALL cargar las semillas base y demo ficticias solo si las tablas de aplicación están vacías, esperando que termine la siembra antes de atender solicitudes. La semilla del modo memoria conserva el comportamiento actual.

#### Scenario: Primer arranque con tablas vacías
- **GIVEN** una base migrada con las tablas de aplicación vacías
- **WHEN** arranca el servidor PostgreSQL por primera vez
- **THEN** están disponibles los datos base, los datos demo y las cuentas ficticias antes de atender solicitudes

#### Scenario: No se puede completar la semilla
- **GIVEN** una falla durante la siembra inicial
- **WHEN** el servidor intenta cargar las semillas
- **THEN** no anuncia disponibilidad ni deja una siembra parcial persistida

#### Scenario: Reinicio con datos existentes
- **GIVEN** una siembra completa con turnos y registros de auditoría, o una base que ya tiene datos propios ficticios
- **WHEN** se vuelve a iniciar la API
- **THEN** no se duplican, reemplazan ni desplazan las semillas ni los datos existentes

### Requirement: Verificación aislada de los dos modos
La verificación SHALL ejecutar el contrato en memoria siempre y añadir PostgreSQL solo si existe `TEST_DATABASE_URL`. Cada ejecución PostgreSQL SHALL migrar y eliminar su propio esquema de prueba, incluso si hay fallas recuperables, sin escribir en `public` ni modificar extensiones compartidas.

#### Scenario: Suite PostgreSQL habilitada
- **GIVEN** la conexión de prueba autorizada y la extensión requerida ya disponible
- **WHEN** se ejecuta la suite PostgreSQL
- **THEN** crea un esquema exclusivo, verifica el contrato y las restricciones, y elimina solo ese esquema al terminar

#### Scenario: Un test PostgreSQL falla
- **GIVEN** un esquema de prueba creado en esta ejecución
- **WHEN** falla una aserción o una fase posterior de preparación
- **THEN** la falla se informa y se intenta eliminar el esquema de esa ejecución, sin borrar otros esquemas

#### Scenario: Verificación estándar sin base
- **GIVEN** un clon limpio sin variables de base
- **WHEN** se ejecutan `npm test`, `npm run typecheck`, `npm run lint` y `npm run build -w web`
- **THEN** los comandos pasan sin conectar a PostgreSQL y la parte remota del contrato queda omitida
