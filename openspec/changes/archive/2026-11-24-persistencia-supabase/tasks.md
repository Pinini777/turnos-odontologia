# Tasks — C-16 Persistencia en Supabase

**Puerta crítica:** no iniciar estas tareas sin aprobación explícita de EP del spec y sus decisiones. Para cada comportamiento, registrar RED → GREEN → REFACTOR cuando la prueba determinista pueda ejecutarse. No marcar una tarea sin su comprobación observada. Conservar intactas las suites de los módulos existentes.

**Apply (2026-11-24):** EP aprobó el diseño. Se restableció `npm ci` en `dev-ep`, se fijó `postgres@3.4.8` y una verificación independiente confirmó que el lockfile solo agrega el driver. El checkout no tiene `.env`; no se ejecutaron comprobaciones ni migraciones contra Supabase. Las variables de conexión ya figuran vacías en `.env.example`.

**Comprobación local:** `npm test` sin conexión: 605 tests de API pasaron y 12 fallaron, principalmente por tiempo de espera; la suite web no arrancó. La ejecución aislada de `tests/configuracion/horarios-bloqueos.test.ts` con un worker pasó 15/15. La verificación integrada no se considera completa.

**Continuación:** se verificaron ambas conexiones de PostgreSQL 17. Las pruebas del migrador pasaron 3/3 en esquemas propios. La migración de infraestructura instaló `btree_gist` en `extensions` y se comprobó que `public` conservaba cero tablas de aplicación.

**Pruebas de C-16:** la suite dedicada pasó 21/21 con PostgreSQL habilitado, incluidos los `409` de ambas exclusiones, la limpieza tras un fallo, RLS, las escrituras inmutables, la siembra y la conservación de datos al reabrir repositorios. No se aplicaron las tablas de aplicación antes de estas pruebas.

## 1. Entorno, migrador y prerrequisito

- [x] 1.1 Restablecer `npm ci` en `dev-ep`; agregar solo `postgres` con versión exacta y verificar el manifiesto, lockfile e instalación, sin publicar ni imprimir conexiones.
- [x] 1.2 Implementar el runner y el script `npm run db:migrar`; probar orden, registro transaccional, segunda ejecución sin cambios y falla sin registro ni secretos. Añadir en el README la configuración opcional del Session pooler, la preparación del esquema y las variables vacías de `.env.example`.
- [x] 1.3 Crear con el CLI de Supabase la migración de infraestructura para `btree_gist` en `extensions`. Tras la aprobación, comprobar la extensión en el único destino autorizado; si falta, aplicar solo esta migración con `npm run db:migrar` antes de incorporar el SQL de aplicación. Verificar que no se hayan creado tablas de aplicación.
- [x] 1.4 Crear el arnés de `tests/persistencia/`: memoria siempre, `describe.skipIf` para PostgreSQL sin `TEST_DATABASE_URL`, esquema generado por ejecución, exclusión de `public`, limpieza de errores y cierre. Probar la omisión sin variables y comprobar el aislamiento y limpieza con la conexión de pruebas.

## 2. Esquema y contrato de repositorios

- [x] 2.1 Versionar el SQL de las 12 tablas y sus tipos, unicidades y vínculos compatibles; comprobar en el esquema de pruebas RLS y ausencia de acceso público en todas las tablas, incluido el ledger.
- [x] 2.2 Implementar los 12 puertos detrás de `src/shared/persistencia/`; pasar la misma batería de guardar, upsert, buscar, listar, existe, borrar y agregar en los modos aplicables. Comprobar orden, ausencia de opcionales, fechas y JSONB, precios con centavos y duplicados C-04.
- [x] 2.3 Implementar las dos exclusiones GiST y su traducción; probar el `409` de cada recurso haciendo que el conflicto llegue a la barrera SQL, y probar turnos contiguos y huecos liberados por cancelación.
- [x] 2.4 Agregar triggers de inmutabilidad; probar cada combinación prohibida de tabla y operación y comprobar que las filas se mantienen intactas. Probar también una reserva online y un primer odontograma válidos con los módulos originales.

## 3. Arranque, siembra y documentación técnica

- [x] 3.1 Implementar la siembra PostgreSQL con datos base y demo existentes; probar una base vacía, segunda siembra sin cambios, respeto de una base con datos y rollback ante una falla.
- [x] 3.2 Integrar selección de backend y cierre del pool en `src/server.ts`; probar el camino sin `.env`, una conexión PostgreSQL válida, falla sin fallback ni secretos y cierre ante ambas señales. Completar el README con `npm start`, memoria por defecto y la pausa del plan gratuito.
- [x] 3.3 Agregar DD-14 y alinear KB `02`, `08` y `09` con modos, variables y riesgos; actualizar únicamente la fila Persistencia en `AGENTS.md` y `CLAUDE.md`. Verificar que ambos archivos sean idénticos y que las reglas duras no hayan cambiado.

## 4. Verificación integrada

- [x] 4.1 Sin variables de base, ejecutar `npm test`, `npm run typecheck`, `npm run lint` y `npm run build -w web`; con `TEST_DATABASE_URL`, ejecutar la suite PostgreSQL y confirmar que no dejó esquemas de prueba ni escribió en `public`.
- [x] 4.2 Con `DATABASE_URL`, aplicar `npm run db:migrar` en el proyecto autorizado; ejecutar `npm start`, iniciar sesión como profesional y como Mario Santos, crear un turno ficticio y comprobar que el mismo ID persiste después de reiniciar. Consultar los advisors de seguridad en modo lectura y resolver hallazgos del change solo por migraciones.
- [x] 4.3 Documentar resultados, fallas y pruebas pendientes en `evidencias/etapa-6/verify-C-16.md`, sin incluir credenciales. Agregar una sola fila al final de `evidencias/bitacora-decisiones.md`; verificar que las filas anteriores no hayan cambiado.

## Workflow follow-up

- Archivar con `openspec archive persistencia-supabase -y` después de Verify. Comprobar `openspec/specs/persistencia/spec.md`, el delta archivado de `plataforma` y sus validaciones.
- Preparar commits convencionales sin atribución en `dev-ep`. Antes de publicar, realizar el escaneo de secretos indicado por EP sin mostrar coincidencias sensibles. Abrir el PR `dev-ep` → `main` con la plantilla, explicar las pruebas y los límites; no mergear ni marcar C-16 como completado en `CHANGES.md`.
