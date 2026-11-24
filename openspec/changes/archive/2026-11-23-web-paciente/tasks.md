# Tasks — `C-14 web-paciente`

## 1. Mockups HTML responsive (`openspec/changes/web-paciente/mockups/`)

- [x] 1.1 Crear `openspec/changes/web-paciente/mockups/disponibilidad.html` (elegir prestación, fecha, huecos Mañana/Tarde y estado de conflicto `409` ofreciendo otro horario; 390×844 y 1440×900, tokens rev. 2, datos 100 % ficticios).
- [x] 1.2 Crear `openspec/changes/web-paciente/mockups/confirmacion.html` (resumen del turno confirmado con bloque de fecha, dirección de Clínica Dental Alvear, botón **Agregar a Google Calendar** y **Descargar .ics**, sin precios).
- [x] 1.3 Crear `openspec/changes/web-paciente/mockups/mis-turnos.html` (lista de próximos turnos e historial, aviso de 24 h, acciones habilitadas y un turno dentro de las 24 h con botones deshabilitados por plazo vencido).
- [x] 1.4 Crear `openspec/changes/web-paciente/mockups/README.md` con las rutas y guía de verificación en 390×844 y 1440×900.

## 2. Dominio puro, API y estructura base del área (`web/src/pages/paciente/`)

- [x] 2.1 Escribir primero tests unitarios en `web/src/pages/paciente/dominio.test.ts` (TDD): ventana exacta de 24 h / `< 24 h` / `> 24 h`, rangos diarios en `-03:00`, agrupación Mañana/Tarde, armado de enlace Google Calendar sin precios y resolución de nombres sin UUIDs.
- [x] 2.2 Implementar `web/src/pages/paciente/dominio.ts` hasta dejar `dominio.test.ts` en verde (sin `Date.now()` ni `new Date()` sin argumentos en funciones puras).
- [x] 2.3 Implementar `web/src/pages/paciente/apiPaciente.ts` (wrapper tipado sobre `apiConsultorio` para prestaciones públicas, disponibilidad, reserva, listado, cancelar, reprogramar, datos del paciente + descarga `.ics` autenticada vía `fetch` + `Blob`).
- [x] 2.4 Implementar `web/src/pages/paciente/menuPaciente.ts`, `GuardiaPaciente.tsx`, `paciente.css` y `routes.tsx`.

## 3. Pantallas y componentes con TDD (`web/src/pages/paciente/`)

- [x] 3.1 Escribir los tests de componentes en `web/src/pages/paciente/paciente.test.tsx` cubriendo todos los escenarios del spec (guardia RBAC, reserva feliz + Google Calendar + `.ics`, hueco ocupado `409` ofreciendo otro, día sin huecos, "Mis turnos" con `> 24 h` / `=== 24 h` / `< 24 h` / `409 PLAZO_VENCIDO`, cancelar, reprogramar feliz y con `409`, "Mis datos" y verificación estricta sin precios).
- [x] 3.2 Implementar `web/src/pages/paciente/SelectorHuecosPaciente.tsx`.
- [x] 3.3 Implementar `web/src/pages/paciente/ReservarPage.tsx` (flujo de selección + confirmación con Google Calendar y `.ics` + recuperación ante `409`).
- [x] 3.4 Implementar `web/src/pages/paciente/MisTurnosPage.tsx` (próximos turnos + historial, aviso 24 h, cancelar con confirmación, deshabilitación por `< 24 h` y `PLAZO_VENCIDO`, Google Calendar y `.ics`).
- [x] 3.5 Implementar `web/src/pages/paciente/ReprogramarTurnoPage.tsx` (horario actual tachado → nuevo hueco, `409` y `PLAZO_VENCIDO`).
- [x] 3.6 Implementar `web/src/pages/paciente/MisDatosPage.tsx` (consulta y edición de campos permitidos, DNI y correo en solo lectura).

## 4. Verificación, archivo y entrega

- [x] 4.1 Ejecutar `openspec validate web-paciente` y confirmar que todas las validaciones pasan.
- [x] 4.2 Ejecutar `npm run typecheck`, `npm run lint`, `npm test` (backend + web) y `npm run build -w web` en verde.
- [x] 4.3 Archivar el change con `openspec archive web-paciente -y` y agregar la fila de `C-14` al final de `evidencias/bitacora-decisiones.md`.
- [x] 4.4 Correr `engram sync`, commitear y pushear en `dev-lucas` (sin tocar `main`) y entregar el PR listo para revisión de EP (`@Pinini777`).
