# Design — `C-15 web-profesional`

> **Estado**: Diseño y mockups **propuestos, pendientes de aprobación explícita de EP antes de iniciar `apply`** (política `system-and-mockups`).

## Context

`web/src/main.tsx` está congelado tras `C-01` y carga automáticamente todas las rutas declaradas en `web/src/pages/*/routes.tsx` (`import.meta.glob`). `C-12 web-base` provee `AppLayout`, `obtenerMenuPorRol`, `useSesion`, `apiConsultorio`, `ErrorApi`, `AlertaErrorNegocio`, `Boton`, `Campo`, `BadgeEstadoTurno`, `AvatarIniciales`, `Tabla`, `EstadoVacio`, `Skeleton*` e íconos SVG sin dependencias externas, importando `design-system/tokens.css` (rev. 2, Clínica Dental Alvear).

Los endpoints backend requeridos por el rol `profesional` ya están implementados y probados en `C-03`, `C-04`, `C-07`, `C-08` y `C-09`. `C-15` debe vivir 100 % dentro de `web/src/pages/profesional/` sin editar ningún archivo compartido ni instalar nuevas dependencias de npm.

## Goals / Non-Goals

**Goals:**
- Entregar las 5 vistas del área profesional (`/profesional/catalogo`, `/profesional/horarios`, `/profesional/ganancias`, `/profesional/clinica`, `/profesional/agenda` + `/profesional/turnos/:id/auditoria`) reutilizando los primitivos de `web/src/base/` y los tokens de `design-system/tokens.css`.
- Garantizar aislamiento estricto por rol (`GuardiaProfesional`) y confidencialidad de ganancias (consulta únicamente por el `profesionalId` del profesional logueado, sin selector de otros profesionales).
- Implementar un odontograma clínico SVG FDI realista de 5 caras por pieza con mapeo anatómico espejado por cuadrante, soporte para dentición temporaria (`51–85`), codificación dual (color + patrón/símbolo WCAG 1.4.1) y accesibilidad completa por teclado/ARIA.
- Proveer 4 mockups HTML responsive (390×844 y 1440×900) con datos 100 % ficticios (`RN-DA-01`) y terminología `box` para revisión y aprobación de EP antes de `apply`.

**Non-Goals:**
- Modificar `web/src/base/menu.ts` u otros archivos compartidos (EP quitará `proximamente: true` en su commit `chore(shared)`).
- Implementar funcionalidades fuera del MVP (cobros, presupuestos, radiografías, periodontograma, exportación Ley 25.326 o borrado físico de historia clínica/auditoría).
- Incorporar librerías externas al `package.json` congelado.

## Architecture (`web/src/pages/profesional/`)

```text
web/src/pages/profesional/
├── routes.tsx                 # export const routes: RouteObject[] (5 rutas + /turnos/:id/auditoria)
├── GuardiaProfesional.tsx     # RBAC guard (sin sesión → /login; otro rol → SIN_PERMISO sin fetches)
├── menuProfesional.ts         # MENU_PROFESIONAL (itemsExtra para AppLayout)
├── useProfesionalActual.ts    # GET /api/profesionales → match usuarioId === sesion.usuario.id
├── apiProfesional.ts          # Cliente tipado sobre apiConsultorio (C-03, C-04, C-07, C-08, C-09)
├── formatos.ts                # Moneda ARS, fechas/horas APP_TZ, grilla 15 min (:00/:15/:30/:45)
├── odontogramaFdi.ts          # Helper puro FDI: cuadrantes, nombres anatómicos y orientación de caras
├── OdontogramaFdi.tsx         # Componente SVG interactivo de 5 caras + overlays + accesibilidad
├── profesional.css            # Estilos locales del área usando tokens de design-system/tokens.css
├── CatalogoPage.tsx           # /profesional/catalogo (Prestaciones con ARS, Boxes, Profesionales)
├── HorariosPage.tsx           # /profesional/horarios (Franjas 15 min + Bloqueos XOR)
├── GananciasPage.tsx          # /profesional/ganancias (Solo profesionalId propio + desglose atendidos)
├── ClinicaPage.tsx            # /profesional/clinica (Selector paciente + HC append-only + Odontograma)
├── AgendaAuditoriaPage.tsx    # /profesional/agenda y /profesional/turnos/:id/auditoria
└── profesional.test.tsx       # Suite Vitest (jsdom + @testing-library/react), 1 it por escenario
```

## Decisions

### D1. Enrutamiento, guardia RBAC y menú sin tocar `web/src/base/menu.ts`
- `routes.tsx` exporta `routes: RouteObject[]` con las rutas:
  - `/profesional/catalogo`
  - `/profesional/horarios`
  - `/profesional/ganancias`
  - `/profesional/clinica`
  - `/profesional/agenda`
  - `/profesional/turnos/:id/auditoria`
- `GuardiaProfesional` envuelve cada página antes de montar efectos o ejecutar llamadas HTTP:
  - Si `sesion === null`, redirige a `/login` (`<Navigate to="/login" replace />`).
  - Si `sesion.usuario.rol !== 'profesional'` (`recepcionista` o `paciente`), renderiza una vista contenida dentro de `AppLayout` con `AlertaErrorNegocio` (`code="SIN_PERMISO"`) y botón de regreso a `/inicio`, garantizando **cero** llamadas a endpoints profesionales.
- `MENU_PROFESIONAL` define los 5 `ItemMenu` del rol `profesional` con `proximamente: false` y se pasa como `itemsExtra={MENU_PROFESIONAL}` a `AppLayout` en todas las vistas del área. De este modo, las rutas son navegables entre sí sin tocar `web/src/base/menu.ts`; EP removerá `proximamente: true` del menú base en `chore(shared)`.

### D2. Resolución del profesional autenticado (`useProfesionalActual`)
`POST /api/public/login` devuelve `UsuarioPublico { id, email, rol, activo }` sin incluir `profesionalId`. El hook `useProfesionalActual()` consulta `GET /api/profesionales` una vez para la sesión vigente y selecciona el registro cuyo `usuarioId === sesion.usuario.id`. Expone `{ profesional, cargando, error, recargar }` y alimenta:
- `HorariosPage`: `GET/POST /api/profesionales/:id/horarios` y bloqueos propios (`profesionalId: profesional.id`).
- `GananciasPage`: `GET /api/profesionales/:id/ganancias` y `GET /api/agenda?profesionalId=<propio>`.

### D3. Detalle por página y contratos API

1. **`CatalogoPage.tsx` (`/profesional/catalogo`)**
   - Pestañas accesibles (`role="tablist"`): **Prestaciones**, **Boxes** y **Profesionales**.
   - **Prestaciones**: tabla fluida sin scroll horizontal (filas apiladas en tarjetas en mobile `≤ 768px`) con nombre, duración (`min`), precio formateado en ARS (`$ 18.000,00`), indicador de reserva online y estado activo/inactivo. Formulario de alta/edición contra `POST /api/prestaciones` y `PATCH /api/prestaciones/:id` con selector `<select>` de duración restringido a múltiplos de 15 minutos (`15`, `30`, `45`, `60`, `75`, `90`, `105`, `120`, `150`, `180` min; sin campo de texto libre). Mantiene manejo defensivo con `AlertaErrorNegocio` (`role="alert"`) ante cualquier respuesta backend `409 DURACION_INVALIDA`, además de `400`/`409` (`DUPLICADO`, `FORMATO_INVALIDO`).
   - **Boxes**: alta (`POST /api/boxes`) y edición/activación (`PATCH /api/boxes/:id`) usando siempre el término **box** (nunca "sillón").
   - **Profesionales**: listado (`GET /api/profesionales`), alta (`POST /api/profesionales`) y edición/estado (`PATCH /api/profesionales/:id`).

2. **`HorariosPage.tsx` (`/profesional/horarios`)**
   - Carga inicial en paralelo: `GET /api/profesionales/:id/horarios`, `GET /api/bloqueos` y `GET /api/boxes`.
   - **Mis horarios semanales**: filas editables por día (Lunes a Domingo, con foco en Lun–Vie) con selectores `<select>` restringidos a múltiplos de 15 minutos (`07:00` a `21:45` en pasos de `:00`, `:15`, `:30`, `:45`), botón para agregar/quitar franja y guardado atómico vía `POST /api/profesionales/:id/horarios` (`{ horarios }`). Si el backend responde `409 FUERA_DE_GRILLA` o `400 FORMATO_INVALIDO`, se muestra `AlertaErrorNegocio`.
   - **Bloqueos de agenda**: formulario con selector de alcance **mutuamente excluyente (XOR)** entre "Mi agenda (profesional)" (`profesionalId: profesional.id`, sin `boxId`) y "Un box del consultorio" (`boxId`, sin `profesionalId`), calendario con **`Día desde`** y **`Día hasta`** (`<input type="date">`, con `Día hasta` inicializado en `Día desde`), checkbox **"Bloquear día completo"** (activo por defecto) y selectores horarios opcionales **`Hora desde`** / **`Hora hasta`** en pasos de 15 min (`:00`, `:15`, `:30`, `:45`) cuando se desmarca. Con día completo activo construye el intervalo semiabierto `inicio = ${diaDesde}T00:00:00-03:00` y `fin = ${diaSiguiente(diaHasta)}T00:00:00-03:00`; con horas específicas construye `inicio = ${diaDesde}T${horaDesde}:00-03:00` y `fin = ${diaHasta}T${horaHasta}:00-03:00`. 100 % compatible con el contrato existente de `POST /api/bloqueos` (`inicio < fin`, ISO-8601 con offset, cero cambios de backend). Baja vía `DELETE /api/bloqueos/:id` (`204 No Content`).

3. **`GananciasPage.tsx` (`/profesional/ganancias`)**
   - Encabezado con insignia de privacidad ("Información confidencial · Solo visible para vos"). **No existe ningún selector de otro profesional**.
   - Filtro de período (`desde`, `hasta`) más atajos rápidos ("Este mes", "Últimos 7 días", "Mes anterior").
   - Consulta en paralelo con `Promise.all`:
     - `GET /api/profesionales/:id/ganancias?desde=...&hasta=...` → `{ total }` (fuente de verdad del KPI total en ARS).
     - `GET /api/agenda?desde=...&hasta=...&profesionalId=<propio>` → filtra `estado === 'atendido'` para listar el detalle por turno con fecha, paciente, prestación, box y **`precioAlReservar` congelado** (`RN-GA-02`).
   - Si el período no tiene turnos atendidos, el KPI muestra `$ 0,00` y la tabla muestra `EstadoVacio`. Si el servidor responde `403 SIN_PERMISO`, se presenta `AlertaErrorNegocio`.

4. **`ClinicaPage.tsx` (`/profesional/clinica`)**
   - Selector de paciente alimentado por `GET /api/pacientes` (mostrando nombre, apellido, DNI y obra social informativa).
   - Al elegir paciente carga en paralelo `GET /api/pacientes/:id/historia` y `GET /api/pacientes/:id/odontograma`.
   - **Historia clínica append-only (`RN-CL-01`)**: lista cronológica de entradas con fecha, profesional autor, texto y etiqueta "Corrección de entrada anterior" cuando posee `corrigeAId`. **Nunca renderiza botones de editar ni borrar**. Permite agregar una evolución nueva o pulsar "Agregar corrección" sobre una entrada previa (precarga `corrigeAId` en el formulario y envía `POST /api/pacientes/:id/historia`).
   - **Odontograma SVG FDI (`RN-CL-02`)**: componente `OdontogramaFdi.tsx` + panel lateral de edición de pieza seleccionada + tabla cronológica del `historial` de cambios (pieza, cara/completa, estado, autor y fecha). Al guardar invoca `PUT /api/pacientes/:id/odontograma` y refresca en vivo `piezas` e `historial`.

5. **`AgendaAuditoriaPage.tsx` (`/profesional/agenda` y `/profesional/turnos/:id/auditoria`)**
   - Vista `/profesional/agenda`: filtros de rango (`desde`/`hasta`), profesional y box llamando a `GET /api/agenda`, tabla con horario, box, profesional, prestación, paciente, `BadgeEstadoTurno` y acción "Ver auditoría".
   - Al navegar a `/profesional/turnos/:id/auditoria` (o seleccionar un turno en el panel lateral), consulta `GET /api/turnos/:id/auditoria` y muestra la línea temporal append-only (`creado`, `estado_cambiado`, `reprogramado`, `cancelado`) con acción, actor, fecha y detalle de cambios antes/después, sin acciones de edición ni borrado (`RN-TU-05`).

### D4. Diseño geométrico y accesible del Odontograma SVG FDI (`odontogramaFdi.ts` + `OdontogramaFdi.tsx`)

1. **Estructura de arcadas y cuadrantes**:
   - Dentición permanente (32 piezas):
     - Arcada superior: Cuadrante 1 (`18, 17, 16, 15, 14, 13, 12, 11`) | línea media | Cuadrante 2 (`21, 22, 23, 24, 25, 26, 27, 28`).
     - Arcada inferior: Cuadrante 4 (`48, 47, 46, 45, 44, 43, 42, 41`) | línea media | Cuadrante 3 (`31, 32, 33, 34, 35, 36, 37, 38`).
   - Toggle accesible ("Mostrar dentición temporaria 51–85"): añade las arcadas temporarias alineadas a la línea media:
     - Superior temporaria: Cuadrante 5 (`55, 54, 53, 52, 51`) | línea media | Cuadrante 6 (`61, 62, 63, 64, 65`).
     - Inferior temporaria: Cuadrante 8 (`85, 84, 83, 82, 81`) | línea media | Cuadrante 7 (`71, 72, 73, 74, 75`).

2. **Glifo coronal SVG de 5 superficies (`viewBox="0 0 44 44"`)**:
   - Trapecio superior: `points="3,3 41,3 31,13 13,13"`
   - Trapecio inferior: `points="13,31 31,31 41,41 3,41"`
   - Trapecio izquierdo: `points="3,3 13,13 13,31 3,41"`
   - Trapecio derecho: `points="31,13 41,3 41,41 31,31"`
   - Cuadrado central (`oclusal`): `x="13" y="13" width="18" height="18"`

3. **Orientación anatómica espejada por cuadrante (`odontogramaFdi.ts`)**:
   - Cuadrantes 1 y 5 (sup. derecho del paciente): arriba = `vestibular`, abajo = `lingual`, izquierda = `distal`, derecha = `mesial`, centro = `oclusal`.
   - Cuadrantes 2 y 6 (sup. izquierdo del paciente): arriba = `vestibular`, abajo = `lingual`, izquierda = `mesial`, derecha = `distal`, centro = `oclusal`.
   - Cuadrantes 4 y 8 (inf. derecho del paciente): arriba = `lingual`, abajo = `vestibular`, izquierda = `distal`, derecha = `mesial`, centro = `oclusal`.
   - Cuadrantes 3 y 7 (inf. izquierdo del paciente): arriba = `lingual`, abajo = `vestibular`, izquierda = `mesial`, derecha = `distal`, centro = `oclusal`.

4. **Overlays de estados exclusivos de pieza completa y codificación dual (WCAG 1.4.1)**:
   - `sano`: blanco porcelana (`#FFFFFF`) con contorno pizarra suave (`#94A3B8`).
   - `caries`: rojo clínico (`#DC2626`) con trama diagonal SVG (`<pattern id="pat-caries">`) y contorno oscuro.
   - `obturado`: azul clínico (`#1D4ED8`) con relleno sólido y punto/trama sutil de contraste.
   - `ausente` *(solo pieza completa)*: fondo atenuado `#F1F5F9` + cruz diagonal (`X`) en gris pizarra `#64748B`.
   - `a_extraer` *(solo pieza completa)*: tinte `#FEF2F2` + cruz diagonal gruesa (`X`, `stroke-width="3.2"`) en `#B91C1C`.
   - `corona` *(solo pieza completa)*: aro/doble contorno perimetral en teal/ámbar clínico (`#0E7490` exterior + `#B45309` interior punteado/doble) rodeando la corona.
   - `endodoncia` *(solo pieza completa)*: símbolo radicular vertical (triángulo/conducto en `#4338CA` sobre el eje central).
   - Al elegir `ausente`, `corona`, `endodoncia` o `a_extraer` en el panel de edición, el selector de `cara` se deshabilita automáticamente (`disabled={true}`), se limpia cualquier cara seleccionada y se muestra la leyenda explicativa "Este estado aplica a la pieza completa" (reflejando la regla de `C-09`).

5. **Layout responsive fluido con cero scroll horizontal (`1440×900` y `390×844`)**:
   - Sin `overflow-x: auto` ni anchos mínimos fijos en el odontograma, las tablas o el menú de ninguna vista profesional.
   - Desktop (`> 900px`): dos mitades por arcada (`grid-template-columns: minmax(0, 1fr) 2px minmax(0, 1fr)`), cada cuadrante con `repeat(8, minmax(0, 1fr))` (permanente) o `repeat(5, minmax(0, 1fr))` (temporario), SVG fluidos (`width: 100%; height: auto; aspect-ratio: 1`) y separación compacta (`2px–4px`) para que las 16 piezas entren al 100 % del ancho sin scroll horizontal.
   - Mobile (`≤ 900px` / `390×844`): apila Cuadrante 1 (`18–11`) sobre Cuadrante 2 (`21–28`) y Cuadrante 4 (`48–41`) sobre Cuadrante 3 (`31–38`), cada cuadrante `repeat(8, minmax(0, 1fr))` al 100 % del ancho; las tablas se apilan en tarjetas-fila desde `≤ 768px`.

6. **Accesibilidad teclado y lectores de pantalla**:
   - Cada pieza y sus 5 caras interactivas tienen `role="button"`, `aria-label` descriptivo (ej. `"Pieza 16 (Primer molar superior derecho), cara oclusal — Caries"`), `aria-pressed` y foco visible (`--focus-ring`).
   - Navegación por teclado con `Tab` / flechas (roving focus por arcada) y activación con `Enter` / `Space`.
   - Región `aria-live="polite"` que anuncia la pieza/cara seleccionada y el resultado del guardado.

## Risks / Trade-offs

- [Menú base en `web/src/base/menu.ts` mantiene `proximamente: true` hasta `chore(shared)` de EP] → Mitigado pasando `itemsExtra={MENU_PROFESIONAL}` desde todas las pantallas de `C-15`; una vez que EP actualice `menu.ts`, la navegación desde `/inicio` apuntará directamente a `/profesional/*` sin cambios en `C-15`.
- [Odontograma de 16 piezas por arcada y tablas en `1440×900` y `390×844`] → Mitigado en `profesional.css` y los 4 mockups eliminando todo `overflow-x: auto` y anchos mínimos fijos: grillas CSS fluidas con SVG escalables (`aspect-ratio: 1`), apilado por cuadrante en `≤ 900px` y tablas convertidas a tarjetas-fila en `≤ 768px`, garantizando cero scroll horizontal.
- [Consistencia de precios en Ganancias] → El KPI total siempre proviene de `GET /api/profesionales/:id/ganancias` (autoridad backend `C-08`), mientras que la tabla usa `GET /api/agenda?profesionalId=<propio>` filtrado por `estado === 'atendido'` mostrando `precioAlReservar`.

## UI Mockups

- Design system revision: 2 (`design-system/tokens.css`, `design-system/brand.js`, `design-system/assets/logo.svg`)
- Decision: yes (4 mockups HTML responsive 390×844 y 1440×900: `prestaciones.html`, `horarios.html`, `ganancias.html`, `odontograma.html` en `openspec/changes/web-profesional/mockups/`)
- Approval: pending (EP)
- Date: 2026-11-23

> Nota de gobernanza visual: este diseño y los 4 mockups HTML se encuentran **propuestos, pendientes de aprobación de EP antes de iniciar `apply`**.

## Open Questions

Ninguna pendiente para la fase de diseño; el único gate previo a `apply` es la aprobación explícita de EP sobre los 4 mockups HTML.
