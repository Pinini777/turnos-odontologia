# Proposal

## Why

El consultorio necesita configurar sus profesionales, boxes, prestaciones (con duración en bloques de 15 minutos y precio), horarios de atención y bloqueos de agenda antes de operar turnos reales. Además, `C-01` dejó un stub permisivo en `src/modules/configuracion/disponibilidad.ts` que acepta cualquier fecha y horario; para garantizar que ningún turno caiga fuera del horario del profesional ni dentro de un bloqueo del profesional o del box (`RN-AG-08`, `RN-AG-09`), es necesario implementar el módulo `configuracion` completo (Épica 1: `US-001`, `US-002`, `US-003`) y reemplazar el stub de disponibilidad por su lógica real.

## What Changes

- **Gestión de profesionales y boxes (`US-001`):** endpoints `GET/POST /api/profesionales`, `PATCH /api/profesionales/:id`, `GET/POST /api/boxes` y `PATCH /api/boxes/:id` para alta, edición y desactivación lógica (solo rol `profesional` modifica; `recepcionista` solo lee). Se garantiza unicidad de `matricula` (profesional) y `nombre` (box), usando siempre la terminología `box` (nunca "sillón").
- **Gestión de prestaciones y catálogo público (`US-002`):** endpoints `GET/POST /api/prestaciones`, `PATCH /api/prestaciones/:id` y ruta pública sin autenticación `GET /api/public/prestaciones` (solo prestaciones activas y `reservableOnline: true`). Se valida que `duracionMin > 0` y sea múltiplo de 15 (`409 DURACION_INVALIDA`), que `precio >= 0`, que editar una prestación no altere `precioAlReservar` en turnos ya creados (`RN-GA-02`), y que la recepcionista ni la ruta pública reciban `precio` (`RN-RO-01`).
- **Horarios de atención y bloqueos (`US-003`, `DD-11`):** endpoints `GET/POST /api/profesionales/:id/horarios` (cada profesional reemplaza solo sus propios horarios → `403 SIN_PERMISO` si intenta sobre otro; `desde < hasta` sobre grilla de 15 min → `409 FUERA_DE_GRILLA`), y `GET/POST /api/bloqueos`, `DELETE /api/bloqueos/:id` (bloqueo de profesional o de box de forma excluyente, con `inicio < fin`; bloqueos propios solo del profesional dueño, bloqueos de box por cualquier profesional).
- **Disponibilidad real (`src/modules/configuracion/disponibilidad.ts`):** reemplazo del stub permisivo manteniendo la firma `crearDisponibilidad(repos): DisponibilidadPort`, verificando horario de atención en `APP_TZ` (`FUERA_DE_HORARIO`) y bloqueos de profesional o box bajo intervalo semiabierto `[inicio, fin)` (`EN_BLOQUEO`).
- **Ajuste de test provisional de `C-01`:** actualización del caso `"Disponibilidad provisional: acepta cualquier horario"` en `tests/plataforma/shared.test.ts` (que probaba un domingo 00:00 esperando `null`) para verificar la disponibilidad real dentro del horario semilla y mantener `npm test` y el CI en verde, informando a EP en el PR.

## Capabilities

### New Capabilities
- `configuracion`: administración de profesionales, boxes, prestaciones, catálogo público reservable, horarios de atención por profesional, bloqueos de agenda y verificación real de disponibilidad (`FUERA_DE_HORARIO` y `EN_BLOQUEO`) respetando visibilidad de precios (`RN-RO-01`) y reglas `RN-AG-*`.

### Modified Capabilities
<!-- Ninguna: se evita editar openspec/specs/plataforma/ durante la ola 1 para prevenir colisiones con los PR paralelos del equipo. -->

## Impact

- **Código nuevo / modificado:** `src/modules/configuracion/{dominio,aplicacion}/`, `src/modules/configuracion/routes.ts`, `src/modules/configuracion/disponibilidad.ts`, `tests/configuracion/`, y ajuste puntual del test provisional en `tests/plataforma/shared.test.ts`.
- **Dependencias:** depende de `C-01` (`fundacion-y-dominio-base`, mergeado en `4ca08b4`). Respeta congelamiento de `src/app.ts`, `src/shared/`, `package.json`, `package-lock.json`, `tsconfig*`, ESLint y Vitest.
- **Equipo:** aporta la implementación real de `DisponibilidadPort` consumida por `C-02` (`crear-turno-sin-solapamientos`), `C-08`, `C-10` y `C-11` (`reserva-y-autogestion-paciente`).
- **Governance:** `MEDIO` (afecta reglas de agenda; se implementa por pasos verificables y se documentan decisiones).
