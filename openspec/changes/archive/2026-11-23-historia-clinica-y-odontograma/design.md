# Design

## Context

Con `C-01` (`fundacion-y-dominio-base`) y `C-04` (`cuentas-y-pacientes`) ya mergeados en `main` (`4c560f5`), el proyecto cuenta con entidades clínicas congeladas (`EntradaHistoriaClinica`, `Odontograma`, `EstadoPieza`, `CaraPieza`, `EstadoDePieza`), repositorios append-only en memoria (`historiaClinica`, `estadosPieza`), `Clock` inyectable, `conLockDeAgenda` y verificación JWT real que resuelve `sesion.profesionalId` (ver `proposal.md` para la motivación y `specs/clinica/spec.md` para el contrato observable).

C-09 trabaja exclusivamente dentro de `src/modules/clinica/` y `tests/clinica/`, sujeto a cuatro restricciones estructurales:

1. **Governance CRITICO**: manipula datos sensibles de salud (`RN-DA-03`); aprobado por EP con los 4 ajustes incorporados en este documento (estados de pieza completa sin `cara`, documentación de ausencia de auditoría de lecturas en `PA-07`, topes de tamaño de entrada y requisitos `< 500` caracteres).
2. **Cero cambios en `src/shared/` y archivos congelados**: se utilizan sin modificaciones las 7 constantes de `EstadoDePieza`, las 5 de `CaraPieza`, las entidades de `src/shared/entidades.ts`, los puertos de `src/shared/repositorios.ts` y los códigos de `src/shared/errores.ts`.
3. **Dominio puro (regla dura 9 / DD-08)**: `src/modules/clinica/dominio/` no puede usar `Date.now()`, `new Date()`, `process.env`, Fastify ni repositorios.
4. **Inmutabilidad y trazabilidad (`RN-CL-01`, `RN-CL-02`)**: tanto `historiaClinica` como `estadosPieza` son estrictamente append-only; cada registro conserva autor (`profesionalId` / `registradoPor`) y marca temporal (`fecha` desde `Clock`).

## Goals / Non-Goals

**Goals:**
- Separar estrictamente reglas puras (`dominio/`), orquestación de casos de uso (`aplicacion/`) y borde HTTP/Zod/RBAC (`routes.ts`).
- Garantizar validación exacta de las 52 piezas válidas en notación FDI (`11–48` permanentes y `51–85` temporarias), rechazando huecos, no enteros y valores `<= 0`.
- Asegurar consistencia 1 a 1 del `Odontograma` por paciente bajo concurrencia mediante `deps.conLockDeAgenda`.
- Devolver en `GET` y `PUT /api/pacientes/:id/odontograma` tanto el estado actual proyectado (`piezas`) como la traza histórica completa (`historial`) sin campos derivados innecesarios.
- Asegurar aislamiento estricto por rol (`profesional` únicamente) y colaboración transparente entre profesionales del mismo consultorio.

**Non-Goals:**
- Agregar estados extra a `EstadoDePieza` (no `danado`, no `sensible` —los síntomas se registran en el texto de la HC— ni `en_recambio` —cubierto mediante `ausente` en piezas temporarias `51–85`—).
- Agregar campos calculados como `fechaDefecto` o `fechaSanado` en la respuesta del odontograma (el `historial` append-only ya provee todas las fechas y autores de cada consulta).
- Exponer rutas de edición o borrado sobre historia clínica (`PUT/PATCH/DELETE`) o rutas `PATCH/DELETE` sobre odontograma.
- Periodontograma, adjuntos, imágenes, radiografías, recetas electrónicas, exportación de datos o firma digital (post-MVP según D.3 y `knowledge-base/01`).
- Cumplimiento legal formal de las Leyes 25.326 y 26.529 (documentado en `Open Questions` / `PA-07`).
- Pantallas web (C-09 es estrictamente backend; la interfaz profesional corresponde a `C-15`).

## Architecture

Arquitectura hexagonal dentro del módulo `src/modules/clinica/`:

```text
routes.ts (Fastify plugin bajo /api + requireRol('profesional') + validación Zod 3 .strict())
   │
   ▼
aplicacion/
   ├── historia.ts    (listarHistoriaClinica, agregarEntradaHistoria)
   └── odontograma.ts (obtenerOdontograma, actualizarOdontograma con conLockDeAgenda)
          ├──► dominio/
          │      ├── fdi.ts         (puro: constantes ESTADOS_DE_PIEZA, ESTADOS_SOLO_PIEZA_COMPLETA
          │      │                   y CARAS_PIEZA, esPiezaFdiValida, esEstadoSoloPiezaCompleta,
          │      │                   clavePiezaCara, tieneClavesDuplicadas,
          │      │                   tieneMezclaPiezaCompletaYCara)
          │      └── proyeccion.ts  (puro: ordenarCronologicamente, proyectarEstadoActual)
          └──► Puertos de C-01 (Repositorios, Clock, ConLockDeAgenda, UsuarioSesion)
```

Estructura de archivos planificada para C-09:
- `src/modules/clinica/dominio/fdi.ts`: validación pura de las 52 piezas FDI (`11–18, 21–28, 31–38, 41–48, 51–55, 61–65, 71–75, 81–85`), listas canónicas `ESTADOS_DE_PIEZA` (7), `ESTADOS_SOLO_PIEZA_COMPLETA` (`ausente`, `corona`, `endodoncia`, `a_extraer`) y `CARAS_PIEZA` (5) tipadas contra `src/shared/entidades.ts`, `esEstadoSoloPiezaCompleta(estado)`, clave compuesta `(pieza, cara ?? null)`, detección de duplicados `(pieza, cara ?? null)` y detección de mezcla de pieza completa `(P, undefined)` con cara específica `(P, cara)` para una misma `pieza` dentro de un lote.
- `src/modules/clinica/dominio/proyeccion.ts`: ordenamiento cronológico ascendente estable (`fecha.getTime()`, preservando orden de inserción ante empates) y proyección determinista no contradictoria `proyectarEstadoActual(historial)` (al recorrer `historial` cronológicamente: una cara específica `(P, cara)` elimina cualquier entrada previa de pieza completa `(P, undefined)` de `P` y coexiste con otras caras distintas de `P`; una pieza completa `(P, undefined)` elimina todas las entradas previas por cara `(P, *)` de `P`; `historial` permanece 100 % intacto; el resultado `piezas` se ordena por `pieza` ascendente y luego `cara` con `undefined` primero y luego alfabético).
- `src/modules/clinica/aplicacion/historia.ts`: `listarHistoriaClinica` y `agregarEntradaHistoria`.
- `src/modules/clinica/aplicacion/odontograma.ts`: `VistaOdontograma`, `obtenerOdontograma` y `actualizarOdontograma`.
- `src/modules/clinica/routes.ts`: plugin Fastify por defecto con las 4 rutas exactas y esquemas Zod 3 `.strict()`.
- `tests/clinica/`: `dominio.test.ts`, `historia.test.ts`, `odontograma.test.ts`, `rutas.test.ts`.

## Decisions

> Todas las decisiones D1–D7 reflejan el diseño aprobado por EP (Governance **CRITICO**) incluyendo los ajustes de validación por cara, topes de entrada y documentación de `PA-07`.

### D1. Superficie exacta de 4 endpoints (YAGNI + append-only)
Se proponen exactamente las 4 rutas definidas en `knowledge-base/02_descripcion_general.md` y `CHANGES.md` §C-09:
- `GET /api/pacientes/:id/historia` (`profesional`) → `200 EntradaHistoriaClinica[]`
- `POST /api/pacientes/:id/historia` (`profesional`) → `201 EntradaHistoriaClinica`
- `GET /api/pacientes/:id/odontograma` (`profesional`) → `200 VistaOdontograma`
- `PUT /api/pacientes/:id/odontograma` (`profesional`) → `200 VistaOdontograma`

No se crean `PATCH /api/pacientes/:id/odontograma`, `DELETE /api/pacientes/:id/odontograma`, ni `PUT`/`PATCH`/`DELETE` sobre `/api/pacientes/:id/historia` o `/api/pacientes/:id/historia/:entradaId`. Cualquier invocación a esas rutas/verbos cae en `setNotFoundHandler` de `src/app.ts` (`404 {"code":"NO_ENCONTRADO"}`), reforzando a nivel de API la inmutabilidad append-only que ya imponen `RepositorioAppendOnly` y `RN-CL-01`.

### D2. Validación estricta en el borde (Zod 3 `.strict()`), topes de entrada y derivación de metadatos desde el servidor
- **`POST /api/pacientes/:id/historia`**: esquema `.strict()` con `{ texto: z.string().trim().min(1).max(5000), turnoId: z.string().trim().min(1).optional(), corrigeAId: z.string().trim().min(1).optional() }`. El tope de `5000` caracteres (tras `.trim()`) acota el tamaño de cada evolución clínica (`5000` aceptado, `5001` → `400 FORMATO_INVALIDO`). Enviar `id`, `profesionalId`, `pacienteId`, `fecha` o cualquier campo desconocido dispara `ZodError` → `400 FORMATO_INVALIDO`.
- **`PUT /api/pacientes/:id/odontograma`**: esquema `.strict()` con `{ piezas: z.array(esquemaItemPieza).min(1).max(260) }` (cota superior de 52 piezas FDI × 5 caras = `260`; `261` → `400 FORMATO_INVALIDO`), donde cada ítem usa `.strict()` con `{ pieza, cara?, estado }` y valida:
  1. `pieza`: entero que cumple `esPiezaFdiValida(n)` (52 valores exactos).
  2. `cara`: opcional entre los 5 valores de `CaraPieza`.
  3. `estado`: obligatorio entre los 7 valores de `EstadoDePieza`.
  4. Compatibilidad estado–cara (regla clínica validada con `esEstadoSoloPiezaCompleta` del dominio):
     - `ausente`, `corona`, `endodoncia` y `a_extraer` aplican exclusivamente a la pieza completa; si se envían con `cara !== undefined` (p. ej. `{ pieza: 16, cara: "oclusal", estado: "ausente" }`), se rechazan con `400 FORMATO_INVALIDO`.
     - `caries`, `obturado` y `sano` pueden enviarse con o sin `cara`.
  5. Consistencia intra-lote (validada con `.superRefine` apoyado en `tieneClavesDuplicadas` y `tieneMezclaPiezaCompletaYCara` del dominio):
     - Sin duplicados de `(pieza, cara ?? null)` dentro del mismo arreglo `piezas` (ni dos `(16, 'oclusal')` ni dos `(21, undefined)`).
     - Sin mezclar pieza completa `(P, undefined)` con ninguna cara específica `(P, cara)` para una misma `pieza` `P` dentro del mismo lote `PUT` (responde `400 FORMATO_INVALIDO`).
     - Múltiples caras distintas para la misma `pieza` en el mismo `PUT` —por ejemplo `(16, 'oclusal')` y `(16, 'mesial')`— siguen siendo válidas y coexisten.
- Los metadatos de autoría y tiempo (`profesionalId`, `registradoPor`, `fecha`, `id`, `odontogramaId`, `actualizadoEn`) provienen **siempre** del servidor (`sesion.profesionalId`, `clock.ahora()`, `crypto.randomUUID()` inyectable para tests), nunca del payload del cliente.
- *Alternativa descartada*: ignorar silenciosamente campos extra como `profesionalId` o `fecha` enviados por el cliente. Se descarta porque `.strict()` detecta inmediatamente intentos de suplantación o contratos erróneos del frontend (C-15), en línea con C-04.

### D3. Regla pura de notación FDI y compatibilidad estado–cara (`RN-CL-02`)
En `src/modules/clinica/dominio/fdi.ts`:
- `esPiezaFdiValida(pieza: number): boolean` verifica `Number.isInteger(pieza)`, descompone `cuadrante = Math.floor(pieza / 10)` y `posicion = pieza % 10`, y retorna `true` si y solo si:
  - `(cuadrante >= 1 && cuadrante <= 4 && posicion >= 1 && posicion <= 8)` (32 permanentes), o
  - `(cuadrante >= 5 && cuadrante <= 8 && posicion >= 1 && posicion <= 5)` (20 temporarias).
- `ESTADOS_SOLO_PIEZA_COMPLETA` (`['ausente', 'corona', 'endodoncia', 'a_extraer']`) y `esEstadoSoloPiezaCompleta(estado: EstadoDePieza): boolean` modelan los estados que solo tienen sentido clínico sobre la pieza completa (`cara === undefined`); los restantes (`caries`, `obturado`, `sano`) admiten tanto pieza completa como cara específica.
- *Alternativa descartada*: aceptar rangos contiguos `11 <= n <= 48 || 51 <= n <= 85` o permitir `cara` sobre `ausente`/`corona`/`endodoncia`/`a_extraer`. Se descartan porque aceptarían huecos FDI inexistentes (`19, 20, 29, 30, 39, 40, 56–60, 66–70, 76–80`) o estados clínicamente inválidos como una única cara `ausente`.

### D4. Contrato de respuesta y proyección del odontograma (`PA-06`)
Se propone la siguiente vista unificada `VistaOdontograma` para `GET` y `PUT /api/pacientes/:id/odontograma`:

```ts
export interface VistaOdontograma {
  odontogramaId: string | null;
  pacienteId: string;
  actualizadoEn: Date | null;
  piezas: EstadoPieza[];
  historial: EstadoPieza[];
}
```

- **Lectura sin efectos secundarios (`GET`)**: si el paciente existe pero todavía no tiene `Odontograma` en `repos.odontogramas`, responde `200` con `{ odontogramaId: null, pacienteId, actualizadoEn: null, piezas: [], historial: [] }` y **no** inserta ningún registro en el repositorio.
- **Actualización incremental (`PUT`)**: cada llamada agrega un nuevo `EstadoPieza` por cada ítem del lote (sin sobrescribir ni borrar registros anteriores ni otras piezas ya cargadas).
- **Proyección `piezas` (regla de nivel más completo / no contradictorio)**: se calcula de forma pura sobre `historial` (previamente ordenado por `fecha.getTime()` ascendente con sort estable), aplicando cada registro cronológicamente sobre el estado vigente:
  1. Un registro de **cara específica** `(P, cara)` elimina del estado vigente cualquier entrada previa de pieza completa `(P, undefined)` para la pieza `P` y establece `(P, cara)`. Múltiples caras distintas de la misma pieza `P` (por ejemplo `(16, 'oclusal')` y `(16, 'mesial')`) coexisten.
  2. Un registro de **pieza completa** `(P, undefined)` (por ejemplo `ausente`, `corona`, `sano`) elimina del estado vigente todas las entradas previas por cara `(P, *)` para la pieza `P` y establece `(P, undefined)`.
  3. Ante empate exacto de timestamp, el orden de inserción (sort estable) decide qué registro se aplica último. El arreglo resultante `piezas` se ordena determinísticamente por `pieza` ascendente y luego `cara` (`undefined` primero, luego orden lexicográfico).
  4. **`historial` intacto**: esta regla aplica únicamente a la proyección `piezas`; `historial` preserva siempre el 100 % de los registros append-only sin eliminar ni alterar entradas previas.
- **Resolución de PA-06**: adopta el supuesto por defecto de `CHANGES.md` §C-09 (`pieza` FDI + `estado`, con `cara` opcional), ya reflejado en `EstadoPieza` de C-01, junto con la regla clínica de proyección no contradictoria entre pieza completa y caras.
- *Alternativa descartada*: permitir la coexistencia en `piezas` de pieza completa `(P, undefined)` y cara específica `(P, cara)` para una misma pieza (produciría estados vigentes clínicamente contradictorios, como pieza `16` `ausente`/`corona` y a la vez `caries` en `oclusal`), así como modelar campos calculados como `fechaDefecto` / `fechaSanado` o reemplazar el odontograma completo en cada `PUT`. Se descartan porque `historial` ya preserva cada transición con fecha y autor sin lógica ambigua de "defecto/sanado", y el `PUT` incremental evita pérdida accidental de piezas cargadas en consultas anteriores.

### D5. Validación referencial en historia clínica (`pacienteId`, `turnoId`, `corrigeAId`)
- `GET` y `POST /api/pacientes/:id/historia` verifican primero que `pacienteId` exista en `repos.pacientes`; si no existe → `ReglaDeNegocioError('NO_ENCONTRADO')` (`404`).
- En `POST`, si viene `turnoId`, se busca en `repos.turnos.buscarPorId(turnoId)` y se exige que exista **y** que `turno.pacienteId === pacienteId`; en caso contrario → `404 NO_ENCONTRADO` (sin revelar la existencia de turnos de otros pacientes). Se acepta cualquier turno perteneciente al paciente independientemente de su estado (un profesional puede documentar durante o después de la consulta).
- En `POST`, si viene `corrigeAId`, se busca en `repos.historiaClinica` una entrada con `id === corrigeAId` **y** `pacienteId === pacienteId`; en caso contrario → `404 NO_ENCONTRADO`. Se permite corregir entradas redactadas por otro profesional del consultorio o encadenar una corrección sobre otra corrección previa del mismo paciente.

### D6. Serialización con `deps.conLockDeAgenda` en `PUT /api/pacientes/:id/odontograma`
Para evitar crear dos `Odontograma` para un mismo paciente ante dos `PUT /api/pacientes/:id/odontograma` simultáneos (condición de carrera TOCTOU entre el `listar` y el `guardar` del `Odontograma` 1 a 1):
- Toda la operación de `actualizarOdontograma` (verificar existencia del paciente, buscar o crear el `Odontograma` 1 a 1, anexar todos los `EstadoPieza` del lote, actualizar `actualizadoEn` y guardar el `Odontograma`, leer el historial resultante y proyectar `piezas`) se ejecuta dentro de `deps.conLockDeAgenda`.
- Las lecturas (`GET /historia`, `GET /odontograma`) y el alta puramente append-only de HC (`POST /historia`, que no mantiene una entidad agregada 1 a 1) no adquieren el lock.
- *Alternativa descartada*: introducir un lock nuevo en `src/shared/` (congelado después de C-01) o dejar sin lock el *get-or-create* de `Odontograma` (violaría la cardinalidad 1 a 1 bajo concurrencia).

### D7. RBAC exclusivo `profesional` y colaboración multiprofesional (`RN-RO-03`)
- Las 4 rutas registran `{ preHandler: requireRol('profesional') }`. Como `onRoute` antepone `autenticar` y luego corre `requireRol` antes del handler, una `recepcionista` o un `paciente` recibe `403 SIN_PERMISO` de forma uniforme incluso si el `:id` de paciente no existe o el cuerpo es inválido (sin filtrar si un paciente existe).
- Cualquier profesional autenticado (`Dra. Ana Pérez`, `Dr. Bruno Gómez`, etc.) puede consultar y agregar registros sobre cualquier paciente del consultorio: la historia clínica y el odontograma pertenecen al paciente dentro del consultorio, y cada entrada / cambio conserva siempre el `profesionalId` / `registradoPor` real de quien lo registró.
- Aunque `AuthPort.verificar` (C-04) ya garantiza que toda sesión `profesional` trae `profesionalId`, los casos de uso de escritura verifican defensivamente la presencia de `sesion.profesionalId` y lanzan `SinPermisoError` si faltara (por ejemplo en un test unitario con sesión sintética incompleta).

## Risks / Trade-offs

- [Reutilización de `conLockDeAgenda` para `PUT /odontograma`] → Comparte la cola de serialización en memoria con agenda y cuentas; en la escala del MVP (1 a 3 profesionales, decenas de operaciones por día, operaciones en memoria de microsegundos) el impacto es despreciable, y al migrar a SQLite (post-MVP) se reemplaza por una transacción con restricción `UNIQUE(pacienteId)` en la tabla `odontogramas`.
- [Empates de timestamp con `FixedClock` o escrituras en el mismo milisegundo] → `Array.prototype.sort` en Node 22 es estable por especificación (ES2019+), y `appendOnlyEnMemoria` preserva el orden de inserción; por ello `ordenarCronologicamente` mantiene determinismo exacto incluso ante timestamps idénticos. Al migrar a SQLite conviene acompañar `fecha` con una columna autoincremental de secuencia como desempate.
- [Limitación regulatoria `PA-07` y ausencia de auditoría de lecturas (`RN-DA-03`) en el MVP] → El MVP audita con autor y marca temporal todas las escrituras clínicas (`POST /historia`, `PUT /odontograma`), pero **no** registra auditoría de accesos de lectura (`GET /historia`, `GET /odontograma`) porque `src/shared/` está congelado y no dispone de una entidad ni repositorio compartido de auditoría de lecturas; tampoco implementa firma digital, cifrado en reposo, consentimiento informado ni exportación formal según Leyes 25.326 y 26.529. Queda mitigado en el MVP por RBAC estricto (`requireRol('profesional')`), modelo append-only y datos 100 % ficticios (`RN-DA-01`), y diferido junto con `PA-07`.

## Migration Plan

1. Esperar la aprobación explícita de EP sobre esta propuesta, `design.md` y `specs/clinica/spec.md` (**Governance CRITICO**).
2. Verificar línea base `npm run typecheck && npm run lint && npm test` en verde en `dev-facundo` (Task 0.1).
3. Ejecutar `apply` siguiendo `tasks.md` con TDD estricto (`RED → GREEN → TRIANGULATE → REFACTOR`), escribiendo exclusivamente en `src/modules/clinica/` y `tests/clinica/`.
4. Rollback: al estar todo el código encapsulado en `src/modules/clinica/` y `tests/clinica/` y cargarse por autoload sin tocar `src/app.ts` ni `src/shared/`, revertir el PR elimina las 4 rutas sin impacto en el resto del sistema.

## UI Mockups

- Design system revision: 1
- Decision: no (no UI). C-09 es un change estrictamente backend; la interfaz de historia clínica y odontograma del profesional corresponde a `C-15 web-profesional`.
- Date: 2026-11-23

## Open Questions

- **PA-06 (nivel de detalle del odontograma)**: resuelta y confirmada por EP con el supuesto por defecto de `CHANGES.md` §C-09 — pieza FDI (52 valores válidos) + estado (7 valores de `EstadoDePieza`), con `cara` opcional (5 valores de `CaraPieza`) restringida a `caries`, `obturado` y `sano` (`ausente`, `corona`, `endodoncia` y `a_extraer` solo pieza completa), sin modificar `src/shared/entidades.ts` y devolviendo proyección actual (`piezas`) más secuencia completa (`historial`).
- **PA-07 (Leyes 25.326 y 26.529 + auditoría de lecturas `RN-DA-03`)**: **limitación documentada fuera del alcance del MVP**. El cumplimiento legal formal (consentimiento informado, conservación legal a plazo, firma digital, derecho de acceso/rectificación formal y registro de base de datos) se difiere a una etapa productiva posterior. Asimismo, respecto de `RN-DA-03`, las **escrituras clínicas** (`POST /api/pacientes/:id/historia` y `PUT /api/pacientes/:id/odontograma`) quedan auditadas con autor y timestamp (`profesionalId` / `registradoPor` + `fecha`), mientras que los **accesos de lectura** (`GET /api/pacientes/:id/historia` y `GET /api/pacientes/:id/odontograma`) **no** se auditan en el MVP debido a que `src/shared/` está congelado tras C-01 y no incluye una entidad/repositorio de auditoría de lecturas; esta limitación queda mitigada por RBAC estricto (`requireRol('profesional')`) y diferida junto con `PA-07`. Las medidas técnicas implementadas en el MVP son: (1) control de acceso exclusivo por rol `profesional` (`RN-RO-03`), (2) almacenamiento estrictamente append-only sin edición ni borrado físico (`RN-CL-01`), (3) trazabilidad de autor y timestamp desde `Clock` en cada escritura clínica (`RN-CL-01`, `RN-CL-02`), y (4) prohibición absoluta de datos reales de pacientes en código, seeds, tests y evidencias (`RN-DA-01`).
