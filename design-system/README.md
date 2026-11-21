# Design system — turnos-odontologia

Mode: system-and-mockups
Revision: 1
Approval: pending

## Política visual

- **Decisión**: hay un design system del proyecto y **cada cambio visual presenta un mockup HTML que se aprueba antes de implementar**.
- **Fuente**: pedido de EP en la revisión de la etapa 3 (2026-11-21): "Quiero que visual design esté activada. Necesitamos esos mockups". Reemplaza la política `off` del plan de fundación original. Ver DD-09 en `knowledge-base/09_decisiones_y_supuestos.md`.
- **Mockups**: viven en `openspec/changes/<change>/mockups/`, importan `tokens.css` y `brand.js` de esta carpeta y se aprueban antes de `apply`.

## Archivos

| Archivo | Para qué |
|---|---|
| `tokens.css` | Única fuente de valores visuales: color, tipografía, espaciado, radios, sombras, foco, movimiento (respeta `prefers-reduced-motion`) |
| `brand.md` | Nombre, logo, tono, idioma y reglas de uso |
| `brand.js` | Constante con el nombre visible y su binding a `[data-brand-name]` |
| `components.html` | Referencia de componentes: agenda por box, formulario de nuevo turno, mensajes de solapamiento, estados del turno, tarjeta del paciente, ganancias, tabla, estado vacío |
| `assets/logo.svg` | Logo **provisional** (dice "LOGO PROVISIONAL") |
| `previews/` | Capturas a 390×844 (celular) y 1440×900 (escritorio) |

## Decisiones abiertas (TBD)

| Tema | Estado | Cómo reemplazarlo |
|---|---|---|
| Nombre del producto | Provisional: "Agenda Odonto" | Cambiar `BRAND_NAME` en `brand.js` y poner `BRAND_PROVISIONAL = false`. Las previews y mockups se actualizan solos |
| Logo | Provisional | Reemplazar `assets/logo.svg` con el mismo nombre de archivo (alto de referencia: 40 px) |
| Colores de marca | Propuestos (verde azulado + ámbar) | Editar las variables `--color-primary*` y `--color-accent` en `tokens.css`, subir `Revision:` y volver a pedir aprobación |
| Modo oscuro | No incluido en la revisión 1 | Agregar un bloque `@media (prefers-color-scheme: dark)` en `tokens.css` en una revisión posterior |

## Previews

Preview: rendered (2026-11-21). Se renderizó `components.html` servido en localhost, en el navegador integrado de Claude, a **390×844** y **1440×900**; las capturas inspeccionadas están en `previews/`. Las de escritorio quedaron guardadas reducidas a 800×500 por el tamaño del panel. Playwright no pudo usarse porque no hay Chrome instalado.

| Captura | Qué muestra |
|---|---|
| `mobile-390x844-1-inicio.jpg` | Encabezado, nombre provisional y paleta |
| `mobile-390x844-2-agenda.jpg` | Agenda por box con el turno contiguo válido, cancelado y bloqueo |
| `mobile-390x844-3-paciente.jpg` | Tarjeta del turno del paciente (Google Calendar) y ganancias |
| `desktop-1440x900-1-agenda.jpg` | Agenda en escritorio |
| `desktop-1440x900-2-turno.jpg` | Formulario de nuevo turno, errores de solapamiento y botones |
| `desktop-1440x900-3-paciente.jpg` | Vista del paciente, ganancias, tabla y estado vacío |

Correcciones hechas al inspeccionar: el encabezado en celular (el nombre se partía en dos líneas), la columna del Box 2 cortada a 390 px, el texto de los turnos truncado con recorte prolijo, la nota "Contiguo: válido" visible, el badge estirado y el subrayado en los botones-enlace.

Para servirlo de nuevo: `python -m http.server 8765 --directory design-system` (configurado en `.claude/launch.json`).

## Cómo abrir la referencia

Abrí `design-system/components.html` en el navegador (doble clic). No necesita servidor ni conexión a internet.

## Reglas de revisión

- Cualquier cambio en `tokens.css` o en `assets/` sube `Revision:`, vuelve `Approval:` a `pending` y obliga a volver a revisar los mockups afectados.
- Un mockup aprobado no se cambia en silencio.
