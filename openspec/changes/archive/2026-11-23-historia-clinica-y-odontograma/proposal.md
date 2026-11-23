# Proposal

## Why

La API todavía no ofrece un espacio clínico donde los odontólogos registren evoluciones de consulta ni el estado dental por pieza de cada paciente, pese a que ambos son imprescindibles del MVP (D.3, US-050, US-051) y bloquean la pantalla profesional (C-15). Implementar C-09 (`historia-clinica-y-odontograma`) ahora, con C-01 y C-04 ya mergeados en `main`, completa el dominio clínico del backend bajo acceso estricto solo para profesionales (`RN-RO-03`), historial append-only trazable (`RN-CL-01`) y notación FDI estandarizada (`RN-CL-02`), sin modificar ningún contrato compartido.

## What Changes

- Creación del dominio puro del módulo `clinica` (`src/modules/clinica/dominio/`) con validación exacta de notación FDI (32 piezas permanentes `11–48` y 20 temporarias `51–85`, rechazando todos los huecos), detección de conflictos intra-lote (pares `(pieza, cara)` duplicados o mezcla de pieza completa sin cara con cara específica sobre la misma pieza), ordenamiento cronológico estable y proyección determinista no contradictoria del estado actual del odontograma (donde coexisten distintas caras de una pieza, pero una cara específica desplaza a una pieza completa previa y una pieza completa desplaza a las caras previas en `piezas`, preservando siempre el `historial` append-only intacto).
- Casos de uso de historia clínica (`src/modules/clinica/aplicacion/historia.ts`) para consultar evoluciones ordenadas cronológicamente (`GET /api/pacientes/:id/historia`) y registrar entradas append-only (`POST /api/pacientes/:id/historia`) con autor tomado de `sesion.profesionalId`, fecha desde `Clock` y validación de existencia y pertenencia al mismo paciente para `turnoId` y `corrigeAId` opcionales.
- Casos de uso de odontograma (`src/modules/clinica/aplicacion/odontograma.ts`) para consulta sin efectos secundarios (`GET /api/pacientes/:id/odontograma`) y actualización incremental append-only por lote (`PUT /api/pacientes/:id/odontograma`) serializada con `deps.conLockDeAgenda`, garantizando relación 1 a 1 de `Odontograma` por paciente y devolviendo tanto el estado vigente (`piezas`) como el historial completo (`historial`).
- Exposición de exactamente 4 rutas HTTP protegidas exclusivamente con `requireRol('profesional')` y validación Zod 3 `.strict()` en `src/modules/clinica/routes.ts`, sin exponer `PUT/PATCH/DELETE` sobre entradas de historia clínica ni `PATCH/DELETE` sobre odontograma.
- Suite completa de tests unitarios y de integración HTTP en `tests/clinica/` con datos 100 % ficticios (`RN-DA-01`), cubriendo casos felices, errores de negocio, límites y huecos FDI, concurrencia en `PUT /odontograma`, inmutabilidad append-only, RBAC (`401`/`403`) y colaboración multiprofesional.

## Capabilities

### New Capabilities
- `clinica`: registro y consulta append-only de historia clínica con correcciones referenciadas y vinculación opcional a turnos, más consulta y actualización incremental append-only del odontograma en notación FDI con control de acceso exclusivo para profesionales.

### Modified Capabilities
<!-- Ninguna: C-09 no modifica `src/shared/`, `src/app.ts`, `package.json` ni ningún contrato de `plataforma` o `cuentas`. `EstadoDePieza` (7 valores) y `CaraPieza` (5 valores) permanecen congelados tal como los definió C-01. -->

## Impact

- **Código nuevo (exclusivamente en carpetas de C-09)**: `src/modules/clinica/{dominio,aplicacion,routes.ts}`, `tests/clinica/` y `openspec/changes/historia-clinica-y-odontograma/`.
- **Archivos congelados**: cero cambios en `src/shared/`, `src/app.ts`, `package.json`, lockfile, `web/`, `knowledge-base/` ni en módulos de otros changes.
- **Dependencias**: utiliza únicamente paquetes ya instalados en C-01 (`fastify`, `zod`, `vitest`, `node:crypto`).
- **Governance**: **CRITICO** (datos sensibles de salud — `RN-DA-03`, `PA-07`). Esta propuesta, el diseño y el spec quedan **pendientes de aprobación explícita de EP** antes de iniciar `apply`.
