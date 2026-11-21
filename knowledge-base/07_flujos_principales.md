# Flujos Principales

## F-01: Crear turno sin solapamientos (recepción o profesional) ⭐

**Disparador**: `POST /api/turnos` con `{profesionalId, boxId, prestacionId, pacienteId, inicio}`
**Actor**: recepcionista o profesional

**Pasos**:
1. La API valida el formato (Zod) → `400` si falla.
2. El caso de uso `CrearTurno` carga la prestación y calcula `fin = inicio + duracionMin` (RN-AG-06).
3. El dominio valida, en este orden: grilla (RN-AG-05), no en el pasado (RN-AG-10), horario de atención (RN-AG-09), bloqueos del profesional y del box (RN-AG-08).
4. El dominio busca los turnos **no cancelados** del profesional y del box que se superpongan con `[inicio, fin)` (RN-AG-02, RN-AG-03, RN-AG-04).
5. Si hay conflicto → `409` con `SOLAPAMIENTO_PROFESIONAL` y/o `SOLAPAMIENTO_BOX`.
6. Si no hay conflicto, guarda el turno `reservado` con `precioAlReservar`, más un registro de auditoría. Todo en una sola operación atómica (RN-RE-04).
7. Encola el email de confirmación (F-05).

```
Recepción → API → CrearTurno → Agenda(dominio) → RepoTurnos
                                  ← conflicto? ──── turnos activos del prof. y del box
          ← 201 turno | 409 SOLAPAMIENTO_*
```

**Casos de error**:
- Profesional ocupado → `409 SOLAPAMIENTO_PROFESIONAL`
- Box ocupado → `409 SOLAPAMIENTO_BOX`
- Fuera de grilla, de horario o dentro de un bloqueo → `409` con el código correspondiente
- Prestación, profesional o box inexistente o inactivo → `404` / `409`

**Ejemplo de borde (con datos ficticios)**: la Dra. Pérez tiene un turno 10:00–10:30 en Box 1. Un nuevo turno a las 10:30 en Box 1 **se crea**. Uno a las 10:15 se **rechaza**.

## F-02: Cancelar o reprogramar (recepción o profesional)

1. `POST /turnos/:id/cancelar` → valida la transición (RN-TU-01) → estado `cancelado` + auditoría. El horario queda libre (RN-TU-02).
2. `PATCH /turnos/:id/reprogramar` → recalcula `fin` → ejecuta las validaciones de F-01 excluyendo el propio turno (RN-TU-04) → actualiza + auditoría + email.

## F-03: Reserva online del paciente

1. El paciente inicia sesión (`POST /public/login`). Si no tiene cuenta, se registra (`POST /public/pacientes/registro`) (PA-01).
2. `GET /public/prestaciones` → elige una prestación.
3. `GET /public/disponibilidad` → el sistema calcula los huecos: horario de atención, menos bloqueos, menos turnos activos, para profesional y box, en la grilla de 15 min.
4. `POST /paciente/turnos` con el hueco elegido → corre F-01 con `origen = online` y el paciente de la sesión.
5. Respuesta: el turno creado, más el email con Google Calendar (F-05).
6. Si el hueco se ocupó entre la consulta y la reserva → `409`, y el paciente elige otro.

## F-04: Cancelación o reprogramación por el paciente

1. El paciente autenticado hace `POST /paciente/turnos/:id/cancelar` (o `PATCH .../reprogramar`). Si el turno no es suyo → `404` (RN-RE-03).
2. Si `ahora > inicio - 24 h` → `409 PLAZO_VENCIDO` (RN-RE-02). Exactamente 24 h antes se permite.
3. Si no, aplica F-02 con actor `"paciente"`.

## F-05: Email de confirmación con Google Calendar

1. Después de crear o reprogramar, el notificador arma el email: datos del turno, **sin precio** (RN-NO-03).
2. Genera el link `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…&location=…` y el `.ics`.
3. Envía por SMTP. Si falla, registra el error y **no revierte** el turno (RN-NO-02).

## F-06: Ganancias del profesional

1. `GET /profesionales/:id/ganancias?desde&hasta`. Si el usuario no es ese profesional → `403` (RN-RO-02).
2. Suma `precioAlReservar` de los turnos `atendido` en el rango (RN-GA-01).

## F-07: Registro clínico

1. El profesional agrega una entrada de HC (append-only) o actualiza piezas del odontograma (FDI).
2. Cada operación guarda autor y fecha. La recepcionista recibe `403`.
