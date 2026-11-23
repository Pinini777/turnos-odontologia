# Explore — `historia-clinica-y-odontograma` (C-09)

- **Change**: `C-09` · `historia-clinica-y-odontograma` · Capability: `clinica` · Prioridad: `P1`
- **Responsable**: Facundo · **Historias**: `US-050`, `US-051` · **Flujo**: `F-07`
- **Governance**: **CRITICO** (datos sensibles de salud → requiere aprobación explícita de EP sobre el spec y el diseño antes de iniciar `apply`)
- **UI**: No aplica (backend puro; `Decision: no (no UI)`; consumido posteriormente por `C-15 web-profesional`)

## 1. Contratos congelados inspeccionados (C-01 y C-04)

Se revisaron los contratos base vigentes en `turnos-odontologia` (sincronizado con `origin/main` en `4c560f5`, sin modificar ningún archivo compartido):

- **`src/shared/entidades.ts`**:
  - `EntradaHistoriaClinica`: `{ id: string, pacienteId: string, profesionalId: string, fecha: Date, texto: string, turnoId?: string, corrigeAId?: string }` (append-only, `RN-CL-01`).
  - `Odontograma`: `{ id: string, pacienteId: string, actualizadoEn: Date }` (relación 1 a 1 con `Paciente`).
  - `CaraPieza`: `'oclusal' | 'mesial' | 'distal' | 'vestibular' | 'lingual'` (5 valores exactos, opcional).
  - `EstadoDePieza`: `'sano' | 'caries' | 'obturado' | 'ausente' | 'corona' | 'endodoncia' | 'a_extraer'` (7 valores exactos).
  - `EstadoPieza`: `{ id: string, odontogramaId: string, pieza: number, cara?: CaraPieza, estado: EstadoDePieza, registradoPor: string, fecha: Date }` (append-only, `RN-CL-02`).
  - `Turno`: incluye `id` y `pacienteId`, utilizado para validar pertenencia del `turnoId` opcional.
- **`src/shared/repositorios.ts`**:
  - `repos.pacientes`: `Repositorio<Paciente>` (`existe`, `buscarPorId`, `listar`, `guardar`).
  - `repos.turnos`: `Repositorio<Turno>` (`buscarPorId`).
  - `repos.odontogramas`: `Repositorio<Odontograma>` (`guardar`, `buscarPorId`, `listar`, `existe`) — sin método `borrar`.
  - `repos.historiaClinica`: `RepositorioAppendOnly<EntradaHistoriaClinica>` (`agregar`, `listar`) — por diseño de interfaz no expone edición ni borrado.
  - `repos.estadosPieza`: `RepositorioAppendOnly<EstadoPieza>` (`agregar`, `listar`) — por diseño de interfaz no expone edición ni borrado.
  - Todas las lecturas/escrituras en memoria devuelven copias con `structuredClone`.
- **`src/shared/sesion.ts` y `src/app.ts`**:
  - `UsuarioSesion`: `{ usuarioId, rol, profesionalId?, pacienteId? }`. Tras C-04, `AuthPort.verificar(token)` ya resuelve `profesionalId` de forma obligatoria para toda sesión con `rol: 'profesional'`.
  - `requireRol('profesional')` corre en el `preHandler` antes del handler (y antes de validar parámetros/body o consultar repositorios), garantizando `403 SIN_PERMISO` para `recepcionista` y `paciente` incluso si el `id` de paciente no existe.
  - Hook `onRoute` rechaza falta de token o token inválido con `401 NO_AUTENTICADO`.
  - `ZodError` → `400 { code: "FORMATO_INVALIDO", detalles: [{ campo, motivo }] }`.
  - `ReglaDeNegocioError('NO_ENCONTRADO')` → `404 { code: "NO_ENCONTRADO" }`.
  - `setNotFoundHandler` responde `404 { code: "NO_ENCONTRADO" }` para métodos o rutas no declaradas (como `PUT/PATCH/DELETE` sobre historia clínica o `PATCH/DELETE` sobre odontograma).
- **`src/shared/puertos.ts` y `src/shared/lock.ts`**:
  - `deps.clock`: fuente única de `fecha` (`clock.ahora()`), sin usar `new Date()` ni `Date.now()` en dominio ni casos de uso.
  - `deps.conLockDeAgenda`: serializador en proceso disponible para hacer atómico el *get-or-create* 1 a 1 del `Odontograma` + alta de `EstadoPieza` + actualización de `actualizadoEn` ante `PUT` concurrentes.
- **`src/shared/seed.ts`**:
  - Profesionales ficticios listos para pruebas multiprofesionales: `SEED.profesionales.anaPerez` (`Dra. Ana Pérez`) y `SEED.profesionales.brunoGomez` (`Dr. Bruno Gómez`).
  - Pacientes ficticios listos para pruebas: `SEED.pacientes.uno` (`Paciente Ficticio Uno`) y `SEED.pacientes.dos` (`Paciente Ficticio Dos`).

## 2. Verificación de impacto sobre archivos congelados

C-09 **no requiere ningún cambio en `src/shared/`, `src/app.ts` ni `package.json`**:
- Los tipos `EntradaHistoriaClinica`, `Odontograma`, `EstadoPieza`, `CaraPieza` y `EstadoDePieza` ya están congelados y cubren el 100 % del alcance.
- No se agregan estados adicionales a `EstadoDePieza` (se descartan `danado`, `sensible` —síntomas van en el texto de la HC— y `en_recambio` —modelado como `ausente` sobre piezas temporarias `51–85`—).
- No se requieren códigos nuevos en `CODIGOS_NEGOCIO`: los rechazos se cubren íntegramente con `400 FORMATO_INVALIDO`, `401 NO_AUTENTICADO`, `403 SIN_PERMISO` y `404 NO_ENCONTRADO`.

## 3. Análisis de reglas de dominio y preguntas abiertas

### 3.1 Notación FDI (`RN-CL-02`)
- **Dentición permanente (32 piezas)**: cuadrantes `1..4`, posiciones `1..8` → `11–18`, `21–28`, `31–38`, `41–48`.
- **Dentición temporaria (20 piezas)**: cuadrantes `5..8`, posiciones `1..5` → `51–55`, `61–65`, `71–75`, `81–85`.
- **Total**: exactamente **52 enteros válidos**. Se rechazan todos los huecos (`19, 20, 29, 30, 39, 40, 49, 50, 56–60, 66–70, 76–80, 86+`), valores `<= 0` y no enteros con `400 FORMATO_INVALIDO`.

### 3.2 Proyección e historial del odontograma (`PA-06`)
- Siguiendo `CHANGES.md` §C-09, se aplica el supuesto por defecto para **PA-06**: cada registro indica `pieza` (FDI) y `estado` (7 valores de `EstadoDePieza`), con `cara` opcional (5 valores de `CaraPieza`).
- No se agregan campos derivados como `fechaDefecto` o `fechaSanado`: la respuesta de `GET` y `PUT /api/pacientes/:id/odontograma` devuelve:
  `{ odontogramaId, pacienteId, actualizadoEn, piezas, historial }`, donde:
  - `piezas`: proyección del último `EstadoPieza` vigente por clave compuesta `(pieza, cara ?? null)`.
  - `historial`: secuencia completa append-only de `EstadoPieza[]` ordenada cronológicamente ascendente (`fecha.getTime()`, preservando orden de inserción en empates), permitiendo a profesionales y a la UI (C-15) inspeccionar todas las fechas y autores previos.
- Una lectura (`GET`) sobre un paciente sin odontograma **no crea** un `Odontograma` en el repositorio; devuelve `{ odontogramaId: null, pacienteId, actualizadoEn: null, piezas: [], historial: [] }`.

### 3.3 Marco regulatorio (`PA-07`)
- El cumplimiento legal formal de la **Ley 25.326** (protección de datos personales y sensibles) y la **Ley 26.529** (derechos del paciente e historia clínica: consentimiento informado, firma digital, conservación legal) queda **fuera del alcance del MVP** y se documenta explícitamente como limitación en `design.md`.
- En el MVP se implementan las salvaguardas técnicas correspondientes: RBAC estricto solo `profesional` (`RN-RO-03`), persistencia append-only sin edición ni borrado físico (`RN-CL-01`), trazabilidad de autor (`profesionalId` / `registradoPor`) y timestamp (`fecha` desde `Clock`) en cada registro, y uso exclusivo de datos 100 % ficticios en repo, seeds y tests (`RN-DA-01`).

## 4. Decisiones propuestas (pendiente de aprobación de EP)

1. **Superficie mínima de exactamente 4 endpoints** (sin `PATCH /odontograma`, sin `PUT/PATCH/DELETE` en HC, sin `DELETE /odontograma`):
   - `GET /api/pacientes/:id/historia` → `200 EntradaHistoriaClinica[]` ordenada cronológicamente ascendente.
   - `POST /api/pacientes/:id/historia` → `201 EntradaHistoriaClinica` append-only (`texto` no vacío recortado, `turnoId?` y `corrigeAId?` validados contra el mismo `pacienteId` → `404 NO_ENCONTRADO` si no existen o pertenecen a otro paciente; Zod `.strict()`).
   - `GET /api/pacientes/:id/odontograma` → `200 { odontogramaId, pacienteId, actualizadoEn, piezas, historial }` sin efectos secundarios.
   - `PUT /api/pacientes/:id/odontograma` → `200 { odontogramaId, pacienteId, actualizadoEn, piezas, historial }`, lote incremental append-only `{ piezas: [{ pieza, cara?, estado }, ...] }` (`min(1)`, sin duplicados `(pieza, cara)` en el mismo pedido, Zod `.strict()`), ejecutado dentro de `deps.conLockDeAgenda`.
2. **Colaboración multiprofesional (`RN-RO-03`)**: cualquier `profesional` autenticado del consultorio puede consultar y agregar registros en la HC y el odontograma de cualquier paciente, viendo los registros de colegas y estampando siempre su propio `sesion.profesionalId` como autor.
3. **Concurrencia**: `deps.conLockDeAgenda` serializa `PUT /api/pacientes/:id/odontograma` para garantizar unicidad 1 a 1 del `Odontograma` ante dos `PUT` simultáneos sobre un paciente sin odontograma previo. Las lecturas `GET` no requieren lock.
4. **Límites de carpetas**:
   - Código: `src/modules/clinica/{dominio,aplicacion,routes.ts}`.
   - Tests: `tests/clinica/`.
   - Artefactos SDD: `openspec/changes/historia-clinica-y-odontograma/`.
