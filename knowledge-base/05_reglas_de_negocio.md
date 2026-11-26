# Reglas de Negocio

Cada regla tiene un código `RN-{DOMINIO}-{NN}` para trazabilidad con specs, tests y `CHANGES.md`. Origen principal: `docs/discovery/discovery.md` §7 (respuestas de EP) y la sección C.3 del informe.

## Dominio: Agenda (RN-AG)

> **Reglas de agenda que pide la consigna:**
>
> | Exigencia | Reglas |
> |---|---|
> | Duración de las prestaciones | RN-AG-05, RN-AG-06 |
> | Sillones o boxes | RN-AG-01, RN-AG-03, RN-AG-08 |
> | Prevención de solapamientos | RN-AG-02, RN-AG-03, RN-AG-04, RN-AG-07, RN-AG-11, RN-TU-02, RN-TU-04, RN-RE-04 |
>
> Ningún competidor documenta estas reglas en público (NE-01 a NE-05 en `10_preguntas_abiertas.md`).

- **RN-AG-01**: Todo turno ocupa **un profesional y un box** a la vez. Los dos son obligatorios. *Box es el puesto de atención con su equipo; los proveedores y la consigna también lo llaman "sillón" o "unidad dental".*
- **RN-AG-02**: **Un profesional no puede tener dos turnos superpuestos.** Dos turnos `a` y `b` se superponen si `a.inicio < b.fin && b.inicio < a.fin`. Solo cuentan los turnos **no cancelados**.
- **RN-AG-03**: **Un box no puede tener dos turnos superpuestos**, con la misma definición que RN-AG-02. El rechazo indica qué recurso choca: profesional, box o ambos.
- **RN-AG-04**: Los intervalos son **semiabiertos [inicio, fin)**. Un turno que empieza justo cuando termina otro (10:00–10:30 y 10:30–11:00) **no** se superpone. Es el escenario de borde obligatorio del change.
- **RN-AG-05**: La agenda usa una **grilla de 15 minutos**: `inicio` tiene minutos en {00, 15, 30, 45} y segundos en 0.
- **RN-AG-06**: La duración del turno es la de la prestación: un múltiplo de 15 mayor que 0. `fin = inicio + duracionMin`.
- **RN-AG-07**: **No existen sobreturnos.** No hay forma de forzar un turno superpuesto, ni siquiera el profesional. *Diferencia consciente con Dentalink, que documenta un "sobreagendamiento" explícito.*
- **RN-AG-08**: Un turno no puede caer dentro de un **bloqueo** del profesional o del box (feriado, ausencia, mantenimiento).
- **RN-AG-09**: Un turno debe quedar **dentro del horario de atención** del profesional para ese día. **Cada profesional carga y mantiene sus propios horarios** (PA-02, resuelta).
- **RN-AG-10**: No se crean ni se reprograman turnos con `inicio` en el pasado, según el reloj del sistema (zona horaria del consultorio, DD-08).
- **RN-AG-11**: **Un paciente no puede tener dos turnos no cancelados superpuestos**, sin importar el profesional ni el box (`a.inicio < b.fin && b.inicio < a.fin` → `409 SOLAPAMIENTO_PACIENTE`). El orden de validación es `profesional → box → paciente`; al reprogramar se excluye el propio turno (`RN-TU-04`).

## Dominio: Turnos (RN-TU)

- **RN-TU-01**: Estados y transiciones válidas:
  - `reservado → confirmado → atendido | ausente`
  - `reservado | confirmado → cancelado`
  - `atendido`, `ausente` y `cancelado` son finales.
- **RN-TU-02**: Un turno cancelado **libera el horario**: deja de contar para RN-AG-02 y RN-AG-03.
- **RN-TU-03**: **"Eliminar" un turno es cancelarlo.** No hay borrado físico: queda con estado `cancelado` y se registra quién lo hizo y cuándo.
- **RN-TU-04**: **Reprogramar** aplica todas las validaciones RN-AG sobre el nuevo intervalo, excluyendo al propio turno de la comparación.
- **RN-TU-05**: Todo alta, reprogramación, cancelación o cambio de estado genera un registro de **auditoría** (append-only).

## Dominio: Reserva online del paciente (RN-RE)

- **RN-RE-01**: El paciente solo ve y reserva **huecos libres** que cumplen todas las RN-AG, y solo para prestaciones `reservableOnline`.
- **RN-RE-02**: El paciente puede **cancelar o reprogramar hasta 24 h antes** del `inicio` del turno. Después, solo el profesional o la recepcionista.
- **RN-RE-03**: El paciente reserva y opera **con su propia cuenta** (PA-01). Solo ve y modifica **sus** turnos y datos; intentar operar sobre el turno de otro paciente responde `404`, para no revelar que existe.
- **RN-RE-05**: Para reservar online el paciente necesita una cuenta registrada con email. Ese email recibe las confirmaciones (RN-NO-01).
- **RN-RE-04**: Si dos reservas compiten por el mismo hueco, gana la primera confirmada y la segunda recibe `409 SOLAPAMIENTO_*`. La validación y el guardado son atómicos.
- **RN-RE-06**: Un paciente **no puede reservar online (`POST /api/paciente/turnos`) si ya tiene un turno `reservado` o `confirmado` con `inicio` posterior a ahora** (`409 TURNO_PENDIENTE_EXISTENTE`). Sí puede reprogramar o cancelar ese turno; cuando el turno se cancela o alcanza su horario de inicio (`inicio <= ahora`), puede volver a reservar. El personal puede agendar varias sesiones futuras no superpuestas del mismo paciente.

## Dominio: Notificaciones (RN-NO)

- **RN-NO-01**: Al crear o reprogramar un turno, se envía un **email de confirmación** al paciente con fecha, hora, profesional, box y prestación, más un botón **"Agregar a Google Calendar"** y un `.ics` adjunto.
- **RN-NO-02**: Si el email falla, **el turno no se revierte**. El fallo se registra para reintentar.
- **RN-NO-03**: El email **no incluye el precio** de la prestación.

## Dominio: Ganancias (RN-GA)

- **RN-GA-01**: Las ganancias de un profesional en un período son la **suma de `precioAlReservar` de sus turnos en estado `atendido`** en ese período.
- **RN-GA-02**: El precio se **congela al reservar** (`precioAlReservar`). Cambiar el precio de la prestación no altera turnos existentes (DD-05).
- **RN-GA-03**: Si un turno `atendido` se corrige (PA-04), las ganancias se recalculan con el estado vigente. No se guardan totales precalculados.

## Dominio: Roles y acceso (RN-RO)

- **RN-RO-01**: La **recepcionista no ve precios ni ganancias** en ninguna respuesta de la API.
- **RN-RO-02**: Un profesional **solo ve sus propias ganancias**.
- **RN-RO-03**: Historia clínica y odontograma: **solo profesionales**.
- **RN-RO-04**: La recepcionista puede crear, modificar y cancelar turnos de cualquier profesional del consultorio.

## Dominio: Clínica (RN-CL)

- **RN-CL-01**: Las entradas de historia clínica son **append-only**, con autor y fecha. Una corrección es una entrada nueva que referencia a la anterior. Así lo hacen Odonthia y OdontoClinIA, y lo pide la Ley 26.529 (PA-07).
- **RN-CL-02**: El odontograma usa **notación FDI** (permanentes 11–48 y temporarias 51–85). Cada cambio registra autor y fecha.

## Dominio: Datos y privacidad (RN-DA)

- **RN-DA-01**: **Nunca datos reales de pacientes** en el repositorio, los ejemplos, los tests, las capturas ni la memoria del agente.
- **RN-DA-02**: Ningún secreto (API keys, contraseñas SMTP) en el repositorio. Van en variables de entorno y se documentan en `.env.example` con valores falsos.
- **RN-DA-03**: Los datos de salud son sensibles (Ley 25.326). El acceso se restringe por rol (RN-RO) y queda auditado. El cumplimiento formal es la pregunta abierta PA-07.

## Excepciones globales

- **RN-EX-01**: Toda violación de una regla de negocio responde `409` con un código estable (`SOLAPAMIENTO_PROFESIONAL`, `SOLAPAMIENTO_BOX`, `SOLAPAMIENTO_PACIENTE`, `TURNO_PENDIENTE_EXISTENTE`, `FUERA_DE_GRILLA`, `DURACION_INVALIDA`, `EN_BLOQUEO`, `FUERA_DE_HORARIO`, `EN_EL_PASADO`, `PLAZO_VENCIDO`, `TRANSICION_INVALIDA`, `DUPLICADO`). `DUPLICADO` se usa cuando un dato que debe ser único ya existe (email o documento del paciente, matrícula, nombre de box); se agregó el 2026-11-22 a pedido de C-03 y C-04. `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE` se agregaron el 2026-11-25 en `C-17`. Los errores de formato responden `400`.
