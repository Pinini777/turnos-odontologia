# Tasks

> TDD estricto: en cada tarea, escribir el test que falla primero (RED), implementar lo mínimo para pasarlo (GREEN), triangular todos los escenarios del spec y refactorizar manteniendo los tests en verde. Tests en `tests/configuracion/`.

## 1. Dominio puro y disponibilidad real

- [x] 1.1 Crear `src/modules/configuracion/dominio/reglas.ts` con funciones puras de validación (`validarDuracionPrestacion`, `validarHorarioEnGrilla`, `estaDentroDeHorario`, `haySolapamientoIntervalos`) sin importar Fastify, repositorios ni `Date.now()`/`new Date()`; verificar con `tests/configuracion/disponibilidad.test.ts` (RED → GREEN)
- [x] 1.2 Reemplazar el stub `src/modules/configuracion/disponibilidad.ts` manteniendo la firma exacta `crearDisponibilidad(repos: Repositorios): DisponibilidadPort`; cubrir con tests en `tests/configuracion/disponibilidad.test.ts` todos los escenarios: horario válido (`null`), fuera de horario en `APP_TZ` (`FUERA_DE_HORARIO`), bloqueo de profesional (`EN_BLOQUEO`), bloqueo de box (`EN_BLOQUEO`) y ambos bordes semiabiertos `[inicio, fin)` (turno termina cuando inicia bloqueo y turno inicia cuando termina bloqueo)
- [x] 1.3 Actualizar el test provisional `"Disponibilidad provisional: acepta cualquier horario"` en `tests/plataforma/shared.test.ts` a una franja del horario semilla (lunes 09:00–10:00 en Mendoza) para reflejar la disponibilidad real de `C-03` y confirmar que toda la suite `tests/plataforma/` sigue en verde

## 2. Profesionales y Boxes

- [x] 2.1 Implementar casos de uso en `src/modules/configuracion/aplicacion/profesionales.ts` y rutas `GET/POST /api/profesionales`, `PATCH /api/profesionales/:id` en `src/modules/configuracion/routes.ts` (alta, edición, desactivación, matrícula única → `400`, solo `profesional` escribe → `403`, inexistente → `404`); verificar con `tests/configuracion/profesionales-boxes.test.ts`
- [x] 2.2 Implementar casos de uso en `src/modules/configuracion/aplicacion/boxes.ts` y rutas `GET/POST /api/boxes`, `PATCH /api/boxes/:id` en `src/modules/configuracion/routes.ts` (alta, desactivación, nombre único → `400`, solo `profesional` escribe → `403`, terminología `box`); verificar con `tests/configuracion/profesionales-boxes.test.ts`

## 3. Prestaciones y catálogo público

- [x] 3.1 Implementar `src/modules/configuracion/aplicacion/prestaciones.ts` y rutas `GET/POST /api/prestaciones`, `PATCH /api/prestaciones/:id` y `GET /api/public/prestaciones` en `src/modules/configuracion/routes.ts`
- [x] 3.2 Verificar en `tests/configuracion/prestaciones.test.ts` todos los escenarios: alta/edición válida, `409 DURACION_INVALIDA` (no múltiplo de 15 o `<= 0`), ocultamiento de `precio` para `recepcionista`, catálogo público sin token filtrando inactivas/no reservables y sin `precio`, y verificación explícita de que editar `precio` no altera `precioAlReservar` de un turno ya guardado (`RN-GA-02`)

## 4. Horarios de atención y Bloqueos

- [x] 4.1 Implementar `src/modules/configuracion/aplicacion/horarios.ts` y rutas `GET/POST /api/profesionales/:id/horarios` (reemplazo de horarios usando `repos.horarios.borrar`, verificación `sesion.profesionalId === id` → `403` si ajeno, grilla de 15 min → `409 FUERA_DE_GRILLA`, `desde < hasta` → `400`); verificar con `tests/configuracion/horarios-bloqueos.test.ts`
- [x] 4.2 Implementar `src/modules/configuracion/aplicacion/bloqueos.ts` y rutas `GET/POST /api/bloqueos`, `DELETE /api/bloqueos/:id` (XOR `profesionalId` / `boxId`, `inicio < fin`, autorización `DD-11` profesional propio vs box por cualquier profesional, `404` si inexistente); verificar con `tests/configuracion/horarios-bloqueos.test.ts`

## 5. Verificación integral y cierre

- [x] 5.1 Verificar que no existan `any`, `@ts-ignore`, `@ts-expect-error`, `Date.now()`/`new Date()` en `src/modules/configuracion/dominio/` ni archivos tocados fuera de `src/modules/configuracion/`, `tests/configuracion/`, `openspec/changes/configuracion-consultorio/` y el ajuste acordado en `tests/plataforma/shared.test.ts`
- [x] 5.2 Ejecutar `npm run typecheck`, `npm run lint` y `npm test` completos en verde, registrando todos los escenarios cubiertos
- [x] 5.3 Agregar fila de `C-03` al final de `evidencias/bitacora-decisiones.md` (anotando `PA-03`, unicidad `400` y ajuste del test provisional)

## Workflow follow-up

- Archivar el change con `openspec archive configuracion-consultorio` en `dev-renzo` antes de abrir el PR a `main`.
- Ejecutar `engram sync` (nunca `--all`), pushear a `origin dev-renzo` y abrir el PR completando `.github/pull_request_template.md`.
