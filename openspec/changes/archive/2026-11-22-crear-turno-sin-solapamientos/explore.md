# Explore — C-02 `crear-turno-sin-solapamientos`

> Resumen del relevamiento previo a `propose` (consigna, etapa 6.2, fase Explore). Fecha: 2026-11-22. Conduce: EP con el agente.

## Problema

La recepcionista o el profesional cargan un turno (paciente + profesional + box + prestación + inicio) y el sistema tiene que garantizar que **ningún profesional ni box quede con dos turnos superpuestos**, con intervalos `[inicio, fin)`, grilla de 15 minutos y sin sobreturnos (US-010, F-01, RN-AG-01 a RN-AG-07, RN-AG-10, RN-TU-02, RN-TU-05).

## Estado del código (rama `dev-ep` = `main` en `4ca08b4`)

- C-01 está mergeado y archivado (`openspec/specs/plataforma/`). No hay changes activos ni código en `src/modules/turnos-alta/`.
- Lo que C-02 **reusa sin tocar** (`src/shared/`, congelado):
  - `Turno`, `Prestacion`, `AuditoriaTurno` y demás entidades (`entidades.ts`).
  - `ReglaDeNegocioError(code)` con `SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `FUERA_DE_GRILLA`, `EN_EL_PASADO`, `RECURSO_INACTIVO`, `NO_ENCONTRADO`; `app.ts` ya los mapea a `409 {code}` / `404`, y `ZodError` a `400`.
  - `Clock` / `FixedClock`, `enZonaConsultorio()`, `conLockDeAgenda`, repositorios en memoria con seeds (Dra. Ana Pérez, Dr. Bruno Gómez, Box 1 y 2, Consulta 30 min, Control 15 min, Paciente Ficticio Uno y Dos).
  - `requireRol`, `sesionDe`, y el hook global `preSerialization` que oculta precios a la recepcionista.
  - Puertos `DisponibilidadPort` (stub permisivo hasta C-03) y `Notificador` (outbox en memoria hasta C-06).
- Registro de módulos: basta con crear `src/modules/turnos-alta/routes.ts` con un plugin por defecto; `app.ts` lo carga solo.
- Tests: patrón de `tests/plataforma/` con `buildApp({ repos, clock, auth: authDeTest })` y tokens `prof` / `recep` / `pac`.

## Huecos encontrados y cómo se resolvieron

| # | Hueco | Decisión de EP (2026-11-22) |
|---|---|---|
| H-1 | RN-AG-03 pide que el rechazo indique "profesional, box o ambos", pero el contrato congelado responde `409 {code}` con **un solo** código. | **Prioriza profesional**: si chocan los dos, la API responde `SOLAPAMIENTO_PROFESIONAL`. El dominio sí detecta ambos recursos y un test lo verifica. No se toca `src/shared/` ni el spec `plataforma`. Se registra como ajuste a RN-AG-03. |
| H-2 | El puerto `Notificador` recibe un email ya armado, pero la ficha de C-06 dice que su adaptador "arma el email". C-06 va en paralelo. | **C-02 manda un email mínimo** (paciente, fecha y hora en la zona del consultorio, profesional, box y prestación, **sin precio**), después de guardar y fuera del lock. Si el envío falla, el turno no se revierte (RN-NO-02). C-06 cambia después el transporte y agrega Google Calendar. |

## Supuestos (sin pregunta abierta de prioridad Alta)

- **Roles**: `POST /api/turnos` es para profesional y recepcionista; el paciente recibe `403` (reserva por `/api/paciente/...` en C-11). El profesional puede cargar turnos de cualquier profesional (03, matriz RBAC; PA-09).
- **Origen**: `recepcion` si lo crea la recepcionista, `profesional` si lo crea un profesional. `creadoPor` = `usuarioId` de la sesión.
- **Recursos**: profesional, box, prestación o paciente inexistente → `404 NO_ENCONTRADO`; profesional, box o prestación inactivos → `409 RECURSO_INACTIVO`.
- **Pasado**: se rechaza si `inicio < ahora`; `inicio == ahora` se acepta.
- **Grilla**: minutos en {00, 15, 30, 45}, segundos y milisegundos en 0, en la zona del consultorio.
- **Orden de validación**: el de la ficha de `CHANGES.md` (grilla → pasado → recursos → disponibilidad → solapamientos). Es compatible con F-01: disponibilidad agrupa horario y bloqueos.

## Fuera de alcance de C-02

- Horarios de atención y bloqueos reales (C-03; acá solo se consulta el puerto).
- `DURACION_INVALIDA`: la duración la valida C-03 al guardar la prestación.
- Email con Google Calendar e `.ics` (C-06), cancelar (C-05), reprogramar (C-10), reserva del paciente (C-11), consultas de agenda y auditoría (C-07).

## Riesgo principal

Dos altas simultáneas al mismo hueco (RN-RE-04): la validación de disponibilidad y solapamientos y el guardado van dentro de `conLockDeAgenda`. Se cubre con un test de dos altas concurrentes.
