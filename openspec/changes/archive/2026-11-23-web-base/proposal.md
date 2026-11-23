# Proposal

## Why

La aplicación web (`web/`) quedó inicializada en `C-01` únicamente con Vite, React y el cargador de rutas sin pantallas ni componentes compartidos. Para desbloquear las tres áreas funcionales de interfaz (`C-13 web-recepcion`, `C-14 web-paciente` y `C-15 web-profesional`), `C-12` establece el sistema de diseño renovado (`design-system/` rev. 2, con OK de EP para reemplazar la prueba inicial), los componentes compartidos, el cliente HTTP autenticado contra `C-04`, las pantallas de acceso/registro y el layout responsive con menú e inicio diferenciados por rol.

## What Changes

- **Rediseño de `design-system/` (rev. 2 — Clínica Dental Alvear):** paleta clínica accesible (`#0E7490` teal profundo, `#059669` esmeralda salud, `#F4F8F9` porcelana, `#0F2937` pizarra), `tokens.css`, emblema SVG (`assets/logo.svg`), `brand.md`, `brand.js`, `components.html` y mockups HTML en `openspec/changes/web-base/mockups/`.
- **Cliente HTTP y manejo de errores (`web/src/base/api.ts`, `errores.ts`):** adjunta `Authorization: Bearer <token>`, traduce los códigos de negocio de `RN-EX-01` + `DUPLICADO` (`409`) y errores de formato/acceso (`400/401/403/404/500`) a mensajes legibles en español rioplatense, e invoca limpieza de sesión ante `401`.
- **Sesión compartida sin tocar `web/src/main.tsx` (`web/src/base/sesion.tsx`):** store reactivo con `useSyncExternalStore` + `sessionStorage` versionado utilizable por todas las áreas (`C-12` a `C-15`).
- **Componentes compartidos y micro-interacciones 60 fps (`web/src/base/components.tsx`, `iconos.tsx`, `styles.css`):** `Boton` (con feedback táctil y spinner), `Campo` (validación inline y ARIA), `AlertaErrorNegocio`, `BadgeEstadoTurno` (pulso sutil en turnos activos), `AvatarIniciales`, `Tabla` (entrada escalonada por fila y hover refinado), `EstadoVacio`, `Skeleton`/`SkeletonTabla`/`SkeletonTarjetas` e íconos SVG finos sin agregar dependencias externas. Respeto completo a `prefers-reduced-motion`.
- **Layout, navegación e inicio diferenciados por rol (`AppLayout.tsx`, `menu.ts`, `LoginPage.tsx`, `RegistroPage.tsx`, `InicioPage.tsx`, `web/src/pages/auth/routes.tsx`):**
  - Login contra `POST /api/public/login` y Registro de paciente contra `POST /api/public/pacientes/registro` (`C-04`), con validación de contraseña (`>= 8` caracteres y `<= 72` bytes UTF-8) y aviso de vinculación por DNI + email (`PA-10`).
  - Menú lateral con indicador activo deslizante y transiciones de vista que cambia según rol (`profesional`, `recepcionista` sin precios/ganancias, `paciente`).
  - Inicio diferenciado por rol: métricas del día + agenda con acciones rápidas en vivo (`Profesional`), estado de boxes + pendientes + `+ Nuevo turno` (`Recepcionista`, sin precios) y tarjeta protagonista `Tu próximo turno` con bloque calendario `NOV / 23` + info de la clínica (`Paciente`, nunca turnos ajenos).

## Capabilities

### New Capabilities
- `web-base`: sistema visual base de la aplicación web, cliente HTTP autenticado con traducción de códigos `409`, gestión de sesión por navegador, componentes compartidos accesibles, pantallas de login/registro contra `C-04`, y layout + panel inicial diferenciados por rol.

### Modified Capabilities
<!-- Ninguna: no se modifican specs de capacidades backend ni plataforma. -->

## Impact

- **Código nuevo / modificado:** `design-system/`, `web/src/base/`, `web/src/pages/auth/routes.tsx` y `openspec/changes/web-base/`.
- **Archivos congelados respetados (Regla Dura 3):** no se edita `package.json`, `web/package.json`, `package-lock.json`, `web/src/main.tsx`, `web/index.html`, `src/app.ts` ni `src/shared/`.
- **Equipo:** provee los componentes, sesión, cliente HTTP y layout base que consumirán `C-13` (Lautaro), `C-14` (Lucas) y `C-15` (Facundo).
- **Governance:** **MEDIO** (maneja sesión en el navegador y UI base).
