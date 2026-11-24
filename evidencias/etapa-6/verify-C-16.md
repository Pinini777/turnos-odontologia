# Verificación C-16 — Persistencia en Supabase

- Rama: `dev-ep`; fecha: 2026-11-24.
- Destino autorizado: `turnos-odontologia` (`xgfczhqbyceuvawmfkiu`), PostgreSQL 17.
- Datos exclusivamente ficticios. No se incluyen cadenas de conexión, claves ni tokens.

## Pruebas locales y aisladas

| Comprobación | Resultado observado |
|---|---|
| `npm run typecheck` | Correcto para API y web. |
| `npm run lint` | Correcto tras eliminar dos variables no utilizadas. |
| `npm test` sin variables de base | Código 0 con un worker: API 623 correctas, 15 omitidas; web 155 correctas. |
| `npm run build -w web` | Código 0; 99 módulos transformados. Advertencias de tamaño de chunks del frontend. |
| Suite `tests/persistencia` con la conexión de prueba | 5 archivos, 21 pruebas correctas. |
| Aislamiento | Después de la suite: cero esquemas de prueba residuales y cero tablas de aplicación en `public`. El registro `schema_migrations` tenía solo la migración de la extensión. |
| Cierre | `SIGINT` y `SIGTERM` emitidas en proceso con el servidor en memoria: ambas corridas terminaron con código 0. En PostgreSQL, la suite verifica el cierre del pool y la reapertura contra el mismo esquema. |

La suite PostgreSQL comprueba el contrato de persistencia, centavos y JSONB con fechas, orden e idempotencia de migraciones, exclusiones GiST y los dos `409` en Fastify, inmutabilidad, RLS sin acceso público, siembra y reversión. La preparación de `btree_gist` se aplicó antes del SQL de aplicación para respetar el aislamiento de pruebas.

En las corridas previas sin base, la configuración de workers por defecto arrojó 6 timeouts de API y la prueba con dos workers arrojó 2 fallas; los 155 tests web y su build pasaron por separado. La corrida completa en verde usó `VITEST_MAX_FORKS=1`, `VITEST_MIN_FORKS=1`, `VITEST_MAX_THREADS=1` y `VITEST_MIN_THREADS=1` en el proceso de pruebas, sin editar configuración del repositorio. No se determinó la causa de los timeouts previos.

Una revisión independiente no encontró bloqueos concretos en migraciones, permisos, exclusiones ni arranque. Se confirmó que los módulos, los puertos compartidos, las semillas, el lock y la web no cambiaron.

## Prueba del destino autorizado

`npm run db:migrar` registró dos migraciones en total: la preparación de `btree_gist` y el esquema de aplicación. El catálogo confirmó 12 tablas de aplicación más el registro, las 13 con RLS activo, y cero esquemas de prueba residuales. Los advisors de seguridad devolvieron solo `rls_enabled_no_policy` con nivel `INFO`; es el comportamiento intencional del diseño privado, sin políticas públicas.

En el primer `npm start`, el profesional y Mario Santos iniciaron sesión (`200`), `POST /api/turnos` devolvió `201` para un turno ficticio y Mario lo consultó en estado `reservado`. Se detuvo el primer proceso y se verificó que el puerto estuviera libre. En el segundo `npm start`, ambos volvieron a iniciar sesión y Mario recuperó el mismo turno en estado `reservado`. No se sembraron nuevamente los datos.

Límites: no se probó con datos reales, varias API activas ni Supabase Auth. Las señales se ejercitaron en proceso en Windows; no se verificó su entrega desde un supervisor en producción.
