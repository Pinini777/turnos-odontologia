# Design

## Context

`C-01` congeló `package.json`, `web/package.json`, `package-lock.json`, `web/index.html` y `web/src/main.tsx` (que importa `../../design-system/tokens.css` y carga automáticamente todas las rutas declaradas en `./pages/*/routes.tsx`). `C-04` (`cuentas-y-pacientes`) ya está mergeado en `main` con `POST /api/public/login` y `POST /api/public/pacientes/registro` (JWT HS256 de 2 h, contraseñas entre 8 caracteres y 72 bytes UTF-8, vinculación por documento + email).

EP autorizó reemplazar el `design-system/` inicial (que era una prueba) para presentar una interfaz clínica limpia y realista (**Clínica Dental Alvear**, datos de fantasía sin datos reales de pacientes por `RN-DA-01`).

## Goals / Non-Goals

**Goals:**
- Conectar Login y Registro de paciente directamente a `C-04` (`/api/public/login` y `/api/public/pacientes/registro`).
- Proveer `crearClienteHttp` + `apiConsultorio` con envío automático de `Authorization: Bearer <token>`, limpieza ante `401` y traducción legible de todos los códigos `409` (`RN-EX-01` + `DUPLICADO`).
- Compartir la sesión reactivamente entre áreas (`C-12` a `C-15`) sin modificar `web/src/main.tsx`.
- Proveer componentes reutilizables accesibles (WCAG AA) y micro-interacciones fluidas a 60 fps (`transform`/`opacity`, `prefers-reduced-motion`) sin agregar dependencias nuevas al `package.json` congelado.
- Diferenciar el menú y el panel inicial según el rol (`profesional`, `recepcionista` sin precios/ganancias, `paciente` sin turnos de terceros).

**Non-Goals:**
- Pantallas operativas completas de agenda/alta de recepción (`C-13`), reserva online/descarga `.ics` de paciente (`C-14`) y catálogo/ganancias/historia clínica del profesional (`C-15`).
- Agregar librerías externas (`motion`, `lucide-react`) porque `package.json` y el lockfile están congelados tras `C-01` (Regla Dura 3).

## Decisions

### D1. Sesión compartida sin editar `web/src/main.tsx`
`web/src/main.tsx` monta `RouterProvider` directamente y está congelado. Para que las rutas de `auth`, `recepcion`, `paciente` y `profesional` compartan estado de sesión reactivo sin envolver `main.tsx` en un `<Context.Provider>`, `web/src/base/sesion.tsx` implementa un store externo con `useSyncExternalStore` respaldado por `sessionStorage` bajo la clave versionada `'turnos-odonto:sesion:v1'`.

### D2. Montaje de rutas de autenticación vía `web/src/pages/auth/routes.tsx`
`web/src/main.tsx` hace `import.meta.glob('./pages/*/routes.tsx', { eager: true })`. Para registrar `/`, `/login`, `/registro` e `/inicio` sin editar `main.tsx` ni pisar las carpetas de `C-13` (`recepcion`), `C-14` (`paciente`) ni `C-15` (`profesional`), `C-12` aporta `web/src/pages/auth/routes.tsx`.

### D3. Micro-interacciones 60 fps e íconos finos sin dependencias nuevas
Respetando la Regla Dura 3 (`package.json` congelado):
- Los íconos de línea fina (`stroke 1.75`, estilo Lucide) viven en `web/src/base/iconos.tsx` como SVGs puros con `aria-hidden="true"`.
- El indicador activo deslizante del sidebar mide el enlace activo con `useLayoutEffect` + `ResizeObserver` y se traslada con `transform: translate3d(x, y, 0)` y curva spring `cubic-bezier(0.34, 1.25, 0.64, 1)` (260 ms), con fallback CSS en entornos sin layout (SSR/jsdom).
- Las entradas escalonadas (`stagger`) en tarjetas, filas de tabla y preview de login, el degradado ambiental del login, el pulso en badges activos (`reservado`/`confirmado`) y el shimmer de los skeletons animan exclusivamente `transform` y `opacity` y se desactivan bajo `@media (prefers-reduced-motion: reduce)`.

### D4. Privacidad y separación estricta por rol en el panel de inicio (`RN-RO-01`, `RN-RE-03`)
- `profesional`: métricas del día, agenda del profesional y acciones rápidas (`Confirmar`, `Marcar atendido`) siguiendo `RN-TU-01`.
- `recepcionista`: estado de boxes, pendientes de confirmar, botón `+ Nuevo turno` y agenda del día, **sin precios ni ganancias** en el menú ni en la vista.
- `paciente`: tarjeta protagonista `Tu próximo turno` con bloque calendario (`NOV / 23`), acciones `Reprogramar turno` / `Cancelar turno` (aviso de 24 h) e `Información de la clínica`. **Nunca** renderiza turnos de otros pacientes.

### D5. Identidad visual realista y libre de jerga técnica
`web/src/base/clinica.ts` centraliza la identidad ficticia (**Clínica Dental Alvear**, `Av. Alvear 1420, Ciudad de Mendoza`, `Lunes a viernes · 08:30 a 19:30`, 4 especialidades y obras sociales informativas). Toda la UI evita jerga técnica (IDs de change, endpoints, nombres "Paciente Ficticio") manteniendo emails `@example.com` y DNI ficticios (`RN-DA-01`).

## Risks / Trade-offs

- [`web/src/pages/auth/routes.tsx` fuera de `web/src/base/`] → Es necesario para que el autoload de `web/src/main.tsx` monte `/login`, `/registro` y `/inicio` sin editar el archivo congelado; no colisiona con `recepcion/`, `paciente/` ni `profesional/`. Se deja explícito para revisión de EP.
- [Animaciones e íconos propios en vez de `motion` / `lucide-react`] → Evita modificar `package.json`/`package-lock.json` congelados y mantiene el bundle liviano; si EP luego incorpora esas dependencias en `chore(shared)`, el reemplazo es directo.

## Migration Plan

Sin migración de datos. El frontend consume la API local vía el proxy `/api` → `http://localhost:3000` ya definido en `web/vite.config.ts`.

## UI Mockups

- Design system revision: 2 (`design-system/tokens.css`, `design-system/components.html`)
- Decision: yes (UI)
- Approval: approved (2026-11-23, by EP)
- Preview: manual (2026-11-23, revisión visual con EP)
- Mockups: `openspec/changes/archive/2026-11-23-web-base/mockups/` (`login.html`, `registro.html`, `layout-roles.html`)
- Date: 2026-11-23

## Open Questions

Ninguna.
