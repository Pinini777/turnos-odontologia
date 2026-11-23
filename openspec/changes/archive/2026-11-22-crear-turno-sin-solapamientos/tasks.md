# Tasks

> TDD: en cada tarea, primero el test en rojo y después el código mínimo. Comandos: `npx vitest run tests/turnos-alta`, `npm run typecheck`, `npm run lint`.

## 1. Dominio de agenda

- [x] 1.1 `seSuperponen` con intervalos `[inicio, fin)` en `dominio/agenda.ts`; verificar en `tests/turnos-alta/agenda.test.ts` que superpuestos chocan y contiguos (10:00–10:30 y 10:30–11:00, en los dos órdenes) no
- [x] 1.2 `conflictos(turnos, nuevo)` que ignora cancelados y devuelve `{profesional, box}`; verificar con tests de choque solo de profesional, solo de box, de ambos y con un cancelado que no cuenta
- [x] 1.3 `enGrilla(inicio)` en la zona del consultorio; verificar que 10:00, 10:15, 10:30 y 10:45 pasan, y que 10:10 y 10:15:30 no

## 2. Caso de uso y endpoint

- [x] 2.1 `routes.ts` con `POST /turnos`, Zod y `requireRol('profesional', 'recepcionista')`; verificar los escenarios "Inicio inválido" (400), "Sin sesión" (401) y "Un paciente intenta usar el alta del personal" (403)
- [x] 2.2 `crearTurno` con el camino feliz: calcula `fin`, congela el precio, define `origen` y `creadoPor`, guarda y responde 201; verificar "La recepcionista crea un turno en un hueco libre" (sin precio en la respuesta) y "El profesional ve el precio congelado"
- [x] 2.3 Validaciones de grilla y pasado; verificar "Inicio fuera de la grilla", "Inicio con segundos" e "Inicio anterior a ahora"
- [x] 2.4 Recursos existentes y activos; verificar "Paciente inexistente" (404) y "Box inactivo" (409 `RECURSO_INACTIVO`)
- [x] 2.5 Disponibilidad por el puerto; verificar "Fuera del horario de atención" y "Dentro de un bloqueo" con un puerto inyectado
- [x] 2.6 Solapamientos dentro de `conLockDeAgenda`, con prioridad de profesional; verificar "El profesional ya está ocupado en otro box" (sin turno, auditoría ni email nuevos), "El box ya está ocupado por otro profesional", "Profesional y box ocupados en el mismo intervalo", los tres escenarios de intervalos semiabiertos, incluido "Turno que empieza antes de que termine otro", "Se reserva el hueco de un turno cancelado" y "El profesional intenta forzar un sobreturno"
- [x] 2.7 Atomicidad; verificar "Dos altas al mismo hueco a la vez" (un 201, un 409 y un solo turno guardado)

## 3. Auditoría y aviso

- [x] 3.1 Registro de auditoría `creado` dentro del lock; verificar "Registro de auditoría al crear"
- [x] 3.2 Email mínimo en `aplicacion/email.ts`, enviado después del lock sin relanzar errores; verificar "Email de confirmación sin precio" y "Falla el envío del email"

## 4. Verificación integral

- [x] 4.1 Correr `npm test`, `npm run typecheck` y `npm run lint` en verde, levantar la API con `npm start` y comprobar `GET /api/health` → 200; guardar la salida en `evidencias/etapa-6/verify-C-02.md` con la tabla escenario → test

## Workflow follow-up

- Revisión del spec por EP antes de `apply` (Ajustar si el alcance quedó de más, de menos o inventado).
- `archive` del change (crea `openspec/specs/turnos-alta/`), fila en `evidencias/bitacora-decisiones.md`, PR de `dev-ep` a `main` y `[x]` de C-02 en `CHANGES.md` al mergear.
