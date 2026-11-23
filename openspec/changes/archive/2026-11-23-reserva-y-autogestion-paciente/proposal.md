# Proposal

## Why

El consultorio necesita completar el flujo de reserva online y autogestión del paciente (US-020, US-021, flujos F-03 y F-04) y agilizar el registro presencial o telefónico de turnos desde recepción sin sobreturnos ni solapamientos. Se elige este change ahora porque cierra el camino crítico del MVP backend (`C-01 → C-02 → C-10 → C-11`) una vez integradas en `main` todas sus dependencias del Gate 3 (`C-03`, `C-04`, `C-06` y `C-10`), permitiendo que el paciente consulte huecos reales, reserve, descargue su `.ics` y gestione sus turnos dentro de la ventana de 24 horas, y que la recepcionista consulte huecos con boxes libres y registre un turno para un paciente existente o nuevo (presencial/telefónico) en una sola operación atómica.

## What Changes

- **Motor de disponibilidad en grilla de 15 minutos (`src/modules/reserva-online/dominio/disponibilidad.ts`)**: calcula huecos libres `[inicio, inicio + duracionMin)` en `APP_TZ` cruzando horarios de atención de profesionales activos, bloqueos de profesional y box, turnos activos (no cancelados) y existencia de al menos un box activo libre, devolviendo los `boxIds` disponibles por cada hueco y profesional.
- **Consulta pública de disponibilidad (`GET /api/public/disponibilidad`)**: ruta pública sin autenticación que expone huecos libres con `{ inicio, fin, profesionalId, boxIds }` únicamente para prestaciones activas con `reservableOnline: true`, sin datos de otros pacientes ni precios (`RN-RE-01`, `RN-RO-01`).
- **Reserva online autenticada del paciente (`POST /api/paciente/turnos`)**: solo rol `paciente`; toma `pacienteId` exclusivamente desde la sesión, exige prestación activa y `reservableOnline: true` (`409 RECURSO_INACTIVO` si no es reservable online), acepta `boxId` opcional (autoasigna el primer box activo libre dentro de `conLockDeAgenda` si se omite), crea el turno con `origen: 'online'` y `precioAlReservar` congelado, registra auditoría `creado` con `actor: 'paciente'` y envía confirmación con link de Google Calendar y adjunto `.ics` vía C-06 (`RN-NO-01` a `RN-NO-03`, `RN-RE-04`).
- **Autogestión del paciente (`GET /api/paciente/turnos`, `GET /api/paciente/turnos/:id/calendario.ics`, `POST /api/paciente/turnos/:id/cancelar`, `PATCH /api/paciente/turnos/:id/reprogramar`)**:
  - Lista únicamente turnos propios sin precios y genera el archivo `.ics` (RFC 5545) con `generarIcs` de C-06; cualquier intento sobre un turno ajeno o inexistente devuelve `404 NO_ENCONTRADO` (`RN-RE-03`).
  - Cancelación y reprogramación validan propiedad (`404`), estado operable (`409 TRANSICION_INVALIDA`) y plazo de 24 horas sobre el `inicio` original del turno usando `Clock` (`ahora > inicio - 24 h` → `409 PLAZO_VENCIDO`, borde exacto de 24 h permitido, `RN-RE-02`), delegando en `cancelarTurno` (C-05) y `reprogramarTurno` (C-10) con `actor: 'paciente'`. En reprogramación envía confirmación completa (Google Calendar + `.ics` actualizado, `tipo: 'reprogramado'`) vía C-06 sin duplicar correos.
- **Consulta de disponibilidad y registro asistido por recepción (`GET /api/recepcion/disponibilidad`, `POST /api/recepcion/turnos`)**:
  - `GET /api/recepcion/disponibilidad` (`recepcionista` y `profesional`): reutiliza el motor de huecos libres con `boxIds`, habilitando **todas** las prestaciones activas (incluidas las que tienen `reservableOnline: false`), sin exponer precios a la recepcionista.
  - `POST /api/recepcion/turnos` (`recepcionista` y `profesional`): agenda un turno presencial o telefónico en una única sección crítica (`conLockDeAgenda`) aceptando `pacienteId` existente **o** datos inline de un `paciente` nuevo (creado sin cuenta web reutilizando las reglas puras de unicidad de C-04, sin dejar pacientes huérfanos si el horario falla), `boxId` opcional (autoasignación del primer box activo libre), cualquier prestación activa, `origen: 'recepcion' | 'profesional'`, auditoría `creado` con `actor: sesion.usuarioId` y confirmación completa con Google Calendar + `.ics` vía C-06 (sin precios para recepcionista).

## Capabilities

### New Capabilities

- `reserva-online`: Consulta de disponibilidad de huecos en grilla de 15 minutos con boxes libres (pública online y asistida para recepción), reserva online y autogestión de turnos del paciente (listado propio, descarga `.ics`, cancelación y reprogramación con ventana de 24 h), y registro asistido de turnos desde recepción para pacientes existentes o nuevos (presenciales/telefónicos).

### Modified Capabilities

<!-- Ninguna: no se modifican requisitos ni archivos de capabilities ya archivadas. -->

## Impact

- **Carpetas propias (únicas modificadas)**: `src/modules/reserva-online/`, `tests/reserva-online/`, `openspec/changes/reserva-y-autogestion-paciente/`.
- **Módulos importados (solo lectura, sin editar)**:
  - `src/shared/` (C-01): entidades, errores, `Clock`, `enZonaConsultorio`, `conLockDeAgenda`, `requireRol`, `sesionDe`, `Deps`.
  - `src/modules/turnos-alta/dominio/agenda.ts` (C-02): `seSuperponen`, `conflictos`, `enGrilla`.
  - `src/modules/configuracion/dominio/reglas.ts` (C-03): `estaDentroDeHorario`, `haySolapamientoIntervalos`.
  - `src/modules/cuentas/dominio/reglas.ts` (C-04): `normalizarEmail`, `normalizarDocumento`, `validarUnicidadPaciente`.
  - `src/modules/turnos-estados/aplicacion/cambiar-estado.ts` (C-05): `cancelarTurno`.
  - `src/modules/notificaciones/index.ts` (C-06): `enviarConfirmacionTurno`, `generarIcs`.
  - `src/modules/turnos-reprogramacion/aplicacion/reprogramar-turno.ts` (C-10): `reprogramarTurno`.
- **Governance**: **ALTO** (expone rutas públicas y opera sobre datos de pacientes; requiere revisión y aprobación antes de pasar a `apply`).
- **Sin cambios de dependencias ni archivos congelados**: no se toca `package.json`, `src/app.ts`, `src/shared/` ni ningún otro módulo.
