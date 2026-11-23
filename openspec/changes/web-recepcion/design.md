# Design

## Context

Ver `proposal.md` (Why). C-12 dejó en `main` la base del frontend que este change consume sin editar:

- **Autoload de rutas**: `web/src/main.tsx` importa cada `web/src/pages/<area>/routes.tsx` (`import.meta.glob`). Nadie edita `main.tsx` ni `rutas.ts`.
- **`web/src/base/`**: `AppLayout` (con la prop `itemsExtra`, que reemplaza ítems del menú por ruta), `useSesion` y `apiConsultorio` (cliente HTTP con el token y manejo de `401`), `ErrorApi` con `code` y `mensajeLegible` (`describirCodigoNegocio`), y componentes (`Boton`, `Campo`, `AlertaErrorNegocio`, `BadgeEstadoTurno`, `EstadoVacio`, `Tabla`, `Skeleton*`, `AvatarIniciales`). En `base/menu.ts`, "Agenda del día" (`/recepcion/agenda`) y "Pacientes" (`/recepcion/pacientes`) están como `proximamente`.
- **Backend** (todo en `main`): `GET /api/agenda?desde&hasta[&profesionalId][&boxId]` devuelve turnos con `paciente`, `profesional`, `box` y `prestacion` (sin precio) (C-07); `GET /api/recepcion/disponibilidad?prestacionId&desde&hasta[&profesionalId]` devuelve huecos `{ inicio, fin, profesionalId, boxIds }` y `POST /api/recepcion/turnos` crea con `pacienteId` o `paciente` inline y `boxId` opcional (C-11); `POST /api/turnos/:id/cancelar` y `/estado` (C-05); `PATCH /api/turnos/:id/reprogramar` (C-10); `GET`/`POST /api/pacientes` (C-04); `GET /api/profesionales`, `/api/boxes` y `/api/prestaciones` (C-03).

Restricciones: regla dura 3 (solo `web/src/pages/recepcion/` y este change), regla 4 (nunca precios a la recepcionista), regla 6 (TypeScript `strict`, sin `any`) y la política visual `system-and-mockups` (design system revisión 2 aprobado; los mockups de este change necesitan aprobación de EP antes del apply).

## Goals / Non-Goals

**Goals:**
- Que la recepcionista pueda hacer todo el ciclo del turno (ver, dar, mover, cancelar, cambiar estado) sin salir de dos pantallas: agenda y nuevo turno.
- Que dar un turno sea elegir un hueco libre, no adivinar una hora (decisión del explore).
- Lógica de estados y fechas en funciones puras testeables sin React.

**Non-Goals:**
- No se edita `web/src/base/`. Si hace falta un componente nuevo, vive en `pages/recepcion/`.
- No hay auditoría del turno (solo el profesional la ve, C-15) ni precios.
- No hay arrastrar y soltar en la agenda: reprogramar es un formulario.
- No hay actualización en tiempo real: la agenda se vuelve a pedir después de cada acción y al volver a la pantalla.

## Decisions

### D1 — Estructura del área

```
web/src/pages/recepcion/
  routes.tsx                 /recepcion/agenda, /recepcion/turnos/nuevo,
                             /recepcion/turnos/:id/reprogramar, /recepcion/pacientes
  api.ts                     funciones tipadas sobre apiConsultorio (agenda, disponibilidad,
                             crear turno, cancelar, estado, reprogramar, pacientes, catálogos)
  dominio.ts                 puras: accionesPara(estado), rangoDia/rangoSemana(fecha),
                             agruparPorDia, filtrarPacientes, sinPrecio(texto)
  menu.ts                    ITEMS_RECEPCION para itemsExtra (mismas rutas, sin proximamente)
  SoloRecepcion.tsx          guarda de rol: sin sesión -> /login; otro rol -> aviso
  AgendaPage.tsx             vista día/semana + filtros + tarjeta de turno + acciones
  NuevoTurnoPage.tsx         formulario: prestación/profesional/día -> SelectorHuecos -> paciente
  ReprogramarPage.tsx        turno actual + SelectorHuecos
  PacientesPage.tsx          lista + buscador + alta
  SelectorHuecos.tsx         compartido por nuevo turno y reprogramar
  *.test.ts(x)               junto a cada archivo
```

Rutas en páginas (no modales) para que cada pantalla tenga URL propia, se pueda volver con "atrás" y se pruebe aislada.

### D2 — Menú sin tocar C-12

`ITEMS_RECEPCION` repite "Agenda del día" y "Pacientes" con las mismas rutas y `proximamente: false`, y cada página lo pasa a `AppLayout` como `itemsExtra`. `obtenerMenuPorRol` reemplaza por ruta, así que el placeholder desaparece sin editar `base/menu.ts`.
*Riesgo:* en la pantalla de inicio de C-12 (que no recibe `itemsExtra`) los ítems siguen apuntando a la vista previa. Se le avisa a Lucas en el PR; se resuelve con una línea en C-12 o C-15 cuando exista un registro de ítems por área.

### D3 — Huecos libres para dar y mover turnos (decisión del explore)

`SelectorHuecos` recibe prestación, profesional (opcional) y día, pide `GET /api/recepcion/disponibilidad` con el rango de ese día y muestra los huecos como botones agrupados por mañana y tarde. Al elegir uno, muestra sus boxes libres con "Automático" preseleccionado.
*Alternativa descartada:* hora libre a mano. La recepcionista prueba a ciegas y el `409` pasa a ser el caso normal.
*Límite conocido:* la disponibilidad cuenta al propio turno como ocupado, así que reprogramar no ofrece mover 15 minutos sobre su mismo horario (el backend sí lo acepta, C-10). Se anota en Riesgos.

### D4 — Crear con las rutas de recepción de C-11

`POST /api/recepcion/turnos` en vez de `POST /api/turnos` (C-02): acepta paciente nuevo inline de forma atómica, cualquier prestación activa y box automático. Es un cambio respecto de la ficha de `CHANGES.md`, decidido en el explore.

### D5 — Acciones como función pura

`accionesPara(estado)` devuelve la lista de acciones (`confirmar`, `atendido`, `ausente`, `reprogramar`, `cancelar`) según la tabla del spec. No replica la regla horaria de C-05 (atendido/ausente solo después del inicio): la UI ofrece la acción y, si el backend responde `409 TRANSICION_INVALIDA`, muestra el mensaje legible. Así la regla vive en un solo lugar.

### D6 — Errores

Toda llamada pasa por `apiConsultorio`, que convierte la respuesta en `ErrorApi`. Las pantallas muestran `AlertaErrorNegocio` con el `mensajeLegible` y conservan el estado del formulario. Ante `SOLAPAMIENTO_*` el selector vuelve a pedir los huecos (D3). El `401` ya lo maneja C-12 (cierra la sesión).

### D7 — Fechas en la zona del consultorio

Los rangos (`rangoDia`, `rangoSemana` de lunes a domingo) se arman en `America/Argentina/Mendoza` con offset `-03:00` explícito (Argentina no tiene horario de verano) y se envían como ISO con offset, como exige la API. Las horas se muestran con `Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza' })`. "Hoy" sale de un reloj inyectable para los tests.

### D8 — Sin precios

El backend ya los quita para la recepcionista. Además, los tipos de `pages/recepcion/api.ts` no declaran ningún campo de precio y los componentes renderizan solo campos explícitos, nunca el objeto completo. Un test inyecta una respuesta con `precioAlReservar` y verifica que no aparezca ni el número ni `$`.

### D9 — Tests

Vitest + Testing Library (ya en `web/` por C-12), con `fetch` simulado por test; sin red. Dominio puro en `dominio.test.ts`; cada página con su test de componentes. Un test por escenario del spec (regla dura 8).

## Risks / Trade-offs

- [Reprogramar no ofrece el propio horario corrido 15 minutos] → Límite de `/api/recepcion/disponibilidad` (D3). Se acepta para el MVP; si molesta, C-11 puede agregar un parámetro `excluirTurnoId`.
- [El inicio de C-12 sigue mostrando las vistas previas de recepción] → D2; aviso a Lucas en el PR.
- [Atendido/ausente se ofrecen antes de que empiece el turno] → D5: el backend lo rechaza con mensaje legible. Evita duplicar la regla horaria.
- [La agenda semanal con muchos turnos en celular] → En 390 px la semana se muestra como lista por día, no como grilla.

## UI Mockups

- Design system revision: 2 (`design-system/tokens.css`, `design-system/brand.js`)
- Decision: yes — 2026-11-23
- Mockups: `openspec/changes/web-recepcion/mockups/` (`agenda.html`, `nuevo-turno.html`, `reprogramar.html`, ver `mockups/README.md`)
- Approval: pending
- Preview: rendered (2026-11-23, `mockups/previews/` a 390x844 y 1440x900)
- Visual verify: pending
