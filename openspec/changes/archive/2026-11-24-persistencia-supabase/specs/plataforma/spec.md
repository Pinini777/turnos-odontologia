# Spec Delta — Plataforma

## MODIFIED Requirements

### Requirement: Datos semilla ficticios
En memoria, la API SHALL arrancar con los datos semilla de `04_modelo_de_datos.md`: dos profesionales, dos boxes, cuatro prestaciones, horarios de lunes a viernes de 09:00 a 13:00 y de 15:00 a 19:00, y pacientes y usuarios ficticios. En PostgreSQL, SHALL sembrar solo si las tablas de aplicación están vacías. Ningún dato semilla puede parecer real (RN-DA-01).

#### Scenario: Contenido de la semilla
- **WHEN** se cargan los datos semilla
- **THEN** existen "Dra. Ana Pérez" y "Dr. Bruno Gómez", "Box 1" y "Box 2", y las prestaciones Consulta (30), Limpieza (45), Extracción simple (60) y Control (15), todas con duración múltiplo de 15

#### Scenario: Pacientes y usuarios ficticios
- **WHEN** se revisan los pacientes y usuarios de la semilla base
- **THEN** todos los emails terminan en `@example.com`, todos los documentos tienen la forma `0000000N` y ningún nombre completo de paciente deja de empezar con "Paciente Ficticio"

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
