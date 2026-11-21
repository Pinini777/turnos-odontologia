# Funcionalidades

Organizadas por **épica** e **historia de usuario** (US-NNN). Todas son del MVP v1.0 salvo la sección final.

## Épica 1: Configuración del consultorio

### US-001 — Gestionar profesionales y boxes
**Como** profesional **quiero** dar de alta profesionales y boxes **para** que existan como recursos reservables.
**Criterios de aceptación**:
- [ ] Puedo crear, editar y desactivar profesionales y boxes.
- [ ] Un box o profesional inactivo no recibe turnos nuevos.
**Reglas**: RN-AG-01

### US-002 — Gestionar prestaciones con duración y precio
**Como** profesional **quiero** definir prestaciones con duración y precio **para** que la agenda y las ganancias se calculen solas.
**Criterios de aceptación**:
- [ ] Rechaza duraciones que no sean múltiplo de 15 (`DURACION_INVALIDA`).
- [ ] La recepcionista ve nombre y duración, pero no el precio.
**Reglas**: RN-AG-06, RN-RO-01, RN-GA-02

### US-003 — Horarios de atención y bloqueos
**Como** profesional **quiero** cargar mis propios horarios y bloquear franjas **para** que no me den turnos cuando no atiendo. *(PA-02: cada profesional carga los suyos.)*
**Criterios de aceptación**:
- [ ] Un turno fuera de horario se rechaza (`FUERA_DE_HORARIO`).
- [ ] Un turno dentro de un bloqueo del profesional o del box se rechaza (`EN_BLOQUEO`).
**Reglas**: RN-AG-08, RN-AG-09

## Épica 2: Agenda y turnos (núcleo)

### US-010 — Crear turno sin solapamientos ⭐ (change evaluado)
**Como** recepcionista o profesional **quiero** crear un turno para un paciente, profesional, box y prestación **para** que quede reservado sin pisar otro.
**Criterios de aceptación**:
- [ ] **Feliz**: profesional y box libres → el turno queda `reservado`, con `fin = inicio + duración`.
- [ ] **Error de negocio**: el profesional ya tiene un turno que se superpone → `409 SOLAPAMIENTO_PROFESIONAL`, no se crea nada.
- [ ] **Error de negocio**: el box ya está ocupado en ese intervalo → `409 SOLAPAMIENTO_BOX`.
- [ ] **Borde**: un turno que empieza exactamente cuando termina otro del mismo box o profesional se crea (intervalos [inicio, fin)).
- [ ] Un turno cancelado no bloquea el horario.
- [ ] Fuera de la grilla de 15 min → `FUERA_DE_GRILLA`.
**Reglas**: RN-AG-01 a RN-AG-07, RN-AG-10, RN-TU-02, RN-TU-05

### US-011 — Cancelar turno ("eliminar")
**Como** recepcionista o profesional **quiero** cancelar un turno **para** liberar el horario.
**Criterios de aceptación**:
- [ ] El turno pasa a `cancelado` y el horario queda libre para otro turno.
- [ ] No hay borrado físico; queda auditado quién y cuándo.
**Reglas**: RN-TU-01, RN-TU-02, RN-TU-03, RN-TU-05

### US-012 — Reprogramar turno
**Como** recepcionista o profesional **quiero** mover un turno a otro horario, box o profesional **para** acomodar al paciente.
**Criterios de aceptación**:
- [ ] Aplica las mismas validaciones que crear, ignorando al propio turno.
- [ ] Reenvía el email de confirmación.
**Reglas**: RN-TU-04, RN-NO-01

### US-013 — Cambiar estado del turno
**Como** profesional o recepcionista **quiero** marcar un turno como confirmado, atendido o ausente **para** reflejar lo que pasó.
**Criterios de aceptación**:
- [ ] Rechaza transiciones inválidas (`TRANSICION_INVALIDA`).
**Reglas**: RN-TU-01

### US-014 — Ver la agenda
**Como** profesional o recepcionista **quiero** ver la agenda diaria o semanal por profesional o por box **para** organizar el día.
**Criterios de aceptación**:
- [ ] Filtros por fecha, profesional y box; muestra los estados.
- [ ] La recepcionista no ve precios.

## Épica 3: Reserva online del paciente

### US-020 — Consultar disponibilidad y reservar
**Como** paciente **quiero** ver los huecos libres y reservar online **para** atenderme sin llamar.
**Criterios de aceptación**:
- [ ] Solo muestra huecos que cumplen todas las RN-AG.
- [ ] Reservo con mi cuenta iniciada y recibo un email de confirmación.
- [ ] Si otro paciente tomó el hueco antes, recibo `409` y puedo elegir otro.
**Reglas**: RN-RE-01, RN-RE-03, RN-RE-04, RN-RE-05, RN-NO-01

### US-022 — Crear mi cuenta e iniciar sesión
**Como** paciente **quiero** registrarme con mi email y contraseña **para** reservar y ver mis turnos.
**Criterios de aceptación**:
- [ ] El email es único; la contraseña se guarda con hash.
- [ ] Si la recepción ya me había cargado, mi cuenta se vincula a mi ficha existente (PA-10).
- [ ] Veo solo mis turnos, nunca los de otros pacientes.
**Reglas**: RN-RE-03, RN-RE-05, RN-DA-02

### US-021 — Cancelar o reprogramar mi turno
**Como** paciente **quiero** cancelar o reprogramar mi turno hasta 24 h antes **para** liberar el horario.
**Criterios de aceptación**:
- [ ] Con menos de 24 h → `409 PLAZO_VENCIDO`.
- [ ] Exactamente 24 h antes se permite (borde).
**Reglas**: RN-RE-02, RN-TU-04

## Épica 4: Notificaciones

### US-030 — Email de confirmación con Google Calendar
**Como** paciente **quiero** recibir un email con mi turno y un botón para agregarlo a Google Calendar **para** no olvidarme.
**Criterios de aceptación**:
- [ ] Incluye fecha, hora, profesional, box y prestación; no incluye el precio.
- [ ] Incluye un link "Agregar a Google Calendar" y un `.ics`.
- [ ] Si el envío falla, el turno igual queda creado.
**Reglas**: RN-NO-01 a RN-NO-03

## Épica 5: Ganancias

### US-040 — Ver mis ganancias
**Como** profesional **quiero** ver mis ganancias por período **para** saber cuánto facturo.
**Criterios de aceptación**:
- [ ] Suma `precioAlReservar` de mis turnos `atendido` en el período.
- [ ] Otro profesional o la recepcionista reciben `403`.
**Reglas**: RN-GA-01 a RN-GA-03, RN-RO-01, RN-RO-02

## Épica 6: Clínica

### US-050 — Historia clínica
**Como** profesional **quiero** registrar evoluciones en la historia clínica del paciente **para** tener su historial.
**Criterios de aceptación**:
- [ ] Las entradas son append-only, con autor y fecha.
- [ ] La recepcionista no puede leerla.
**Reglas**: RN-CL-01, RN-RO-03

### US-051 — Odontograma
**Como** profesional **quiero** registrar el estado de cada pieza dental (FDI) **para** seguir los tratamientos.
**Reglas**: RN-CL-02, RN-RO-03

## Épica 7: Seguridad y auditoría

### US-060 — Autenticación y roles
**Como** consultorio **quiero** que cada usuario entre con su cuenta y rol **para** que cada uno vea solo lo que le corresponde.
**Reglas**: RN-RO-01 a RN-RO-04, RN-DA-02

### US-061 — Auditoría de turnos
**Como** profesional **quiero** ver quién creó, movió o canceló un turno **para** tener trazabilidad.
**Reglas**: RN-TU-05

## Post-MVP (no implementar en v1.0)

Recordatorios por WhatsApp · lista de espera que ofrece huecos liberados · recall de controles · presupuestos y caja · Mercado Pago · facturación ARCA · obras sociales (PUCO, liquidación) · receta electrónica ReNaPDiS · periodontograma e imágenes · app móvil · multisucursal · API pública · IA.
