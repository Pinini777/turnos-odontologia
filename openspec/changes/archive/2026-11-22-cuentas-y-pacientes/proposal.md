# Proposal

## Why

La API hoy arranca con un stub de autenticación que rechaza todo token con `401`, impidiendo operar cualquier ruta protegida con sesiones reales y bloqueando la validación de roles y el registro de pacientes. Implementar C-04 (`cuentas-y-pacientes`) ahora, justo después de congelar C-01, habilita login JWT con los tres roles del consultorio, autogestión segura del paciente y padrón de pacientes para el resto de la ola 1, para la reserva online (C-11) y para la base web (C-12).

## What Changes

- Reemplazo del stub `src/modules/cuentas/adapter.ts` por verificación real de JWT (`HS256`, `iss: 'turnos-odontologia'`, TTL de 2 horas con `Clock`) que resuelve `UsuarioSesion` con `profesionalId` o `pacienteId`, validando existencia, estado `activo` y consistencia de rol.
- Autenticación pública en `POST /api/public/login` para los tres roles (`profesional`, `recepcionista`, `paciente`) usando `bcryptjs` y emisión de JWT, sin exponer jamás `hashPassword`.
- Registro público de pacientes en `POST /api/public/pacientes/registro` con unicidad de email/documento, hash de contraseña y vinculación automática por `documento + email` cuando el paciente ya fue cargado previamente por recepción sin cuenta (PA-10).
- Gestión de pacientes para `profesional` y `recepcionista` (`GET /api/pacientes`, `POST /api/pacientes`, `PATCH /api/pacientes/:id`) sin borrado físico y con sincronización de `usuario.email` cuando un paciente vinculado cambia su email.
- Autogestión aislada para `paciente` (`GET /api/paciente/datos`, `PATCH /api/paciente/datos`) estrictamente sobre `sesion.pacienteId`, restringida a campos editables de contacto y obra social informativa.
- Cuentas del personal exclusivamente desde `src/shared/seed.ts` (sin endpoint de alta de personal).

## Capabilities

### New Capabilities
- `cuentas`: autenticación con JWT, resolución de sesión por rol, registro y vinculación de cuentas de pacientes, gestión del padrón de pacientes por el personal y autogestión aislada de datos propios del paciente.

### Modified Capabilities
<!-- Ninguna en este change: los dos ajustes en archivos congelados (`DUPLICADO` en `plataforma` para colisiones de campos únicos como email/documento/matrícula/box, más `crearAuth(repos, clock)` en `src/app.ts`) ya fueron incorporados por EP en `main` mediante `chore(shared)` (`15466ab`) y traídos a `dev-facundo`. -->

## Impact

- **Código nuevo y modificado (exclusivamente en carpetas de C-04)**: `src/modules/cuentas/{dominio,aplicacion,adapter.ts,routes.ts}`, `tests/cuentas/` y `openspec/changes/cuentas-y-pacientes/`.
- **Archivos congelados**: C-04 no toca `src/shared/`, `src/app.ts`, `package.json`, lockfile ni `web/`. El prerequisito `chore(shared)` de EP (`15466ab`) ya está incorporado en `dev-facundo`.
- **Dependencias**: utiliza únicamente paquetes ya instalados en C-01 (`jose`, `bcryptjs`, `zod`, `fastify`, `vitest`).
- **Governance**: **CRITICO** (autenticación y datos personales). Requiere aprobación explícita de EP sobre el spec antes de iniciar `apply`.
