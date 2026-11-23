# Tasks

> TDD: en cada tarea primero el test en rojo, después el código mínimo para ponerlo en verde. Vitest + Testing Library con `fetch` simulado, sin red. Solo se escribe en `web/src/pages/recepcion/` y en este change; `web/src/base/`, `main.tsx`, `package.json` y el backend no se tocan. Todos los datos de prueba son ficticios.
>
> **Gate:** no se empieza el grupo 1 hasta que EP apruebe los mockups (`mockups/README.md`) y quede `Approval: approved` en `design.md` y en el README. Los mockups aprobados y sus capturas en `mockups/previews/` son criterio de aceptación de cada pantalla.

## 0. Aprobación de los mockups

- [ ] 0.1 Mostrarle a EP los tres mockups y sus capturas (`mockups/previews/`), y registrar su aprobación como `Approval: approved (<fecha>, by EP)` en `design.md` y en `mockups/README.md`. Verificar que ambos archivos dicen `approved`.

## 1. Dominio y cliente de la API

- [ ] 1.1 Escribir `web/src/pages/recepcion/dominio.test.ts`: `accionesPara` devuelve las acciones de la tabla del spec para los cinco estados; `rangoDia` y `rangoSemana` (lunes a domingo) arman ISO con `-03:00`; `agruparPorDia` agrupa y ordena por hora; `filtrarPacientes` busca por nombre, apellido o documento sin distinguir mayúsculas ni tildes. Verificar que falla y después implementar `dominio.ts` hasta que pase.
- [ ] 1.2 Escribir `api.test.ts` con `fetch` simulado: cada función llama a la ruta y el método correctos (`/api/agenda` con `desde`, `hasta` y filtros; `/api/recepcion/disponibilidad`; `POST /api/recepcion/turnos` con `pacienteId` o `paciente` y sin `boxId` cuando es automático; cancelar, estado, reprogramar; pacientes y catálogos) y propaga `ErrorApi`. Implementar `api.ts` sobre `apiConsultorio` y verificar que pasa.

## 2. Área y menú

- [ ] 2.1 Escribir el test de `SoloRecepcion` y del menú: con sesión de recepcionista, "Agenda del día" apunta a `/recepcion/agenda` y "Pacientes" a `/recepcion/pacientes` (no a la vista previa); con sesión de paciente, `/recepcion/agenda` muestra el aviso de acceso no permitido y no llama a la API; sin sesión, redirige a `/login`. Implementar `menu.ts`, `SoloRecepcion.tsx` y `routes.tsx`, y verificar que pasa.

## 3. Agenda

- [ ] 3.1 Escribir `AgendaPage.test.tsx`: vista del día con dos turnos ordenados y sus datos; cambio a semana pide lunes a domingo y agrupa por día; día vacío muestra el estado vacío con "Nuevo turno"; el filtro por box pide la agenda con `boxId`. Implementar `AgendaPage.tsx` según `mockups/agenda.html` y verificar que pasa.
- [ ] 3.2 Agregar el test de turnos contiguos: 10:00–10:30 y 10:30–11:00 en el Box 1 se muestran sin ninguna marca de conflicto. Verificar que pasa.
- [ ] 3.3 Agregar los tests de acciones: un `reservado` ofrece Confirmar, Reprogramar y Cancelar (no Atendido ni Ausente); un `cancelado` no tiene acciones; confirmar llama a `POST /api/turnos/:id/estado` y vuelve a pedir la agenda; cancelar pide confirmación, "Volver" no llama a la API y confirmar llama a `/cancelar`; un `409 TRANSICION_INVALIDA` muestra su mensaje legible. Implementar y verificar que pasan.

## 4. Nuevo turno y reprogramar

- [ ] 4.1 Escribir `SelectorHuecos.test.tsx`: pide la disponibilidad del día elegido, agrupa en mañana y tarde, marca el hueco elegido, ofrece "Automático" más los boxes libres de ese hueco, y muestra "no hay huecos libres" con la opción de otro día. Implementar y verificar que pasa.
- [ ] 4.2 Escribir `NuevoTurnoPage.test.tsx`: crear con paciente existente llama a `POST /api/recepcion/turnos` con `pacienteId`, inicio del hueco y sin `boxId`, y vuelve a la agenda de ese día; con box elegido manda su `boxId`; con "Paciente nuevo" manda el objeto `paciente` sin `pacienteId`; un `409 SOLAPAMIENTO_PROFESIONAL` y uno `SOLAPAMIENTO_BOX` muestran su mensaje legible, conservan el paciente y vuelven a pedir los huecos. Implementar según `mockups/nuevo-turno.html` y verificar que pasa.
- [ ] 4.3 Escribir `ReprogramarPage.test.tsx`: muestra el turno actual y el aviso de que vuelve a `reservado`; elegir el hueco de las 11:00 llama a `PATCH /api/turnos/:id/reprogramar` con ese inicio y vuelve a la agenda; un `409 SOLAPAMIENTO_PROFESIONAL` muestra el mensaje y vuelve a pedir los huecos. Implementar según `mockups/reprogramar.html` y verificar que pasa.

## 5. Pacientes

- [ ] 5.1 Escribir `PacientesPage.test.tsx`: lista los pacientes de la API; el buscador "Dos" deja solo a "Paciente Ficticio Dos"; el alta llama a `POST /api/pacientes`; un `409 DUPLICADO` muestra el mensaje legible y conserva lo cargado. Implementar y verificar que pasa.

## 6. Sin precios y verificación

- [ ] 6.1 Agregar el test transversal de precios: con una respuesta de agenda que incluye `precioAlReservar` 15000, ni la agenda ni las acciones muestran "15000" ni `$`. Verificar que pasa.
- [ ] 6.2 Correr `npm test`, `npm run typecheck` y `npm run lint` en la raíz (incluye `web/`) y verificar que están en verde, sin `any` ni `@ts-ignore`.
- [ ] 6.3 Revisar con `git diff --stat origin/main` que solo cambiaron `web/src/pages/recepcion/` y `openspec/changes/web-recepcion/`, y comparar cada escenario del spec con al menos un test (regla dura 8).
- [ ] 6.4 Verificación visual: levantar la web con datos ficticios, capturar agenda, nuevo turno y reprogramar a 390x844 y 1440x900 en `mockups/verify/`, compararlas con los mockups aprobados, revisar consola y red, y registrar `Visual verify` en `design.md` con las diferencias por prioridad.

## Workflow follow-up

- Archivar el change en `dev-lautaro` una vez verificado.
- Agregar la fila de C-13 al final de `evidencias/bitacora-decisiones.md` (decisiones: huecos libres; rutas de recepción de C-11 en vez de `POST /api/turnos`).
- Abrir el PR con la plantilla. Avisar a Lucas que la pantalla de inicio de C-12 sigue apuntando a las vistas previas de recepción (design D2).
