# Proposal

## Why

El profesional ya puede crear y cerrar turnos, y cada turno guarda el `precioAlReservar` congelado al reservar (RN-GA-02, DD-05), pero no tiene forma de ver cuánto facturó en un período. US-040 ("ver mis ganancias") es el 7.º diferencial del alcance y el único requisito de la épica de Ganancias; sin C-08 ese dato queda escrito y nunca se expone. Entra ahora porque solo depende de C-01 y es una lectura pura, así que no compite con los changes que escriben turnos.

## What Changes

- Nuevo endpoint `GET /api/profesionales/:id/ganancias?desde&hasta` que devuelve `200 {"total": number}`.
- El total es la suma de `precioAlReservar` de los turnos en estado `atendido` del período (RN-GA-01). Se recalcula en cada consulta sobre el estado vigente; no se guardan totales ni caché (RN-GA-03, PA-04).
- El período es el intervalo semiabierto `[desde, hasta)` sobre `turno.inicio`, coherente con `[inicio, fin)` (RN-AG-04): un turno que empieza exactamente en `hasta` no cuenta.
- Solo el profesional dueño puede consultar sus ganancias (`sesion.profesionalId === id`). Otro profesional, la recepcionista o el paciente reciben `403 SIN_PERMISO` (RN-RO-01, RN-RO-02). Un `:id` inexistente también recibe `403`: se verifica propiedad antes de existencia para no permitir sondear qué profesionales existen.
- `desde` y `hasta` son obligatorios, en ISO 8601 con offset (`z.string().datetime({ offset: true })`); `desde >= hasta` responde `400 FORMATO_INVALIDO` con un detalle sobre `hasta`.
- La suma se hace en centavos y se divide una sola vez al final, para que `10000.10 + 20000.20` dé exactamente `30000.30`.
- Queda fuera: pantallas en `web/`, exportación de comprobantes, filtros por prestación, totales persistidos y cualquier cálculo de impuestos o liquidaciones.

## Capabilities

### New Capabilities
- `ganancias`: cálculo y consulta de las ganancias de un profesional en un período. Abarca qué turnos cuentan (estado `atendido`, precio congelado), cómo se delimita el período, cómo se suma sin errores de punto flotante y quién puede ver el resultado.

### Modified Capabilities
<!-- Ninguna: `plataforma` ya cubre el formato de errores, la sesión y roles, el ocultamiento de precios y la autenticación que usa este change. -->

## Impact

- Código nuevo, solo en `src/modules/ganancias/` (`dominio/ganancias.ts`, `aplicacion/calcular-ganancias.ts`, `routes.ts`) y en `tests/ganancias/`.
- API: una ruta nueva bajo `/api/profesionales/:id/ganancias`. No cambia ninguna ruta existente.
- No modifica `src/shared/`, `src/app.ts`, `package.json`, el lockfile, `tsconfig*` ni la configuración de Vitest. No agrega dependencias: reutiliza `Turno`, `repos.turnos.listar`, `requireRol`, `sesionDe` y `SinPermisoError` de C-01. El módulo se publica solo por el autoload de `src/app.ts`.
- Dependencias de implementación: C-01 (mergeada). C-02 y C-07 aportan turnos y consultas, pero C-08 solo lee: es viable antes de que se mergeen.
- Sin UI: `Decision: no (no UI)`.
