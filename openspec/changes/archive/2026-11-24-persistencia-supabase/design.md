# Design — C-16 Persistencia en Supabase

**Estado:** aprobado por EP el 2026-11-24 para Apply, con el destino y las verificaciones definidos en este diseño.

## Context

La integración disponible es `buildApp({ repos })`. El alcance y la motivación están en [proposal.md](proposal.md); el orden observado de las escrituras, en [explore.md](explore.md). C-01 a C-15 permanecen sin cambios de implementación.

## Goals / Non-Goals

- **Objetivo:** conservar la semántica de los puertos y añadir garantías locales a las tablas PostgreSQL sin acoplar el dominio al driver.
- **Fuera de alcance:** importar turnos de procesos previos en memoria, reemplazar JWT/bcrypt, cambiar rutas o precios, reescribir flujos multirrepositorio, soportar varias instancias activas o habilitar producción con datos reales.

## Decisions

### Conexión y arranque

`src/server.ts` elige los repositorios y los entrega a `buildApp`. Sin `DATABASE_URL` conserva el camino actual, incluida la demo en memoria. La entrada `start` usará `node --env-file-if-exists=.env --import tsx src/server.ts`; `db:migrar` también carga `.env` de forma optativa, pero exige `DATABASE_URL`. Los tests estándar no cargan `.env` automáticamente. No se modifican `src/app.ts`, `src/modules/**`, los puertos ni las suites de cada módulo.

Se propone fijar `postgres@3.4.8`, sin otras dependencias. Para C-16, solo se permite el proyecto `turnos-odontologia` (`xgfczhqbyceuvawmfkiu`, `us-east-2`, PostgreSQL 17) con las conexiones indicadas por EP. El servidor usa un pool pequeño (propuesta: hasta tres conexiones) con `ssl: 'require'` sobre el Session pooler (5432); el modo transaccional de Supavisor no es el destino de esta integración. Fastify libera el pool al cerrar; `SIGINT`, `SIGTERM` y un arranque fallido pasan por el cierre correspondiente. No se registran errores crudos del driver, parámetros SQL ni credenciales; las fallas inesperadas se comunican con contexto operativo no sensible y el error HTTP existente.

### Adaptador y representación

`src/shared/persistencia/` implementa los doce puertos: upsert de las filas editables por ID; `DELETE` solo para horarios y bloqueos; `INSERT` sin upsert en las tres tablas append-only. Se conserva el orden de inserción con un ordinal interno que no cambia al actualizar. `listar` aplica el predicado en JavaScript después de hidratar los registros; no se amplían los puertos para traducir predicados.

> `// shortcut: carga la tabla completa y filtra en JS; alcanza para un consultorio de 1 a 3 profesionales; pasar a consultas SQL si crece el volumen.`

- Fechas de columnas en `timestamptz` e hidratadas como `Date`; opcionales nulos en SQL y ausentes en TypeScript. Los documentos se guardan como texto.
- Los importes se guardan como centavos enteros en `bigint` y vuelven como `number` en ARS. A diferencia de `integer` en pesos, conserva los dos decimales existentes; `bigint` deja espacio para todo el rango de `decimal(12,2)` de la KB sin desbordar al convertir a centavos.
- `detalle` es `jsonb`. Se registra qué rutas del valor eran `Date` para rehidratarlas sin convertir cadenas ISO deliberadas. No se introducen metadatos de persistencia en la forma devuelta por el puerto.
- Correo único en cada tabla de usuarios y pacientes conforme a la normalización de C-04, y documento único en pacientes. Se conservan el lock y la validación cruzada del dominio: una ficha y su cuenta vinculada pueden compartir correo. Solo las restricciones reconocidas de unicidad se traducen a `DUPLICADO`.

### Invariantes en PostgreSQL sin cambiar el dominio

- Dos restricciones GiST de exclusión con `btree_gist`: igualdad del profesional o del box y cruce de `tstzrange(inicio, fin, '[)')`, aplicadas solo cuando `estado <> 'cancelado'`. Traducir `23P01` por nombre de restricción a `SOLAPAMIENTO_PROFESIONAL` o `SOLAPAMIENTO_BOX`; el handler actual produce `409`. El lock local sigue a cargo de la operación de agenda y del orden de las validaciones de aplicación.
- Triggers impiden `DELETE` de turnos y `UPDATE`/`DELETE` de auditoría, historia clínica y estados de pieza. No impiden cancelar un turno ni agregar una corrección clínica.
- Usar FKs donde el padre ya existe según los flujos actuales. No agregar FKs inmediatas para `auditoria.turno_id` ni `estados_pieza.odontograma_id`: la reserva online y el primer odontograma escriben primero el hijo. `auditoria.actor` admite un literal, no es una FK incondicional a usuarios. Una FK diferida sin transacción compartida no resuelve el problema; no se cambia el orden de escritura ni se añade una transacción transversal a los casos de uso.
- Habilitar RLS sin políticas y no dar permisos a roles de la Data API pública en todas las tablas administradas, incluida `schema_migrations`. Usar funciones de trigger no privilegiadas con `search_path` fijo y consultar advisors solo en el proyecto autorizado. Corregir hallazgos que afecten a C-16 mediante nuevas migraciones del repo, no desde el dashboard ni el MCP.

### Migraciones y siembra

SQL ordenado por prefijo `AAAAMMDDHHMMSS` en `supabase/migrations/`. Registrar cada migración con su ejecución en una transacción; una falla no deja su registro aplicado. Los nombres de tablas no se califican con `public`; el runner controla el esquema. Separar el prerrequisito global `create extension if not exists btree_gist with schema extensions` de las tablas de aplicación.

Para el esquema migrado de la API, materializar `SEED` y demo con los repositorios en memoria que ya usan las funciones de semilla, sin duplicar sus datos ni modificar dichas funciones. En una transacción PostgreSQL, comprobar que no haya filas de aplicación y esperar las escrituras en orden de dependencias. Un segundo arranque no modifica datos; un fallo revierte la siembra. La API no escucha hasta que termina la preparación.

Para tests, un nombre aleatorio propio y un `search_path` que no incluya `public`; aplicar el mismo SQL de tablas y usar `btree_gist` ya instalado en `extensions`. Borrar exclusivamente ese esquema desde la limpieza que también cubre fallas de preparación, y cerrar el pool. `TEST_DATABASE_URL` puede ser la misma conexión de destino que `DATABASE_URL`; nunca es un sustituto de esta última para el servidor.

## Risks / Trade-offs

- **Servicio externo:** la región, la latencia y la posible pausa del plan gratuito afectan el modo optativo; CI y el uso sin configuración quedan locales. No es una habilitación para datos reales: el tratamiento por terceros y la Ley 25.326 requieren una evaluación separada antes de un uso productivo.
- **Consultas y consistencia:** `listar` lee la tabla completa; vale para el volumen previsto. Dos FKs se omiten para conservar flujos válidos. Las garantías GiST no proveen atomicidad entre todas las escrituras de los módulos ni amplían el soporte a varias instancias activas.
- **Extensión compartida:** si no está instalada, ejecutar primero la migración de infraestructura explícita y aprobada, antes de escribir la migración de tablas y para poder observar RED en la suite PostgreSQL. El único efecto anticipado es habilitar la extensión y registrar esa migración en el ledger protegido; no se despliegan tablas de aplicación. La suite no instala la extensión como efecto lateral.

## Migration Plan

1. Con el spec aprobado, verificar primero el entorno local sin conexión. Si falta `btree_gist`, ejecutar `npm run db:migrar` en el proyecto autorizado cuando la preparación de la extensión sea la única migración pendiente. No iniciar el servidor todavía. Si la extensión existe en `extensions`, no es necesario adelantar este paso.
2. Usar esquemas desechables para TDD PostgreSQL. En Verify, la suite PostgreSQL debe pasar antes de aplicar las migraciones de tablas al esquema público con `npm run db:migrar`. Después verificar el reinicio, los permisos del rol y los advisors.
3. Si se necesita volver al comportamiento anterior, apagar la API y quitar `DATABASE_URL` de su entorno. No se borran tablas ni se trasladan datos entre backends; cualquier reversión de datos o esquema requiere una decisión separada de EP.

## UI Mockups

Decision: no (no UI)

## References

- [PostgreSQL 17: exclusiones para tipos de rango](https://www.postgresql.org/docs/17/rangetypes.html#RANGETYPES-CONSTRAINT).
- [Supabase: Session pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#shared-pooler-session-mode) y [permisos y RLS de la Data API](https://supabase.com/docs/guides/api/securing-your-api).
- [Postgres.js 3.4.8](https://github.com/porsager/postgres/releases/tag/v3.4.8) y [Node.js 22: opciones de entorno](https://nodejs.org/download/release/v22.21.0/docs/api/cli.html#--env-file-if-existsfile).
