# Proposal

## Why

El backend ya permite crear, mover, cancelar y cambiar el estado de los turnos sin solapamientos (C-02, C-05, C-07, C-10, C-11), pero la recepcionista no tiene pantalla para hacerlo: en el menú de C-12, "Agenda del día" y "Pacientes" son placeholders. La recepción es quien más usa la agenda (US-010 a US-014), así que esta es la pantalla que muestra el diferencial del producto en uso real: ningún turno superpuesto y el motivo claro cuando un hueco ya está ocupado.

## What Changes

- Nueva área `web/src/pages/recepcion/`, montada por el autoload de rutas de C-12, solo para el rol `recepcionista`.
- **Agenda** (`/recepcion/agenda`): vista de día y de semana, con filtro por profesional o por box, sobre `GET /api/agenda` (C-07). Cada turno muestra hora, paciente, prestación, profesional, box y estado. Dos turnos contiguos (10:00–10:30 y 10:30–11:00) se ven uno junto al otro, sin marca de conflicto.
- **Acciones del turno**, solo las válidas para su estado: confirmar, marcar atendido o ausente, cancelar (con confirmación) y reprogramar (C-05 y C-10).
- **Nuevo turno** (`/recepcion/turnos/nuevo`): la recepcionista elige prestación, profesional y día, y toca uno de los **huecos libres** que devuelve `GET /api/recepcion/disponibilidad` (C-11). El paciente puede ser uno existente (buscador) o uno nuevo, cargado en el mismo formulario. El box queda en "Automático" o se elige entre los libres del hueco. Se crea con `POST /api/recepcion/turnos` (C-11).
- **Reprogramar**: el mismo selector de huecos libres, sobre `PATCH /api/turnos/:id/reprogramar` (C-10).
- **Pacientes** (`/recepcion/pacientes`): lista con buscador y alta de paciente (C-04).
- Un `409` se muestra con el mensaje legible del código de negocio (`SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `TRANSICION_INVALIDA`, etc.) y la pantalla refresca los huecos. Ninguna pantalla muestra precios (RN-RO-01).
- Mockups HTML aprobados por EP antes del apply: agenda, nuevo turno con error de solapamiento y reprogramar.
- Cambio de alcance respecto de la ficha de `CHANGES.md`: el alta de turno usa las rutas de recepción de C-11 (`/api/recepcion/disponibilidad` y `/api/recepcion/turnos`) en vez de `POST /api/turnos` de C-02, porque permiten elegir entre huecos libres y crear un paciente nuevo en el mismo paso. Decisión del explore.
- Queda fuera: la auditoría del turno (solo la ve el profesional, C-15), precios y ganancias, y la agenda del profesional (C-15).

## Capabilities

### New Capabilities
- `web-recepcion`: interfaz web de la recepcionista para ver la agenda, dar turnos en huecos libres, reprogramarlos, cancelarlos, cambiarles el estado y dar de alta pacientes, sin precios.

### Modified Capabilities
<!-- Ninguna: web-base y las capabilities del backend no cambian sus requisitos; este change las consume. -->

## Impact

- Código nuevo, solo en `web/src/pages/recepcion/` (páginas, componentes, cliente de la API de recepción y tests junto a ellos) y en `openspec/changes/web-recepcion/` (incluidos los mockups).
- No edita `web/src/base/` (C-12), `web/src/main.tsx`, `web/package.json` ni el backend. Los ítems del menú se reemplazan con `itemsExtra` de `AppLayout`.
- Consume, sin cambiarlas: `GET /api/agenda` (C-07), `GET /api/recepcion/disponibilidad` y `POST /api/recepcion/turnos` (C-11), `POST /api/turnos/:id/cancelar` y `POST /api/turnos/:id/estado` (C-05), `PATCH /api/turnos/:id/reprogramar` (C-10), `GET` y `POST /api/pacientes` (C-04) y `GET /api/profesionales`, `/api/boxes` y `/api/prestaciones` (C-03).
- Sin dependencias nuevas: React, React Router y Testing Library ya están en `web/` por C-12.
