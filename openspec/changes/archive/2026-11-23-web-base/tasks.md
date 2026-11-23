# Tasks

> TDD en `web/src/base/base.test.tsx`. Sin editar archivos congelados tras `C-01` (`package.json`, lockfile, `web/src/main.tsx`, `src/app.ts`, `src/shared/`).

## 1. Design system rev. 2 y mockups HTML

- [x] 1.1 Rediseñar `design-system/` (`tokens.css`, `assets/logo.svg`, `brand.md`, `brand.js`, `README.md`, `components.html`) con paleta clínica accesible de Clínica Dental Alvear y soporte `prefers-reduced-motion`
- [x] 1.2 Crear mockups HTML en `openspec/changes/web-base/mockups/` (`login.html`, `registro.html`, `layout-roles.html`)

## 2. Cliente HTTP, errores de negocio y sesión reactiva

- [x] 2.1 Implementar `web/src/base/errores.ts` y `web/src/base/api.ts` (`crearClienteHttp`, `ErrorApi`, `loginApi`, `registrarPacienteApi` contra `C-04`) con tests TDD de Bearer token, `409` legible y `401`
- [x] 2.2 Implementar `web/src/base/sesion.tsx` con `useSyncExternalStore` + `sessionStorage` versionado para compartir sesión sin modificar `web/src/main.tsx`

## 3. Componentes compartidos, íconos y estilos 60 fps

- [x] 3.1 Implementar `web/src/base/iconos.tsx`, `web/src/base/components.tsx` (`Boton`, `Campo`, `AlertaErrorNegocio`, `BadgeEstadoTurno`, `AvatarIniciales`, `Tabla`, `EstadoVacio`, `Skeleton`/`SkeletonTabla`/`SkeletonTarjetas`) y `web/src/base/styles.css` con micro-interacciones 60 fps y `prefers-reduced-motion`

## 4. Layout por rol, Login, Registro e Inicio diferenciado

- [x] 4.1 Implementar `web/src/base/menu.ts` y `web/src/base/AppLayout.tsx` con indicador activo deslizante en el sidebar, íconos, perfil con avatar y menú filtrado por rol
- [x] 4.2 Implementar `web/src/base/clinica.ts`, `LoginPage.tsx`, `RegistroPage.tsx`, `InicioPage.tsx` (diferenciado para Profesional, Recepción y Paciente, con bloque calendario y acciones rápidas en vivo) y `web/src/pages/auth/routes.tsx`

## 5. Verificación integral y cierre en `dev-lucas`

- [x] 5.1 Verificar `npm run typecheck`, `npm run lint`, `npm test` (API + `web`) y `npm run build -w web` en verde
- [x] 5.2 Validar y archivar `web-base` con `openspec archive web-base`, agregar la fila de `C-12` al final de `evidencias/bitacora-decisiones.md`, sincronizar Engram y pushear `dev-lucas`
