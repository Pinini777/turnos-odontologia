# Proposal

## Why

La aplicación web cuenta hoy con el shell autenticado y componentes base (`C-12 web-base`), mientras que el backend ya expone los módulos de configuración (`C-03`), agenda y auditoría (`C-07`), ganancias (`C-08`) e historia clínica y odontograma (`C-09`). `C-15 web-profesional` entrega la interfaz operativa completa del rol `profesional` en Clínica Dental Alvear —incluyendo catálogo con precios en ARS, horarios/bloqueos en grilla de 15 minutos, ganancias estrictamente privadas, historia clínica append-only con odontograma SVG FDI anatómico y auditoría de turnos— respetando el aislamiento estricto de carpetas y el gate visual de aprobación de mockups por EP.

## What Changes

- **Nuevo módulo UI en `web/src/pages/profesional/`** montado automáticamente por `web/src/main.tsx` vía `export const routes: RouteObject[]`, protegido por `GuardiaProfesional` (RBAC estricto para rol `profesional`) y con `MENU_PROFESIONAL` inyectado como `itemsExtra` de `AppLayout` sin editar `web/src/base/menu.ts`.
- **Cinco rutas operativas del profesional**:
  - `/profesional/catalogo` (`CatalogoPage.tsx`): gestión de prestaciones (con precios en ARS y manejo de `409 DURACION_INVALIDA`), **boxes** (terminología estricta `box`) y profesionales.
  - `/profesional/horarios` (`HorariosPage.tsx`): configuración semanal de horarios propios con selectores restringidos a múltiplos de 15 minutos (`:00`, `:15`, `:30`, `:45`), manejo de `409 FUERA_DE_GRILLA` y gestión de bloqueos propios o de box (regla XOR) con baja vía `DELETE 204`.
  - `/profesional/ganancias` (`GananciasPage.tsx`): consulta exclusiva de ganancias del profesional autenticado (`profesionalId` propio, sin selector de terceros), KPI total en ARS, tabla desglosada de turnos `atendido` con `precioAlReservar` congelado, estado vacío ($ 0) y manejo de `403 SIN_PERMISO`.
  - `/profesional/clinica` (`ClinicaPage.tsx`): selector de paciente (`GET /api/pacientes`), historia clínica append-only con soporte de correcciones (`corrigeAId`, sin edición ni borrado) y odontograma SVG FDI interactivo de 5 caras (`11–48` y toggle temporario `51–85`) con orientación anatómica por cuadrante y deshabilitación automática de `cara` para estados de pieza completa (`ausente`, `corona`, `endodoncia`, `a_extraer`).
  - `/profesional/agenda` y `/profesional/turnos/:id/auditoria` (`AgendaAuditoriaPage.tsx`): consulta de agenda (`GET /api/agenda`) y panel de cronología de auditoría append-only (`GET /api/turnos/:id/auditoria`).
- **Cuatro mockups HTML responsive (390×844 y 1440×900)** en `openspec/changes/web-profesional/mockups/` (`prestaciones.html`, `horarios.html`, `ganancias.html`, `odontograma.html`), alineados a `design-system/` rev. 2 y sujetos a aprobación explícita de EP antes de iniciar `apply`.

## Capabilities

### New Capabilities
- `web-profesional`: interfaz web exclusiva del rol profesional (catálogo con precios, horarios y bloqueos en grilla de 15 min, ganancias privadas propias, historia clínica append-only con odontograma SVG FDI anatómico de 5 caras, y agenda con auditoría de turnos).

### Modified Capabilities
<!-- Ninguna: no se modifican capabilities existentes ni contratos compartidos. -->

## Impact

- **Código y artefactos**: exclusivamente `openspec/changes/web-profesional/` en esta propuesta y, tras aprobación de mockups por EP, exclusivamente `web/src/pages/profesional/` durante `apply`.
- **Archivos congelados y compartidos intactos**: no se modifican `web/src/base/`, `web/src/main.tsx`, `design-system/`, `src/`, `tests/`, `package.json`, `CHANGES.md` ni `.atl/skill-registry.md`. EP quitará `proximamente: true` de `web/src/base/menu.ts` en `chore(shared)`.
- **Política visual y Governance**: `system-and-mockups` (requiere aprobación de EP sobre los 4 mockups HTML antes de `apply`) · Governance **BAJO** · datos 100 % ficticios (`RN-DA-01`).
