# Design — `C-17 cierre-integracion`

> **Estado**: Propuesta lista para revisión y aprobación de EP (Governance `ALTO`: toca reglas de agenda del change evaluado `C-02` y cierra la integración UI/API sin datos hardcodeados).

## Context

Los changes `C-01` a `C-16` están implementados y mergeados. Durante las pruebas manuales de punta a punta de Facundo (2026-11-25, aprobadas por EP) se detectaron seis brechas de cierre antes del video de entrega:

1. La agenda valida solapamiento por profesional (`SOLAPAMIENTO_PROFESIONAL`) y por box (`SOLAPAMIENTO_BOX`), pero permite que el mismo paciente tenga dos turnos activos superpuestos en el mismo horario con distinto profesional y box.
2. El paciente puede crear múltiples reservas online futuras pendientes a la vez, cuando el negocio requiere que solo tenga un turno futuro pendiente por autogestión online (pudiendo reprogramarlo o cancelarlo).
3. `web/src/base/InicioPage.tsx` conserva los arreglos hardcodeados `AGENDA_PROFESIONAL_INICIAL` y `AGENDA_RECEPCION_INICIAL`, el turno fijo `"Lunes 23 de noviembre · 09:00 a 09:30"` para el paciente y las etiquetas `"Datos de ejemplo"`, sin consultar la API real.
4. `web/src/base/AppLayout.tsx` muestra nombres fijos (`"Lucía Fernández"` para `paciente1@example.com` y un ternario por email para profesionales) en lugar del nombre real proveniente de la sesión o de la API.
5. `web/src/pages/profesional/AgendaAuditoriaPage.tsx` lista la agenda y la auditoría en `/profesional/agenda`, pero no ofrece botones para confirmar o marcar atendido/ausente un turno (`POST /api/turnos/:id/estado`).
6. `src/shared/seed-demo.ts` solo siembra turnos en semanas pasadas (`semana < 0`) o futuras (`semana >= 1`), dejando vacías las vistas del día actual (`semana: 0`) al iniciar con `npm start`, y asigna dos turnos futuros a Mario Santos.

## Goals / Non-Goals

**Goals:**
- Impedir cualquier solapamiento de turnos no cancelados del mismo paciente (`409 SOLAPAMIENTO_PACIENTE`) en `C-02`, `C-10` y `C-11` dentro de `conLockDeAgenda`, preservando el 100 % de los tests existentes mediante el orden estricto `profesional → box → paciente`.
- Impedir que un paciente reserve online (`POST /api/paciente/turnos`) si ya posee un turno `reservado` o `confirmado` con `inicio > ahora` (`409 TURNO_PENDIENTE_EXISTENTE`), reflejando esa restricción en `/paciente/reservar` con acceso directo a Reprogramar y Cancelar.
- Conectar `/inicio` (`InicioPage.tsx`) y la barra lateral (`AppLayout.tsx`) 100 % a datos reales de la API, eliminando todo arreglo o nombre hardcodeado y toda etiqueta `"Datos de ejemplo"`.
- Habilitar los botones de cambio de estado en `/profesional/agenda` contra `POST /api/turnos/:id/estado`.
- Incorporar turnos del día actual (`semana: 0`) en `src/shared/seed-demo.ts` y dejar a Mario Santos con un único turno futuro pendiente.

**Non-Goals:**
- Agregar nuevas migraciones SQL en Supabase (la regla por paciente vive en el dominio dentro de `conLockDeAgenda`).
- Restringir al personal (`POST /api/turnos` o `POST /api/recepcion/turnos`) de agendar múltiples sesiones futuras de un tratamiento en etapas para el mismo paciente, siempre que sus intervalos no se superpongan.
- Modificar los tests existentes de `C-02`, `C-10` y `C-11` (solo se agregan tests nuevos con el nombre exacto de cada escenario nuevo, y se ajustan `tests/plataforma/seed-demo.test.ts` y `web/src/base/base.test.tsx`).

## Decisions

### D1. Prevención de solapamiento por paciente bajo `conLockDeAgenda` y orden estricto `profesional → box → paciente`

- En `src/modules/turnos-alta/dominio/agenda.ts`, `conflictos(turnos: Turno[], nuevo: Pick<Turno, 'inicio' | 'fin' | 'profesionalId' | 'boxId' | 'pacienteId'>)` se extiende para devolver `{ profesional: boolean; box: boolean; paciente: boolean }`, donde:
  - `activos = turnos.filter((turno) => turno.estado !== 'cancelado' && seSuperponen(turno, nuevo))`
  - `profesional: activos.some((t) => t.profesionalId === nuevo.profesionalId)`
  - `box: activos.some((t) => t.boxId === nuevo.boxId)`
  - `paciente: activos.some((t) => t.pacienteId === nuevo.pacienteId)`
- En todos los casos de uso que crean o mueven turnos dentro de `conLockDeAgenda`:
  1. **`C-02` (`src/modules/turnos-alta/aplicacion/crear-turno.ts`)**: el filtro de `repos.turnos.listar` incluye `existente.profesionalId === turno.profesionalId || existente.boxId === turno.boxId || existente.pacienteId === turno.pacienteId`. Luego evalúa en orden:
     - `if (choque.profesional) throw new ReglaDeNegocioError('SOLAPAMIENTO_PROFESIONAL');`
     - `if (choque.box) throw new ReglaDeNegocioError('SOLAPAMIENTO_BOX');`
     - `if (choque.paciente) throw new ReglaDeNegocioError('SOLAPAMIENTO_PACIENTE');`
  2. **`C-10` (`src/modules/turnos-reprogramacion/aplicacion/reprogramar-turno.ts`)**: el filtro de `repos.turnos.listar` incluye `t.profesionalId === profesionalId || t.boxId === boxId || t.pacienteId === original.pacienteId`, aplica `sinElPropio(otros, turnoId)` para que el turno no choque consigo mismo y evalúa `profesional → box → paciente`. Como `C-11` (`reprogramarTurnoPaciente`) delega en `reprogramarTurno`, la reprogramación del paciente hereda automáticamente la validación y la exclusión del propio turno.
  3. **`C-11` (`src/modules/reserva-online/aplicacion/reservar-turno.ts`)**: tanto con `boxExplicito` como con selección automática de box (`seleccionarBoxLibre`), la validación verifica primero horario, bloqueo, `SOLAPAMIENTO_PROFESIONAL` y `SOLAPAMIENTO_BOX`, y inmediatamente después verifica si existe algún turno activo del mismo `paciente.id` que se superponga con `[inicio, fin)`, lanzando `ReglaDeNegocioError('SOLAPAMIENTO_PACIENTE')` antes de guardar paciente inline, auditoría o turno.
- **Justificación del orden `profesional → box → paciente`**: en las suites existentes de `C-02`, `C-10` y `C-11`, varios tests reutilizan a `Paciente Ficticio Uno` para probar choques de profesional o de box en el mismo horario. Evaluar `paciente` al final garantiza que esos tests sigan recibiendo exactamente `SOLAPAMIENTO_PROFESIONAL` o `SOLAPAMIENTO_BOX` sin tocar una sola línea de las suites previas.

### D2. Un solo turno futuro pendiente en la reserva online (`409 TURNO_PENDIENTE_EXISTENTE`) y bloqueo preventivo en `/paciente/reservar`

- **Regla de dominio (`RN-RE-06`)**: en `reservarTurnoOnline` (`src/modules/reserva-online/aplicacion/reservar-turno.ts`), dentro de `conLockDeAgenda`, se consultan los turnos del `paciente.id`. Si existe algún turno con `(t.estado === 'reservado' || t.estado === 'confirmado') && t.inicio.getTime() > ahora.getTime()`, se lanza `new ReglaDeNegocioError('TURNO_PENDIENTE_EXISTENTE')` tras las validaciones de recursos/agenda del hueco o al inicio del lock (respetando que las validaciones de formato/grilla/pasado/recurso inactivo sigan respondiendo primero, y dentro del lock verificando si el paciente ya tiene un turno pendiente con `inicio > ahora`).
  - *Nota de precedencia con tests existentes de `C-11`*: en `tests/reserva-online/`, cada test de `POST /api/paciente/turnos` usa un repositorio fresco o concurrencia simultánea (`Promise.all`) donde el segundo request compite por el mismo hueco (`10:00`). Para que el escenario existente `"Reservas concurrentes sobre el mismo hueco serializan el acceso y solo una tiene éxito"` (que usa dos pacientes distintos, `Paciente Ficticio Uno` y `Paciente Ficticio Dos`) siga devolviendo `SOLAPAMIENTO_PROFESIONAL`, la regla de turno pendiente solo mira turnos del **mismo** `paciente.id`. Además, si se evalúa después de `validarAgendaYSeleccionarBox` (o si el paciente no tiene otro turno previo), no interfiere con ningún test de `FUERA_DE_GRILLA`, `EN_EL_PASADO`, `FUERA_DE_HORARIO`, `EN_BLOQUEO`, `SOLAPAMIENTO_PROFESIONAL` ni `SOLAPAMIENTO_BOX`. Evaluar `TURNO_PENDIENTE_EXISTENTE` dentro de `conLockDeAgenda` para el mismo `paciente.id` cuando `(t.estado === 'reservado' || t.estado === 'confirmado') && t.inicio.getTime() > ahora.getTime()` cumple todos los escenarios.
- **Alcance**: aplica únicamente a `POST /api/paciente/turnos`. Ni `POST /api/turnos` ni `POST /api/recepcion/turnos` aplican `TURNO_PENDIENTE_EXISTENTE`, permitiendo al personal agendar tratamientos de varias sesiones futuras. Cuando el turno pendiente del paciente es cancelado (`estado === 'cancelado'`), pasa a `atendido`/`ausente` o alcanza su hora de atención (`inicio <= ahora`), el paciente puede volver a reservar online.
- **UI en `web/src/pages/paciente/ReservarPage.tsx`**:
  - Al montar `ReservarContenido`, consulta en paralelo `listarPrestacionesPublicas()` y `listarMisTurnos()`.
  - Determina si existe un turno pendiente futuro: `turnoPendiente = turnos.find((t) => (t.estado === 'reservado' || t.estado === 'confirmado') && Date.parse(t.inicio) > obtenerAhora().getTime())`.
  - Si `turnoPendiente` existe, en lugar del formulario de pasos 1 y 2 muestra una tarjeta destacada con los datos reales de ese turno pendiente (bloque calendario, prestación resuelta contra el catálogo público, fecha y horario en zona del consultorio, profesional y box) y los botones de acción directa:
    - **Reprogramar turno** (`Link` a `/paciente/turnos/${turnoPendiente.id}/reprogramar`, o aviso si faltan menos de 24 h según `puedeAutogestionarTurno`).
    - **Cancelar turno** / **Ver en Mis turnos** (acción de cancelación con confirmación o enlace directo a `/paciente/turnos`).
  - En la vista de confirmación tras crear un turno (`turnoConfirmado`), se elimina el botón `"Reservar otro turno"` para no invitar a una acción prohibida por la regla de negocio.
  - En `web/src/pages/paciente/dominio.ts`, se agrega `'SOLAPAMIENTO_PACIENTE'` a `CODIGOS_CONFLICTO_HUECO` para que, si un paciente reprograma hacia un horario donde ya tenía otro turno (agendado por recepción), la UI recargue los huecos disponibles.

### D3. `/inicio` (`InicioPage.tsx`) y `AppLayout.tsx` conectados 100 % a datos reales (cero datos hardcodeados)

- **`web/src/base/InicioPage.tsx`**:
  - Se eliminan por completo `AGENDA_PROFESIONAL_INICIAL`, `AGENDA_RECEPCION_INICIAL`, `saludoProfesional(email)` basado en ternario fijo, `boxProfesional(email)` fijo, la tarjeta hardcodeada `"Lunes 23 de noviembre · 09:00 a 09:30"` / `"Lucía Fernández"` y todos los `<span className="wb-tag-ejemplo">Datos de ejemplo</span>`.
  - **Rango del día actual en zona del consultorio (`America/Argentina/Mendoza`)**: se calcula la fecha `YYYY-MM-DD` actual en `America/Argentina/Mendoza` y se construye `desde = ${hoy}T00:00:00-03:00` y `hasta = ${manana}T00:00:00-03:00` (o `${hoy}T23:59:59-03:00`).
  - **Vista `profesional`**:
    - Consulta `GET /api/agenda?desde=...&hasta=...` (filtrando por el profesional de la sesión cuando se resuelve desde `GET /api/profesionales` por `usuarioId === sesion.usuario.id`) y muestra los turnos reales del día.
    - Las tarjetas de métricas (`Turnos de hoy`, `Próximo paciente`, `Box asignado`) se calculan a partir de los turnos reales devueltos por la API y del profesional autenticado.
    - Los botones rápidos `"Confirmar"` (`estado: 'confirmado'`) y `"Marcar atendido"` (`estado: 'atendido'`) llaman a `POST /api/turnos/:id/estado` mediante `apiConsultorio.post` y vuelven a cargar la agenda real; ante error `409` muestran `AlertaErrorNegocio`.
    - El botón `"Actualizar agenda"` vuelve a invocar `GET /api/agenda`.
  - **Vista `recepcionista`**:
    - Consulta `GET /api/agenda?desde=...&hasta=...` para todos los boxes y profesionales del día.
    - Calcula el estado real de `Box 1` y `Box 2` a partir de los turnos activos del día y el contador real de `Pendientes de confirmar` (`estado === 'reservado'`).
    - Los botones `"Confirmar"` y `"Marcar atendido"` invocan `POST /api/turnos/:id/estado` y refrescan la agenda real.
    - El botón `"Actualizar"` vuelve a consultar `GET /api/agenda`, y el botón `"+ Nuevo turno"` navega directamente a `/recepcion/turnos/nuevo` (`navigate('/recepcion/turnos/nuevo')`).
  - **Vista `paciente`**:
    - Consulta `GET /api/paciente/turnos` y `GET /api/public/prestaciones` al montar.
    - Selecciona el próximo turno activo (`reservado` o `confirmado` con `inicio >= ahora`, o el primer turno activo ordenado por `inicio`).
    - Si existe, renderiza la tarjeta `"Tu próximo turno"` con su bloque calendario real (`mes`, `día`, `día de semana`), nombre real de la prestación, horario en `America/Argentina/Mendoza`, profesional, box y botones `"Reprogramar turno"` (`/paciente/turnos/${turno.id}/reprogramar`) y `"Cancelar turno"` (`/paciente/turnos`).
    - Si el paciente no tiene turnos activos pendientes, muestra un `EstadoVacio` claro dentro de `"Tu próximo turno"` con botón para ir a `/paciente/reservar`.
- **`web/src/base/AppLayout.tsx`**:
  - Se elimina `"Lucía Fernández"` y el ternario fijo `email.includes('profesional2') ? 'Dr. Bruno Gómez' : 'Dra. Ana Pérez'`.
  - `AppLayout` resuelve el nombre visible real de la sesión:
    - Para `paciente`: consulta `GET /api/paciente/datos` (`apiConsultorio.get<PacienteApi>('/api/paciente/datos')`) y muestra `${datos.nombre} ${datos.apellido}`.
    - Para `profesional`: consulta `GET /api/profesionales` y busca el profesional con `usuarioId === sesion.usuario.id`, mostrando `profesional.nombre`.
    - Para `recepcionista`: muestra `'Recepción Alvear'` (o el nombre si viniera en sesión).
    - Mientras la petición carga o si en un test unitario aislado de layout no se mockeó el endpoint, hace fallback limpio al `email` de la sesión (`sesion.usuario.email`) sin nunca inventar nombres de personas hardcodeados.
  - Se cachea por `sesion.usuario.id` en memoria del módulo para evitar refetch innecesario al navegar entre páginas.
- **Actualización de `web/src/base/base.test.tsx`**:
  - Los tests de `InicioPage` y `AppLayout` en `base.test.tsx` pasan a mockear `fetch` con respuestas reales de `/api/agenda`, `/api/paciente/turnos`, `/api/paciente/datos`, `/api/profesionales` y `POST /api/turnos/:id/estado`, verificando que no exista la etiqueta `"Datos de ejemplo"` ni `"Lucía Fernández"` hardcodeada y que las acciones rápidas disparen `POST /api/turnos/:id/estado`.

### D4. Cambio de estado e historial clínico legible en `/profesional/agenda` (`AgendaAuditoriaPage.tsx`)

- En `web/src/pages/profesional/apiProfesional.ts` se agrega `cambiarEstadoTurnoProfesional(id: string, estado: 'confirmado' | 'atendido' | 'ausente', cliente = apiConsultorio)` que invoca `POST /api/turnos/${encodeURIComponent(id)}/estado` con `{ estado }`.
- En `web/src/pages/profesional/AgendaAuditoriaPage.tsx`:
  - La columna de la tabla pasa a llamarse `"Acciones"` y el enlace de detalle pasa de `"Ver auditoría"` a `"Ver historial"`.
  - Cada fila de la tabla de turnos en `/profesional/agenda` agrega en sus acciones (junto a `"Ver historial"`):
    - Si `t.estado === 'reservado'`: botón `"Confirmar"` → envía `{ estado: 'confirmado' }`.
    - Si `t.estado === 'confirmado'`: botones `"Marcar atendido"` (`{ estado: 'atendido' }`) y `"Marcar ausente"` (`{ estado: 'ausente' }`).
  - Al completarse el `POST`, vuelve a consultar `listarAgenda(...)` para refrescar la tabla en vivo. Si la API responde `409` (por ejemplo `TRANSICION_INVALIDA`), muestra `AlertaErrorNegocio` con el código devuelto.
  - En `/profesional/turnos/:id/auditoria` (`ContenidoAuditoria`): se reemplaza el título técnico por `"Historial del turno"` / `"Movimientos del turno"` y se elimina por completo `<pre>{JSON.stringify(reg.detalle, null, 2)}</pre>`. Cada movimiento traduce la acción (`"Turno reservado"`, `"Cambio de estado"`, `"Turno reprogramado"`, `"Turno cancelado"`), traduce el responsable (`"Paciente (reserva online)"`, `"Recepción"`, nombre del profesional o `"Personal del consultorio"`, nunca UUIDs crudos) y formatea el detalle en español claro con `<BadgeEstadoTurno>` y horarios formateados en la zona del consultorio.

### D5. Semilla demo con turnos de hoy (`semana: 0`), un solo turno futuro para Mario Santos y ajuste de `seed-demo.test.ts`

- En `src/shared/seed-demo.ts`:
  - Se agregan visitas con `semana: 0` (día hábil actual según `fechaVisita(ahora, 0, hora)`) en estados `reservado` y `confirmado` tanto para `anaPerez` (Box 1) como para `brunoGomez` (Box 2), en horarios distintos de la mañana (`09:00` a `12:00`) sin superponerse entre sí ni por paciente:
    - Por ejemplo: `ravenna` con `anaPerez` en `semana: 0, hora: '09:00', estado: 'confirmado'`, `mafalda` con `anaPerez` en `semana: 0, hora: '10:30', estado: 'reservado'`, `lamponne` con `brunoGomez` en `semana: 0, hora: '09:30', estado: 'confirmado'`, `medina` con `brunoGomez` en `semana: 0, hora: '11:00', estado: 'reservado'`.
  - Para **Mario Santos** (`santos@example.com`), se deja **un único turno futuro pendiente** (`semana: 1, hora: '09:45', estado: 'confirmado'`), eliminando o pasando a histórico su segundo turno futuro de `semana: 6`, de modo que la semilla cumpla el invariante de un solo turno pendiente para el paciente con cuenta online.
- En `tests/plataforma/seed-demo.test.ts`:
  - Se verifica que `conflictos(otros, t)` sea `{ profesional: false, box: false, paciente: false }` para todo turno no cancelado.
  - Se actualiza la aserción temporal: los turnos con `semana: 0` pertenecen al día hábil de `ahora` (o lunes siguiente si `ahora` es fin de semana) y pueden tener `inicio <= ahora` cuando el reloj de prueba es a las `22:30`, mientras que los turnos históricos (`atendido`, `ausente`, `cancelado`) siguen teniendo `fin < ahora`.
  - Se verifica que existan turnos en `semana: 0` para ambos profesionales y que Mario Santos tenga exactamente 1 turno en estado `reservado` o `confirmado` (y el total de turnos de Santos coincida con la semilla actualizada).

### D6. Catálogo de códigos de error y Knowledge Base (`05_reglas_de_negocio.md`)

- `src/shared/errores.ts`: agrega `'SOLAPAMIENTO_PACIENTE'` y `'TURNO_PENDIENTE_EXISTENTE'` a `CODIGOS_NEGOCIO`.
- `web/src/base/errores.ts`: agrega en `MENSAJES_POR_CODIGO`:
  - `SOLAPAMIENTO_PACIENTE`: `'El paciente ya tiene otro turno reservado en ese horario. Elegí otro bloque disponible.'`
  - `TURNO_PENDIENTE_EXISTENTE`: `'Ya tenés un turno pendiente de atención. Podés reprogramarlo o cancelarlo desde Mis turnos.'`
- `knowledge-base/05_reglas_de_negocio.md`:
  - En `## Dominio: Agenda (RN-AG)`: documenta `RN-AG-11` (un paciente no puede tener dos turnos no cancelados superpuestos, sin importar profesional ni box; orden de chequeo `profesional → box → paciente`; al reprogramar se excluye el propio turno).
  - En `## Dominio: Reserva online del paciente (RN-RE)`: documenta `RN-RE-06` (un paciente no puede reservar online si ya tiene un turno `reservado` o `confirmado` con `inicio > ahora` → `409 TURNO_PENDIENTE_EXISTENTE`; sí puede reprogramarlo o cancelarlo; el personal puede agendar varias sesiones futuras no superpuestas).
  - En `## Excepciones globales`: actualiza `RN-EX-01` sumando `SOLAPAMIENTO_PACIENTE` y `TURNO_PENDIENTE_EXISTENTE`.

## Risks / Trade-offs

- **[Riesgo: Romper tests existentes de `C-02`, `C-10` o `C-11` que reutilizan el mismo paciente para probar choques de profesional o box]** → Mitigado por el orden estricto `profesional → box → paciente` dentro de `conLockDeAgenda` y por evaluar `TURNO_PENDIENTE_EXISTENTE` solo en `POST /api/paciente/turnos`.
- **[Riesgo: Base de datos de Supabase ya sembrada previamente]** → Documentado en los supuestos del change: `cargarSeedSiVacio` solo siembra cuando la base está vacía; en memoria (`npm start` sin `DATABASE_URL`) los turnos de hoy se ven siempre, y contra Supabase EP decide si vacía y vuelve a arrancar.
- **[Riesgo: Tests de `web/src/base/base.test.tsx` que buscaban `"Datos de ejemplo"` o `"2 turnos"` sincrónicamente sin mock de `fetch`]** → Mitigado actualizando `base.test.tsx` en la tarea de `web-base` para mockear `fetch` con datos reales de la API y usar `waitFor`, eliminando toda aserción sobre `"Datos de ejemplo"`.

## UI Mockups

- Decision: none — integración de datos reales y acciones sobre pantallas y componentes ya aprobados en `design-system` rev. 2 (`C-12`, `C-13`, `C-14` y `C-15`).

## Open Questions

Ninguna. Los supuestos por defecto de `CHANGES.md` quedan plasmados en este diseño para la aprobación de EP antes de `apply`.
