# Explore — `C-15 web-profesional`

> Fecha: 2026-11-23 · Responsable: Facundo (`dev-facundo`) · Capability: `web-profesional` · Governance: **BAJO** · Política visual: `system-and-mockups`.

## 1. Estado del repositorio y dependencias verificadas

Se inspeccionaron `CHANGES.md`, `design-system/` (rev. 2 aprobada por EP el 2026-11-23), `web/src/base/` (`C-12 web-base` archivado) y los módulos backend ya disponibles:

| Dependencia | Estado en codebase | Contratos que consume `C-15` |
|---|---|---|
| `C-12 web-base` | Disponible (`web/src/base/`) | `AppLayout`, `obtenerMenuPorRol`, `Boton`, `Campo`, `AlertaErrorNegocio`, `BadgeEstadoTurno`, `AvatarIniciales`, `Tabla`, `EstadoVacio`, `Skeleton*`, `Icono`, `useSesion`, `apiConsultorio`, `ErrorApi`, `describirCodigoNegocio`, tokens de `design-system/tokens.css` |
| `C-03 configuracion-consultorio` | Disponible (`src/modules/configuracion/`) | `GET/POST/PATCH` sobre `/api/profesionales`, `/api/boxes`, `/api/prestaciones` (`409 DURACION_INVALIDA`); `GET/POST /api/profesionales/:id/horarios` (`409 FUERA_DE_GRILLA`); `GET/POST /api/bloqueos` (XOR `profesionalId`/`boxId`); `DELETE /api/bloqueos/:id` (`204`) |
| `C-04 cuentas-y-pacientes` | Disponible (`src/modules/cuentas/`) | `GET /api/pacientes` (selector de paciente en ficha clínica) y sesión JWT con `UsuarioPublico { id, email, rol, activo }` |
| `C-07 agenda-y-auditoria` | Disponible (`src/modules/agenda/`) | `GET /api/agenda?desde&hasta&profesionalId&boxId` y `GET /api/turnos/:id/auditoria` (append-only, solo `profesional`) |
| `C-08 ganancias-profesional` | Disponible (`src/modules/ganancias/`) | `GET /api/profesionales/:id/ganancias?desde&hasta` (`{ total }`, `403 SIN_PERMISO` si consulta otro profesional o rol) |
| `C-09 historia-clinica-y-odontograma` | Disponible (`src/modules/clinica/`) | `GET/POST /api/pacientes/:id/historia` (append-only + `corrigeAId`); `GET/PUT /api/pacientes/:id/odontograma` (`VistaOdontograma { odontogramaId, pacienteId, actualizadoEn, piezas, historial }`, FDI 11–48 y 51–85, 5 caras y 4 estados exclusivos de pieza completa) |

## 2. Decisiones confirmadas durante Explore

1. **D1 — Resolución del profesional logueado (`useProfesionalActual`)**: `UsuarioPublico` retornado por `/api/public/login` contiene `{ id, email, rol, activo }` sin `profesionalId`. El módulo profesional resolverá `profesionalId` llamando a `GET /api/profesionales` y buscando `profesional.usuarioId === sesion.usuario.id`. Con ese `id` se invocan `/horarios`, `/bloqueos` propios y `/ganancias` sin exponer jamás un selector de terceros en Ganancias (`RN-RO-02`).
2. **D2 — Terminología estricta `box` y datos 100 % ficticios (`RN-DA-01`)**: toda la interfaz, etiquetas, tablas, mockups y fixtures utilizan el término `box` (nunca "sillón") y únicamente nombres/correos ficticios (`Dra. Ana Pérez`, `Dr. Bruno Gómez`, `Paciente Ficticio Uno`, `Paciente Ficticio Dos`, dominios `@example.com`).
3. **D3 — Navegación sin tocar archivos fuera de scope (`MENU_PROFESIONAL`)**: `web/src/base/menu.ts` marca inicialmente las rutas `/profesional/*` con `proximamente: true`. Para respetar el aislamiento estricto de `C-15` (solo `web/src/pages/profesional/`), `AppLayout` recibirá `itemsExtra={MENU_PROFESIONAL}` desde las páginas del área para activar las 5 rutas reales de inmediato; EP removerá `proximamente: true` en `web/src/base/menu.ts` en su commit `chore(shared)`.
4. **D4 — Odontograma clínico SVG FDI anatómico realista de 5 caras**: cada pieza se renderiza como un glifo coronal SVG de 5 zonas (4 trapecios periféricos + 1 cuadrado central oclusal) organizado en 4 cuadrantes (`18–11 | 21–28` superior, `48–41 | 31–38` inferior) con línea media anatómica, toggle de dentición temporaria (`55–51 | 61–65` y `85–81 | 71–75`), mapeo anatómico espejado de `mesial`/`distal` y `vestibular`/`lingual` por cuadrante, overlays SVG diferenciados para estados de pieza completa (`ausente`, `a_extraer`, `corona`, `endodoncia`), deshabilitación automática del selector `cara` para dichos estados (alineado con `esEstadoSoloPiezaCompleta` de `C-09`), y soporte completo de accesibilidad teclado/ARIA + patrones visuales WCAG.

## 3. Skills recomendadas por `find-skill` e instaladas globalmente

Instaladas globalmente en `~\.gemini\config\skills\` y `~\.agents\skills\` (sin modificar `.atl/skill-registry.md` ni archivos trackeados del repo):

- `frontend-design` (`anthropics/skills`) — jerarquía tipográfica, composición editorial clínica y ausencia de estética genérica.
- `web-design-guidelines` (`vercel-labs/agent-skills`) — legibilidad, `tabular-nums`, feedback de estado y consistencia de formularios/tablas.
- `accessibility` (`addyosmani/web-quality-skills`) — WCAG 2.2 AA, contraste ≥ 4.5:1, navegación por teclado, roles ARIA y significado no dependiente solo del color.
- `ui-ux-pro-max` (`nextlevelbuilder/ui-ux-pro-max-skill`) — densidad clínica equilibrada, responsive 390×844 / 1440×900 y claridad operativa.

## 4. Diseño del Odontograma SVG FDI (síntesis)

- **Geometría**: `viewBox="0 0 44 44"` con 4 trapecios periféricos (arriba, abajo, izquierda, derecha) + cuadrado central (`oclusal`) y número FDI arriba (arcada superior) o abajo (arcada inferior).
- **Espejado anatómico**: `mesial` siempre apunta a la línea media vertical; `vestibular` siempre apunta hacia afuera de la arcada (arriba en maxilar superior, abajo en mandíbula inferior).
- **Codificación dual (WCAG 1.4.1)**: además del color, cada estado tiene forma/trama/símbolo propio (`caries` trama diagonal + rojo, `obturado` relleno sólido azul + borde, `ausente` X gris atenuada, `a_extraer` X gruesa roja, `corona` doble contorno/aro, `endodoncia` símbolo radicular vertical).
- **Interacción**: clic o teclado (`Enter`/`Space`/flechas) sobre pieza o cara abre su estado en el panel lateral de edición y permite guardar vía `PUT /api/pacientes/:id/odontograma`, actualizando en vivo el mapa de `piezas` y el `historial` append-only.
