# Proposal

## Why

Hoy el consultorio puede crear turnos y cambiar su estado, pero nadie puede ver el día organizado ni reconstruir qué pasó con un turno. Este change expone las dos lecturas imprescindibles de D.3 (puntos 2 y 9): la agenda diaria/semanal (US-014) y la auditoría append-only que ya escriben C-02, C-05 y C-10 (US-061). Se eligió para Agustín por ser una consulta de solo lectura sobre contratos congelados —sin stubs, locks ni reglas de zona horaria— y se marca CRITICO porque expone el audit trail.

## What Changes

- Nueva capability `agenda` con dos endpoints de solo lectura:
  - `GET /api/agenda?desde&hasta&profesionalId&boxId` para el profesional y la recepcionista: turnos del rango semiabierto `[desde, hasta)` sobre `inicio`, con estado, paciente, profesional, box y prestación, ordenados por `inicio`. La recepcionista no recibe precios.
  - `GET /api/turnos/:id/auditoria` solo para el profesional: registros append-only del turno (`accion`, `actor`, `fecha`, `detalle` con antes/después), ordenados por `fecha`.
- Un turno inexistente en auditoría responde `404 NO_ENCONTRADO`; uno sin registros responde `200 []`.
- No se agregan rutas de escritura, códigos de error, entidades, campos compartidos ni dependencias nuevas.
- No hay interfaz web: las pantallas son C-13 y C-15.

## Capabilities

### New Capabilities

- `agenda`: consulta de la agenda por rango, profesional y box, con el turno enriquecido para mostrar sin exponer precios a quien no corresponde; y consulta de solo lectura de la auditoría de un turno para el profesional.

### Modified Capabilities

- Ninguna. C-02 (`turnos-alta`) y C-05 (`turnos-estados`) ya definen y escriben los registros de auditoría; este change solo los lee y no cambia su comportamiento.

## Impact

- Código nuevo, aislado en `src/modules/agenda/` y `tests/agenda/`; no toca `src/app.ts`, `src/shared/`, `src/modules/*` ajenos ni la configuración.
- Consume los contratos congelados por C-01: `Turno`, `AuditoriaTurno`, `repos.turnos.listar`, `repos.auditoria.listar`, `requireRol`, `sesionDe` y `sinPrecioPara`.
- Dependencias de datos: C-02 y C-05 ya archivados (escriben `creado`, `cancelado`, `estado_cambiado`); C-10 escribirá `reprogramado` sin cambiar esta consulta.
- Consumidores posteriores: C-13 (`web-recepcion`) y C-15 (`web-profesional`).
- Riesgo de seguridad: el audit trail queda accesible a cualquier profesional; requiere aprobación de EP del spec antes de `apply` (governance CRITICO).
