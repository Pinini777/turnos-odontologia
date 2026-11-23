# Tasks — `C-15 web-profesional`

> **Política visual**: `system-and-mockups`. **Governance**: BAJO.
> **Scope estricto de `apply`**: exclusivamente `web/src/pages/profesional/` (TDD con Vitest `jsdom` + `@testing-library/react`, 1 `it(...)` por escenario de `specs/web-profesional/spec.md`). Cero ediciones en `web/src/base/`, `web/src/main.tsx`, `src/`, `tests/`, `design-system/`, `package.json`, `CHANGES.md` ni `.atl/`.

## 0. Gate obligatorio de aprobación de mockups y línea base

- [x] 0.1 Obtener aprobación explícita de EP sobre los 4 mockups HTML (`openspec/changes/web-profesional/mockups/{prestaciones,horarios,ganancias,odontograma}.html`) evaluados a 390×844 y 1440×900, registrar `Approval: approved` en `design.md` y verificar línea base verde con `npm run typecheck && npm run lint && npm test` antes de iniciar `apply`.

## 1. Infraestructura local, RBAC, menú y formatos del área profesional

- [x] 1.1 Implementar `web/src/pages/profesional/formatos.ts`, `menuProfesional.ts`, `apiProfesional.ts`, `useProfesionalActual.ts`, `GuardiaProfesional.tsx`, `profesional.css` y `routes.tsx` (`export const routes: RouteObject[]`) junto con los tests TDD en `web/src/pages/profesional/profesional.test.tsx` para los 3 escenarios de RBAC (sin sesión → `/login`, `recepcionista` → `SIN_PERMISO` sin fetches, `paciente` → `SIN_PERMISO` sin fetches) y verificar `npm test -w web`.

## 2. Catálogo de prestaciones, boxes y profesionales (`/profesional/catalogo`)

- [x] 2.1 Implementar `web/src/pages/profesional/CatalogoPage.tsx` (pestañas Prestaciones con ARS y `<select>` de duración en múltiplos de 15 min de `15` a `180`, Boxes con terminología `box` y Profesionales, tablas fluidas sin scroll horizontal) con tests TDD cubriendo los 4 escenarios de catálogo —incluyendo validación del `<select>` de múltiplos de 15, alerta defensiva `AlertaErrorNegocio` ante `409 DURACION_INVALIDA` y manejo de `400`/`409`— y verificar `npm test -w web`.

## 3. Horarios propios y bloqueos XOR (`/profesional/horarios`)

- [x] 3.1 Implementar `web/src/pages/profesional/HorariosPage.tsx` (franjas semanales con selectores `:00/:15/:30/:45`, guardado `POST /api/profesionales/:id/horarios`, `409 FUERA_DE_GRILLA`, formulario XOR de bloqueos propios/box con `Día desde`/`Día hasta`, checkbox "Bloquear día completo" por defecto mapeado a `[diaDesdeT00:00:00-03:00, diaSiguiente(diaHasta)T00:00:00-03:00)` + horas opcionales en múltiplos de 15 min y `DELETE /api/bloqueos/:id` 204) con tests TDD cubriendo los 5 escenarios de horarios y bloqueos, y verificar `npm test -w web`.

## 4. Ganancias privadas del profesional logueado (`/profesional/ganancias`)

- [x] 4.1 Implementar `web/src/pages/profesional/GananciasPage.tsx` (`Promise.all` contra `/api/profesionales/:id/ganancias` y `/api/agenda?profesionalId=<propio>`, sin selector de terceros, KPI ARS, tabla fluida sin scroll horizontal de `atendido` con `precioAlReservar`, estado vacío `$ 0` y error `403 SIN_PERMISO`) con tests TDD cubriendo los 3 escenarios de ganancias, y verificar `npm test -w web`.

## 5. Historia clínica append-only y odontograma SVG FDI (`/profesional/clinica`)

- [x] 5.1 Implementar helper puro `web/src/pages/profesional/odontogramaFdi.ts` (4 cuadrantes permanentes `11–48`, 4 temporarios `51–85`, mapeo anatómico espejado de las 5 caras, nombres anatómicos y validación de estados solo pieza completa) y componente accesible `OdontogramaFdi.tsx` (grilla CSS fluida sin scroll horizontal en `1440×900` y `390×844` con SVG `aspect-ratio: 1`, apilado por cuadrante en `≤ 900px`, glifo coronal de 5 caras, overlays de `ausente`/`a_extraer`/`corona`/`endodoncia`, patrones WCAG y navegación teclado/ARIA) con pruebas unitarias verificadas en `npm test -w web`.
- [x] 5.2 Implementar `web/src/pages/profesional/ClinicaPage.tsx` (selector `GET /api/pacientes`, historia clínica append-only sin edición ni borrado, alta de evolución y corrección `corrigeAId`, integración de `OdontogramaFdi`, deshabilitación automática de `cara` para estados de pieza completa y guardado `PUT /api/pacientes/:id/odontograma`) con tests TDD cubriendo los 4 escenarios clínicos, y verificar `npm test -w web`.

## 6. Agenda profesional y auditoría de turnos (`/profesional/agenda` y `/profesional/turnos/:id/auditoria`)

- [x] 6.1 Implementar `web/src/pages/profesional/AgendaAuditoriaPage.tsx` (listado `GET /api/agenda` con filtros y panel de cronología append-only `GET /api/turnos/:id/auditoria`) con tests TDD cubriendo los 2 escenarios de agenda/auditoría y el escenario de terminología `box`, datos ficticios `RN-DA-01` y layout sin scroll horizontal, y verificar `npm test -w web`.

## 7. Verificación integral de cierre

- [x] 7.1 Ejecutar `npm run typecheck && npm run lint && npm test && npm run build -w web`, confirmar alcance estricto en `git status` (solo `web/src/pages/profesional/` y artefactos del change) y dejar listo para revisión y archivo (`openspec archive web-profesional`).
