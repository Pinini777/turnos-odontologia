# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Stack: Node.js + TypeScript
**Decisión**: Node.js 22 LTS + TypeScript `strict` + Fastify + Zod + Vitest. **Confirmada por EP en la revisión de la etapa 3 (2026-11-21)**, después de comparar con Python + FastAPI, Java + Spring Boot y C# + .NET.
**Contexto**: el Discovery dejó el stack "sin restricciones; se decide en la etapa 3". No hace falta UI, pero sí tests reproducibles en las PC Windows de 6 integrantes.
**Alternativas consideradas**:
- *Python + FastAPI + pytest*: buen ajuste con el starter `backend` de Active Stack, pero exige instalar Python en las 6 PC.
- *Java + Spring Boot + JUnit*: conocido en la carrera, pero más pesado para un change chico y más lento de arrancar.
**Justificación**: Node ≥ 22.20 **ya está instalado en todas las PC** porque es requisito de OpenSpec (etapa 0). TypeScript `strict` atrapa errores de tipos en reglas de fechas e intervalos. Vitest corre los tests sin configuración extra.
**Trade-offs aceptados**: fechas en JS exigen cuidado (DD-08). Si el equipo domina otro lenguaje, conviene cambiarlo ahora y no después.

### DD-02 — Intervalos semiabiertos [inicio, fin)
**Decisión**: dos turnos se superponen si `a.inicio < b.fin && b.inicio < a.fin`.
**Contexto**: es la regla central y el escenario de borde obligatorio del change. Ningún competidor la documenta (informe C.3).
**Alternativas**: intervalos cerrados, que bloquearían turnos contiguos y desperdiciarían agenda.
**Justificación**: permite turnos consecutivos sin hueco, que es la práctica real.
**Trade-offs**: ninguno relevante.

### DD-03 — El box como recurso de primer nivel
**Decisión**: todo turno reserva **profesional + box**, y ambos se validan por separado.
**Contexto**: solo 3 de 16 competidores tratan el box como recurso (AgendaPro y OdontoClinIA lo declaran, Dentalink lo documenta).
**Justificación**: dos profesionales no pueden usar el mismo box a la vez, aunque cada uno esté libre.
**Terminología**: se usa "box" en lugar de "sillón" por pedido de EP. "Consultorio" se descartó porque choca con el consultorio como negocio.

### DD-04 — Cancelación lógica ("eliminar = cancelar")
**Decisión**: no hay borrado físico de turnos. "Eliminar" pasa el turno a `cancelado` y queda auditado.
**Contexto**: respuesta de EP en el Discovery, y el MVP exige auditoría.
**Trade-offs**: la tabla crece. Se acepta.

### DD-05 — Precio congelado al reservar
**Decisión**: el turno guarda `precioAlReservar`. Las ganancias usan ese valor.
**Contexto**: con inflación, el precio de una prestación cambia seguido. Recalcular el pasado con el precio de hoy falsearía las ganancias.
**Alternativas**: precio vigente al momento de la consulta (más simple, pero incorrecto).

### DD-06 — Google Calendar sin OAuth
**Decisión**: el email de confirmación incluye un link `calendar.google.com/calendar/render?action=TEMPLATE` y un `.ics`. No se sincroniza la cuenta del profesional.
**Contexto**: pedido explícito de EP. OAuth agrega una integración con credenciales y riesgo para el plazo.

### DD-07 — Persistencia detrás de repositorios, en memoria primero
**Decisión**: el MVP usa repositorios en memoria detrás de interfaces. SQLite viene como adaptador en un change posterior.
**Justificación**: el change evaluado es lógica de dominio y no necesita base. Evita dependencias nativas en Windows al inicio.
**Trade-offs**: los datos no persisten entre reinicios hasta que exista el adaptador SQLite.

### DD-08 — Zona horaria del consultorio
**Decisión**: todas las reglas de grilla, horario y 24 h se evalúan en `APP_TZ` (por defecto `America/Argentina/Mendoza`). Las fechas se persisten en ISO 8601 con offset.
**Contexto**: Argentina no tiene horario de verano hoy, pero el sistema no debe depender de eso.

### DD-09 — Design system y mockup por cada cambio visual
**Decisión**: la política visual del proyecto es **`system-and-mockups`**. Hay un design system aprobado en `design-system/`, y cada change que toque una pantalla presenta un mockup HTML que se aprueba **antes** de implementar.
**Contexto**: el plan de fundación original tenía `visual-design=off`, porque la consigna dice que "no hace falta interfaz gráfica". En la revisión de la etapa 3 (2026-11-21), EP pidió activarla: "Necesitamos esos mockups".
**Trade-offs aceptados**: cada change visual suma un paso de aprobación. Los changes de pura lógica de dominio, como el núcleo de "crear turno sin solapamientos", no lo necesitan si no tocan pantallas.

### DD-12 — Interfaz web con React + Vite
**Decisión**: frontend en React + Vite + TypeScript, que consume la API REST y usa los tokens de `design-system/tokens.css`.
**Contexto**: al activar la política visual (DD-09) el producto pasa a tener interfaz. Se elige React + Vite para quedarse en el mismo lenguaje que el backend (TypeScript), con tipos compartidos y un solo `npm` en todas las PC.
**Alternativas consideradas**: HTML con plantillas del servidor (menos piezas, pero peor para la agenda interactiva); Vue o Svelte (válidos, sin ventaja clara para el equipo).
**Trade-offs aceptados**: dos paquetes (`api` y `web`) en el repo.

## Supuestos inferidos

### SU-01 — Los pacientes prefieren reservar online
**Supuesto**: una parte relevante de los pacientes va a reservar sin llamar.
**Origen**: `discovery.md` §10 (supuesto sin validar con usuarios reales).
**Riesgo si es falso**: la reserva online no reduce trabajo de recepción.
**Cómo validar**: medir la proporción de turnos con `origen = online` en una prueba piloto.

### SU-02 — Un solo consultorio por instalación
**Supuesto**: no hay multi-tenant ni multisucursal en v1.0.
**Origen**: segmento "1 a 3 profesionales" (`discovery.md` §1); multisucursal figura como post-MVP.
**Riesgo si es falso**: habría que agregar un `consultorioId` a todas las entidades.

### SU-03 — La obra social es solo informativa
**Supuesto**: en v1.0 no se valida cobertura ni se liquida a obras sociales.
**Origen**: obras sociales, PUCO y liquidación quedaron como post-MVP (D.3).
**Riesgo si es falso**: el MVP no sirve a consultorios que trabajan mayormente con obra social.

### SU-04 — El email del paciente es obligatorio para la reserva online
**Supuesto**: sin email no hay cuenta, ni confirmación, ni Google Calendar.
**Origen**: RN-NO-01 y PA-01 (el paciente reserva con cuenta, confirmado por EP en la revisión de la etapa 3).
**Riesgo si es falso**: pacientes sin email solo podrían atenderse por recepción, que es aceptable.

### DD-10 — El paciente reserva con cuenta propia
**Decisión**: el paciente se registra con email y contraseña y opera solo sobre sus turnos. Se descarta el "código de reserva" anónimo.
**Contexto**: PA-01, respondida por EP en la revisión de la etapa 3.
**Alternativas consideradas**: reserva sin cuenta con un código no adivinable por turno (menos fricción, pero el paciente no ve su historial de turnos).
**Trade-offs aceptados**: más fricción para la primera reserva y un flujo de registro más que construir y testear (US-022).

### DD-11 — Cada profesional administra sus horarios
**Decisión**: cada profesional carga y mantiene sus horarios de atención y sus bloqueos. Los bloqueos de box los puede cargar cualquier profesional.
**Contexto**: PA-02, respondida por EP en la revisión de la etapa 3.
