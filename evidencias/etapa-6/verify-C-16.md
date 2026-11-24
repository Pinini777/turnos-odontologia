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

## Tests uno por escenario (revisión del PR #24, 2026-11-24)

En la revisión del PR, EP pidió cumplir la regla dura 8: un test de Vitest por cada escenario del spec. Antes había 18 tests agrupados y solo 5 escenarios figuraban con su nombre. Ahora `tests/persistencia/` tiene exactamente un `it('<nombre del escenario>')` por cada uno de los 33 escenarios de `openspec/specs/persistencia/spec.md` y del delta de `plataforma` del change.

| Comprobación | Resultado observado |
|---|---|
| Escenarios con test de nombre exacto | 33 de 33, sin tests extra |
| `npm run typecheck` y `npm run lint` | Correctos |
| `tests/persistencia` sin variables de base | 9 correctos y 24 omitidos (los de PostgreSQL) |
| `tests/persistencia` contra los esquemas `test_*` de `turnos-odontologia` | 5 archivos, 33 correctos (unos 225 s por la latencia del pooler) |
| Esquemas `test_*` residuales después de la corrida | 0 |
| `npm test` completo sin base | Correcto con `--testTimeout=30000` (626 correctos y 24 omitidos). Con el límite por defecto de 5 s, en esta PC fallan por tiempo tests de módulos que C-16 no modifica (agenda, cuentas, reserva-online y reprogramación); el CI los ejecuta en verde. |

Ajustes realizados solo en los tests (sin cambios en `src/`, specs ni migraciones):
- Los escenarios de migración y de arranque o apagado se verifican llamando a `migrarEsquema` y a `abrirRepositorios` con un esquema `test_*`, que son las funciones que usan `npm run db:migrar` y `src/server.ts`. Los tests no tocan `public`. La migración contra `public` y el apagado del proceso real se verificaron a mano (sección anterior).
- Dos tests de PostgreSQL quedaban fuera del `skipIf` y habrían fallado en el CI sin base; ahora se omiten cuando no hay `TEST_DATABASE_URL`.
- El cierre del pool se verifica con el mensaje genérico del adaptador, que oculta a propósito el detalle del driver.
- La siembra sobre PostgreSQL y el test que arranca otro Vitest tienen límites de tiempo explícitos, por la latencia del pooler y la carga del runner.
