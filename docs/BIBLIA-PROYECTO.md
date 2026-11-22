# 📖 BIBLIA DEL PROYECTO — Trabajo Global SDD + Active Stack

> **Materia:** Desarrollo de Software — UTN FRM (sección del campus "15 - SDD + Active Stack")
> **Trabajo:** "Trabajo de Integración: del Discovery al primer Change, con Spec-Driven Development y Active Stack"
> **Producto:** Sistema de gestión de turnos y agenda de pacientes para **consultorios odontológicos** del mercado argentino.
> **Entrega en el campus:** tarea **"Entrega SDD"** — vence el **miércoles 25/11/2026 a las 23:00** (hora de Mendoza).
> **Equipo:** 6 integrantes, 1 líder de proyecto.
> **Agente de IA del equipo:** Claude Code.
> **Documento compilado el:** 19/11/2026.

Este archivo junta **todo** lo que hay que saber del trabajo: la consigna completa, la metodología SDD, la herramienta Active Stack (con lo que trae el zip local y lo que cambió en la versión actual de GitHub), OpenSpec, Engram, cómo trabajar en equipo con GitHub y los riesgos detectados. Si algo de acá contradice la consigna oficial, **manda la consigna**.

---

## Índice

1. [Fuentes consultadas](#1-fuentes-consultadas)
2. [⚠️ Alertas importantes (leer primero)](#2-️-alertas-importantes-leer-primero)
3. [La consigna completa](#3-la-consigna-completa)
4. [Criterios de evaluación (100 puntos)](#4-criterios-de-evaluación-100-puntos)
5. [Entregables y estructura del repositorio](#5-entregables-y-estructura-del-repositorio)
6. [Metodología: Spec-Driven Development (SDD)](#6-metodología-spec-driven-development-sdd)
7. [OpenSpec (el CLI de SDD)](#7-openspec-el-cli-de-sdd)
8. [Active Stack: qué es y qué trae](#8-active-stack-qué-es-y-qué-trae)
9. [La fundación del proyecto (las 7 etapas)](#9-la-fundación-del-proyecto-las-7-etapas)
10. [El ciclo OPSX](#10-el-ciclo-opsx)
11. [Engram (memoria persistente)](#11-engram-memoria-persistente)
12. [El SDD Orchestrator, governance y TDD](#12-el-sdd-orchestrator-governance-y-tdd)
13. [Trabajo en equipo con GitHub](#13-trabajo-en-equipo-con-github)
14. [Organización del equipo de 6](#14-organización-del-equipo-de-6)
15. [Plan de trabajo hasta la entrega](#15-plan-de-trabajo-hasta-la-entrega)
16. [Glosario](#16-glosario)
17. [Checklist final de entrega](#17-checklist-final-de-entrega)

---

## 1. Fuentes consultadas

| # | Fuente | Qué aporta |
|---|---|---|
| 1 | `desarrollo-active-stack Global (1).docx` (carpeta GLOBAL, 16/11/2026) | Consigna **versión local** (con agregados sobre el rol del líder y el repo con ramas). |
| 2 | Campus UTN FRM → Desarrollo de Software → "15 - SDD + Active Stack" → `desarrollo-active-stack.pdf` | Consigna **versión campus** (10 páginas). |
| 3 | Campus → carpeta "Material De Videos" (= `docs/*.pdf` locales) | Diapositivas de los videos: Parte 1, Parte 2, Parte 3 de Active Stack y video SDD + OpenSpec. |
| 4 | `active-stack-main (5).zip` (carpeta GLOBAL, 28/09/2026) | Código fuente de Active Stack (versión vieja, ver alertas). |
| 5 | GitHub `Group-Active-IA/active-stack` (README actual) | Versión vigente de la herramienta, comandos `update`, cambios en Claude. |
| 6 | GitHub `Group-Active-IA/active-orchestrator` (README + SKILL.md v2.6) | Cómo funciona hoy la fundación, comandos, estado. |
| 7 | GitHub `discovery-research`, `kb-creator`, `roadmap-generator`, `JuanCruzRobledo/agent-instruction` | Detalle de cada skill de la fundación. |
| 8 | GitHub `Fission-AI/OpenSpec` (README actual) | Instalación y comandos de OpenSpec (versión 2.x). |
| 9 | GitHub `Gentleman-Programming/engram` (README actual) | Engram: instalación, herramientas `mem_*`, sync. |
| 10 | Landing `active-stack-landing.vercel.app` | Descargas, pasos de instalación, FAQ. |
| 11 | Google Doc "Guía Contexto - GLOBAL" | Lista de videos de YouTube del profesor (ver abajo). |

### Videos de YouTube (del Google Doc del equipo)

**Videos que mandó el profe cuando empezó con SDD (serie "Active Stack Fundación"):**

| Video | Título |
|---|---|
| https://youtu.be/uC8a2rXhL8g | Active Stack Fundación · Introducción - 01 |
| https://youtu.be/vGY85wZud4A | Active Stack Fundación · Openspec init - 02 |
| https://youtu.be/woM8pp5M9Ic | Active Stack Fundación · Discovery - 03 |
| https://youtu.be/-JvEgGrKSUI | Active Stack: Los distintos caminos - Parte 4 |

**Videos que mandó el profe para el Global:**

| Video | Título |
|---|---|
| https://youtu.be/Ox__FXSeomQ | Active Stack: Un catálogo de harness - Parte 1 |
| https://youtu.be/eZgTpkSUJ4s | Active Stack: La ayuda en proyectos nuevos - Parte 2 |
| https://youtu.be/tja37Fk8epE | Active Stack: Comenzando con el desarrollo - Parte 3 |
| https://youtu.be/-JvEgGrKSUI | Active Stack: Los distintos caminos - Parte 4 |

**GitHub:**

| Video | Título |
|---|---|
| https://youtu.be/yc6X1Q4j7PA | Cómo hacer Fork y Pull Request en GitHub (guía práctica) |
| https://youtu.be/mKRvQE6rPJs | Domina GitHub desde Cero para Programar con IA (curso completo) — *recomendado por el equipo* |

> Nota: los videos no se pudieron transcribir automáticamente. El contenido de las Partes 1–3 y del video SDD está cubierto por las **diapositivas** del campus (secciones 6 a 11 de este documento). La **Parte 4 "Los distintos caminos"** coincide con lo que hoy hace `active-orchestrator` al arrancar: recomienda **ruta directa** o **fundación** (ver §9.2). Conviene que todo el equipo vea los videos igual.

---

## 2. ⚠️ Alertas importantes (leer primero)

1. **Cantidad de integrantes.** Las dos versiones de la consigna dicen *"Individual o en grupo de **hasta 3 integrantes**"*. Somos **6**: **el profesor confirmó el grupo de 6** (21/11/2026).
2. **Hay dos versiones de la consigna.** La del campus dice: *"cada integrante debe ser responsable de al menos una etapa"*. La versión local (docx) cambia esa parte y agrega responsabilidades al **líder** (ver §3.4). Seguimos la **versión local** porque es la más nueva y es la que el profe nos pasó, pero cumpliendo también la del campus: **cada integrante tiene que conducir al menos una etapa o un change** y explicarlo en el video.
3. **El zip local de Active Stack está desactualizado** (28/09/2026, sin comando `update`, sin soporte nuevo de Claude). **No usar el zip**: clonar el repo actual de GitHub o bajar el instalador de Releases.
4. **En Claude Code cambió cómo se llama al coordinador.** En la versión actual de Active Stack, el orquestador SDD es una **skill** que se invoca a mano: **`/sdd-orchestrator`** (la sesión normal ya no coordina sola). Hay que volver a invocarla después de un `/compact`.
5. **En Claude Code el orquestador de fundación se escribe con espacio**, no con dos puntos: **`/active-orchestrator init`** (también `/active-orchestrator kb`, `/active-orchestrator discovery`, etc.).
6. **OpenSpec 2.x renombró los comandos.** Los videos usan `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:archive` (OpenSpec 1.x). En 2.x son **`/openspec-explore`, `/openspec-propose`, `/openspec-apply-change`, `/openspec-archive-change`**, y **`/openspec-verify-change`** solo aparece con el perfil expandido (`openspec config profile` + `openspec update`). Usar el que `openspec init` muestre en pantalla.
7. **La fundación hoy es un "checklist" seleccionable**, no siete pasos fijos. Para el global **hay que marcar todo**: Discovery, KB, Roadmap, Find Skill, Skill Registry y Agent Instruction. La etapa visual (`visual-design`) se puede poner en **`off`** (no hace falta interfaz gráfica). Task management: **`local`**.
8. **Ruta del Discovery.** La skill `discovery-research` escribe por defecto en `discovery/discovery.md`. La consigna exige `docs/discovery/informe-discovery.md` + PDF + el checklist de 11 puntos **en la misma carpeta**. Por eso, al aprobar el plan se le indica que escriba directamente en `docs/discovery/` (informe, `discovery.md` y `sources/`); así kb-creator lo lee en modo silencioso y no hay que mover nada.
12. **OpenSpec init no es una fase de la fundación v2.6.** El catálogo de `active-orchestrator` v2.6 no incluye `openspec init` (los videos sí lo muestran). Se corre a mano al empezar la Etapa 1: `openspec init --tools claude --scope global`, con su propio commit. El perfil de OpenSpec instalado es `core`: no trae `/openspec-verify-change`, así que verify = correr los tests y documentar la salida.
13. **Bitácora y evidencias fuera de `docs/`.** `kb-creator` en modo import lee todo `docs/` como fuente del producto. La bitácora (`evidencias/bitacora-decisiones.md`) y las capturas (`evidencias/etapa-N/`) van en `evidencias/`.
9. **Fecha de entrega muy cercana:** 25/11/2026 23:00. Hay **6 días**. El Discovery es "el corazón del trabajo" y vale 35 puntos (25 + 10 de verificación): empezar **ya**.
10. **Datos de pacientes:** **nunca** datos reales. Todo ficticio (nombres, DNI, teléfonos, capturas).
11. **Sin secretos en el repo:** nada de API keys ni tokens. El harness `permissions` de Active Stack ya bloquea `.env`, igual hay que revisar antes de cada push.

---

## 3. La consigna completa

### 3.1 Objetivo general

Recorrer de principio a fin, sobre un producto real, el flujo de los videos de SDD con OpenSpec y de Active Stack:

1. Partir de una **idea sin código**.
2. Investigarla con método (**Discovery**).
3. **Fundar** el proyecto con un agente de IA (base de conocimiento, roadmap y reglas del agente).
4. Llevar una funcionalidad desde su **especificación hasta su archivado** con un **ciclo OPSX completo**.

**Producto:** sistema de gestión de turnos y agenda de pacientes para consultorios odontológicos, mercado argentino. No se programa "lo que se nos ocurra": se decide qué construir **a partir de evidencia verificable**, y se demuestra que **cada decisión quedó registrada y es trazable**.

### 3.2 Punto de partida (se da por sabido)

- **Video SDD + OpenSpec:** qué es una especificación, escenarios verificables y el ciclo `explore → propose → apply → archive`.
- **Active Stack (partes 1, 2 y 3):** harnesses, modos de instalación (Lite/Full/Custom), `/active-orchestrator`, las siete etapas de la fundación, el protocolo de inspección (Continuar / Ajustar / Parar acá), la bitácora compartida, el ciclo OPSX y Engram.

### 3.3 Marco teórico

| Concepto | Aplicación en este trabajo |
|---|---|
| **Discovery** | Convierte "tengo una idea" en "sé qué voy a construir y por qué", antes de decidir arquitectura. Acá se resuelve con una investigación de mercado exhaustiva y verificable. |
| **Harness** | Andamiaje que rodea al modelo (skills, configuración, herramientas externas). Active Stack instala ese andamiaje sobre el proyecto. |
| **Fundación del proyecto** | Las siete etapas de `/active-orchestrator`: OpenSpec Init, Discovery, KB Creator, Roadmap Generator, Find Skill, Skill Registry y Agent Instruction. |
| **Knowledge-base y CHANGES.md** | Mapa de contexto del proyecto y plan de implementación. De ellos sale la lista de changes de la cual se elige el que se implementa. |
| **Protocolo de inspección** | Al final de cada etapa se decide entre **Continuar, Ajustar o Parar acá**. Se evalúa que hayan **leído lo generado y corregido lo que estaba mal**, no que hayan avanzado. |
| **Ciclo OPSX** | Explore, propose, apply, verify y archive sobre un cambio concreto. **La especificación aprobada en propose es el contrato de la implementación.** |
| **Engram** | Memoria persistente del agente entre sesiones. Hay que mostrar qué quedó guardado y cómo se recupera. |

### 3.4 Modalidad y organización

**Versión campus (PDF):**
- Individual o grupo de hasta 3. Todos participan en alguna parte del flujo.
- En grupo, **cada integrante es responsable de al menos una etapa** de la fundación o del ciclo OPSX (ej.: uno Discovery, otro KB + Roadmap, otro el change). Ser responsable = conducir esa etapa con el agente, revisar lo generado y decidir Continuar/Ajustar.

**Versión local (docx) — agrega para el LÍDER:**
- **El líder es responsable de la etapa de la fundación y del ciclo OPSX** (ej.: lleva Discovery, KB + Roadmap, hasta llegar al primer change). Responsable = conducir la etapa con el agente, revisar lo generado y decidir Continuar/Ajustar.
- **Crear un repositorio con las ramas correspondientes para cada miembro** del grupo y **manejar la rama master**, para **controlar los PR de cada change** que suban los miembros.
- **Dirigir la secuencialidad de los changes y el paralelismo** que muestre el Roadmap (`CHANGES.md`).

**Común a ambas:**
- La participación de cada integrante tiene que ser **demostrable**: aparece en la **reflexión escrita**, en el **historial de commits** (cada persona con sus propios commits) y **cada uno habla en el video**.
- **Un único repositorio y una única entrega** por grupo.

### 3.5 Caso práctico — las 8 etapas (0 a 7)

> Las etapas 1 a 5 = fundación (las siete etapas de `/active-orchestrator` agrupadas). Etapa 6 = ciclo OPSX. Etapa 7 = evidencia y memoria. **No avanzar sin revisar la anterior.** En cada etapa usar el protocolo de inspección y **anotar qué decidieron y por qué** (bitácora de decisiones → sirve para la reflexión y el video).

#### Etapa 0 — Preparación del entorno
- Herramientas previas: **Go, Git y Node** instalados, y un agente de código (**OpenCode o Claude Code**) funcionando.
- **Active Stack en modo Full:** clonar `github.com/Group-Active-IA/active-stack`, ejecutar `build.bat` (Windows) o `build.sh` (Linux/macOS) y correr el instalador eligiendo **Full** (como en la Parte 1).
- **Repositorio nuevo y vacío** (Git inicializado, sin código previo). Nombre sugerido: **`turnos-odontologia`**.
- **Evidencia:** captura del instalador finalizado y de la lista de harnesses instalados.

#### Etapa 1 — Iniciar la fundación (`/active-orchestrator` y `openspec init`)
- Ejecutar `/active-orchestrator` dentro del repo vacío. Debe correr primero `openspec init` (estructura base de OpenSpec).
- En la bifurcación "¿hacemos estudio de mercado?" responder **Sí** (se decide una sola vez; el Discovery es obligatorio).
- **Evidencia:** el archivo `.active-orchestrator-state.json` con la etapa completada (**se incluye en el repo**).

#### Etapa 2 — Discovery: investigación de mercado (el corazón del trabajo)
- Se ejecuta con la skill **`discovery-research`**, que responde un checklist de **11 puntos**: problema, usuarios, casos de uso, competidores, funcionalidades necesarias, funcionalidades opcionales, reglas de negocio, integraciones, restricciones, riesgos y preguntas abiertas.
- Si se le pasan URLs de competidores, puede delegar en **`web-scraper`** para investigarlas antes de preguntar.
- **Además**, encargar al agente esta investigación **tal cual está redactada** (copiar y pegar):

```text
Actuá como analista sénior de mercado y producto SaaS especializado en salud digital y odontología en Argentina y Latinoamérica.

Objetivo: realizar una búsqueda exhaustiva de sistemas odontológicos que permitan gestionar turnos y agenda de pacientes. El propósito es identificar soluciones existentes, comparar sus funcionalidades y detectar oportunidades para desarrollar un producto competitivo.

Alcance geográfico y prioridad: Argentina; Latinoamérica; soluciones internacionales relevantes que puedan utilizarse o inspirar un producto para el mercado argentino.

Buscá exclusivamente fuentes verificables: sitios oficiales de cada proveedor, documentación pública, páginas de precios, centros de ayuda, videos oficiales, marketplaces confiables y reseñas verificadas. Indicá la URL y la fecha de consulta de cada fuente. No inventes funcionalidades: si una característica no está demostrada públicamente, consignála como "No evidenciado".

Para cada sistema identificado, relevá:
- Nombre del producto, empresa proveedora, país de origen y URL oficial.
- Segmento objetivo: odontólogo independiente, consultorio, clínica, cadena, centro multidisciplinario o laboratorio.
- Modalidad: SaaS, nube, aplicación móvil, instalación local o híbrida.
- Gestión de agenda: vista diaria/semanal, múltiples profesionales, múltiples sillones o boxes, duración variable de prestaciones, bloqueos, sobreturnos y prevención de solapamientos.
- Turnos digitales: reserva online 24/7, enlace de reserva, web, redes sociales, chatbot, WhatsApp, confirmación, cancelación, reprogramación y lista de espera.
- Automatización: recordatorios, confirmaciones, seguimiento de ausentes, recuperación de pacientes, controles periódicos y campañas.
- Gestión odontológica: ficha clínica, anamnesis, odontograma, periodontograma, imágenes/radiografías, presupuestos y planes de tratamiento.
- Administración: caja, cobros, facturación, señas, Mercado Pago, obras sociales/prepagas, liquidaciones, reportes y métricas.
- Integraciones: WhatsApp Business API, Google Calendar, sitio web, APIs públicas, Mercado Pago, AFIP/ARCA, radiología, firma digital y herramientas de marketing.
- Operación: sucursales, roles y permisos, auditoría, exportación de datos, soporte y capacitación.
- Seguridad y cumplimiento: datos sensibles de salud, privacidad, trazabilidad, respaldo, control de acceso y adecuación declarada a la normativa argentina aplicable.
- Modelo comercial: prueba gratuita, plan gratuito, precios publicados, moneda, modalidad de cobro y costos adicionales visibles.
- Fortalezas, limitaciones y diferenciales evidentes.
- Evidencia de adopción: casos de éxito, cantidad de clientes solo si está publicada y reseñas verificables.

Presentá el resultado en cuatro secciones:
A. Tabla comparativa de al menos 15 sistemas, ordenados por relevancia para Argentina.
B. Matriz de puntuación de 0 a 5, con estos pesos: Gestión de turnos y automatización, 25 %; Funcionalidad odontológica clínica, 20 %; Integraciones locales y WhatsApp, 15 %; Administración, cobros y facturación, 15 %; Experiencia del paciente, 10 %; Seguridad, exportación y trazabilidad, 10 %; Precio y facilidad de adopción, 5 %.
C. Análisis competitivo: funcionalidades que ya son estándar de mercado; funcionalidades diferenciadoras reales; vacíos frecuentes del mercado argentino; oportunidades de innovación para un nuevo sistema de gestión odontológica.
D. Recomendación final: cinco competidores prioritarios para analizar mediante demo; tres productos de referencia para experiencia de usuario; un MVP sugerido con funcionalidades imprescindibles, diferenciadores y funcionalidades a dejar para etapas posteriores.

Redactá en español formal, con criterio crítico. Diferenciá siempre entre una funcionalidad comprobada y una afirmación comercial del proveedor.
```

**Pesos de la matriz B (para chequear la cuenta):**

| Criterio | Peso |
|---|---|
| Gestión de turnos y automatización | 25 % |
| Funcionalidad odontológica clínica | 20 % |
| Integraciones locales y WhatsApp | 15 % |
| Administración, cobros y facturación | 15 % |
| Experiencia del paciente | 10 % |
| Seguridad, exportación y trazabilidad | 10 % |
| Precio y facilidad de adopción | 5 % |
| **Total** | **100 %** |

Total ponderado = Σ (nota 0–5 × peso). Máximo posible = 5,00.

**Verificación de fuentes (se evalúa, 10 pts):** "Un agente de IA no deja huecos sin resolver: si no encuentra un dato, tiende a inventarlo."
- Abrir y comprobar **personalmente al menos 5 fuentes** citadas, **una de cada tipo** (sitio oficial, página de precios, centro de ayuda, video oficial, marketplace/reseña…). Para cada una anotar si lo que afirma el informe **realmente está en esa URL**.
- Toda celda sin respaldo público dice **"No evidenciado"** (no vacía, no deducida).
- Si hay una afirmación falsa o no respaldada: **corregirla con Ajustar** y **registrar el hallazgo** (va a la reflexión).

**Entregable de la etapa:** `docs/discovery/informe-discovery.md` **y su PDF**, con secciones A, B, C, D + sección final **"Verificación de fuentes"**. El resultado estructurado de `discovery-research` (checklist de 11 puntos) se guarda **en la misma carpeta**. Guardarlo en el repo es clave: **es el insumo que lee la etapa siguiente**.

#### Etapa 3 — Base de conocimiento (`kb-creator`)
- Al existir documentación en `docs/`, la skill puede trabajar en **modo silencioso**; si pregunta (modo interactivo), responder **con criterio y en base a lo investigado**.
- Resultado: `knowledge-base/` con los **10 archivos canónicos**: visión, descripción, actores, modelos de datos, reglas de negocio, features, flujos, arquitectura, decisiones y preguntas abiertas.
- **Revisión obligatoria (Ajustar si corresponde):**
  - La KB refleja el Discovery (competidores, MVP recomendado, vacíos del mercado), **no un producto genérico**.
  - Las **reglas de negocio incluyen las de agenda**: duración de prestaciones, sillones o boxes, prevención de solapamientos.
  - "Preguntas abiertas" contiene **los puntos que el Discovery dejó como "No evidenciado"**.

#### Etapa 4 — Roadmap (`roadmap-generator`)
- Generar `CHANGES.md` desde la KB: dependencias entre tareas, asignación con contexto suficiente, camino crítico y riesgos.
- **Revisión obligatoria:** alineado con el **MVP de la sección D**. Si incluye cosas que el Discovery dejó para etapas posteriores, o si omite una imprescindible → **Ajustar**.

#### Etapa 5 — Skills y reglas del agente (`find-skill`, `skill-registry`, `agent-instruction`)
- **find-skill:** solo recomienda. Elegir qué instalar (o ninguna) y **justificar en una línea cada recomendación**.
- **skill-registry:** debe quedar `.atl/skill-registry.md`.
- **agent-instruction:** la única etapa realmente interactiva. **Revisar cada regla candidata** antes de confirmarla; deben quedar **`AGENTS.md` y `CLAUDE.md` en la raíz**. **Agregar a mano al menos una regla propia del dominio** (ej.: "nunca almacenar datos reales de pacientes en el repositorio ni en los ejemplos").

#### Etapa 6 — Ciclo OPSX sobre un change (explore → propose → apply → verify → archive)
Elegir **un único change** de `CHANGES.md` y llevarlo por el ciclo completo.

**Cómo elegir el change:**
- Pertenece al **MVP** recomendado en la sección D.
- Tiene **reglas de negocio verificables**. Recomendado: **"Crear un turno evitando solapamientos por profesional y por sillón/box"**. Otros válidos: "Reprogramar un turno", "Cancelar un turno y liberar el horario".
- **Chico**: una sola funcionalidad, no un módulo.
- La elección se **justifica por escrito (2–3 líneas) en `proposal.md`**.

**Las cinco fases:**
1. **Explore:** relevar el problema y el estado del código antes de proponer. **Guardar el resultado o un resumen.**
2. **Propose:** generar `proposal.md`, `design.md`, `specs/` y `tasks.md`. Escenarios **dado / cuando / entonces**, **mínimo 3**: uno **feliz**, uno de **error de negocio** y uno de **borde** (ej.: un turno que empieza justo cuando termina otro). **No aprobar a la primera**: leer el spec completo y **Ajustar** si el alcance quedó de más, de menos o inventado.
3. **Apply:** implementar contra el spec aprobado, **sin decisiones de diseño improvisadas**. Si algo no estaba en el spec → **volver a Propose**. Stack libre (según la KB). Puede ser API o módulo con lógica de dominio; **no hace falta interfaz gráfica**.
4. **Verify:** correr tests y health checks. **Tests automatizados que cubran cada escenario del spec.** **No se pasa a Archive con algo en rojo.** Si no hay comando de verify, correr la suite a mano y **documentar el resultado**.
5. **Archive:** cerrar el ciclo. Change archivado y estado del proyecto actualizado.

#### Etapa 7 — Memoria del agente (Engram)
- Mostrar qué quedó guardado en Engram (decisiones, hallazgos, convenciones).
- Hacer una **consulta real** que recupere contexto de una sesión anterior y explicar cómo evita que el agente arranque de cero. **Se muestra en el video.**

### 3.6 Consideraciones (reglas de juego)

- ✅ **Uso responsable de la IA:** el agente es herramienta, no autor. Todo lo entregado tiene que estar leído, entendido y validado por nosotros.
- ✅ **Verificar antes de confiar:** URLs, precios y funcionalidades pueden cambiar o estar mal citados. **Fecha de consulta obligatoria.**
- ✅ **No aprobar en automático:** el tiempo que se ajusta al principio se ahorra al implementar.
- ✅ **Datos de pacientes:** nada real. Ejemplos, pruebas y capturas con datos ficticios.
- ✅ **Independencia de los productos analizados:** fines educativos; **no se contactan proveedores ni se crean cuentas** con datos personales reales.
- ✅ **Autoría:** trabajo propio. El uso de IA se declara y se explica en la reflexión.
- ✅ **Alcance realista:** mejor un change bien especificado, probado y archivado que varios a medias.

### 3.7 Conclusiones esperadas

- Conducir un proyecto desde una idea hasta una funcionalidad terminada, con cada decisión respaldada por evidencia y registrada en archivos versionables.
- Distinguir información verificada de información plausible generada por un agente, y saber comprobarla.
- Usar el protocolo de inspección con criterio propio (corregir temprano es más barato).
- Experimentar que una especificación aprobada funciona como contrato de implementación y se verifica con tests.
- Reconocer el rol de la memoria persistente y de las reglas del agente (`AGENTS.md`) para sostener el trabajo entre sesiones.

---

## 4. Criterios de evaluación (100 puntos)

| Criterio | Qué se observa | Puntos |
|---|---|---|
| **Informe de Discovery** | Completitud de A–D, **≥15 sistemas**, fuentes con **URL y fecha**, uso correcto de **"No evidenciado"**, distinción **comprobado vs. comercial**, criterio crítico en C y D. | **25** |
| **Verificación de fuentes** | Comprobaron personalmente **≥5 fuentes** y corrigieron lo no respaldado. | **10** |
| **Fundación del proyecto** | KB coherente con el Discovery, roadmap alineado con el MVP, `AGENTS.md`/`CLAUDE.md` con reglas revisadas, registro de skills generado. | **20** |
| **Change OPSX** | Elección justificada, spec con **≥3 escenarios** verificables, implementación fiel al spec, **tests por escenario en verde**, change **archivado**. | **25** |
| **Video de defensa** | Claridad, proceso real, **participación de todos**, evidencia de **Engram**. | **10** |
| **Reflexión escrita** | Honestidad y profundidad; evidencia de uso real del protocolo de inspección. | **5** |
| **Trazabilidad y participación** | Historial de commits con el proceso, README reproducible, sin secretos, aporte individual demostrable. | **5** |
| **Total** | | **100** |

👉 **Discovery + verificación = 35 pts** y **Change OPSX = 25 pts**: ahí va el grueso del esfuerzo.

---

## 5. Entregables y estructura del repositorio

### 5.1 Los 4 entregables

1. **Repositorio** (link o .zip).
2. **Informe de Discovery (PDF).**
3. **Video de defensa (8 a 12 minutos).**
4. **Reflexión escrita (1 a 2 páginas).**

### 5.2 Estructura mínima del repositorio

```
turnos-odontologia/
├── AGENTS.md
├── CLAUDE.md
├── CHANGES.md
├── .active-orchestrator-state.json
├── .atl/
│   └── skill-registry.md
├── docs/
│   └── discovery/
│       ├── informe-discovery.md
│       ├── informe-discovery.pdf
│       └── (checklist de 11 puntos de discovery-research)
├── knowledge-base/            (los 10 archivos canónicos)
├── openspec/
│   ├── specs/                 (specs vigentes)
│   └── changes/
│       └── archive/
│           └── AAAA-MM-DD-crear-turno-sin-solapamientos/
│               ├── proposal.md
│               ├── design.md
│               ├── tasks.md
│               └── specs/
├── src/                       (implementación del change)
├── tests/                     (tests de cada escenario)
├── evidencias/                (bitácora de decisiones y capturas por etapa)
├── CONTRIBUTING.md            (flujo de ramas, PR y reglas de paralelismo)
└── README.md                  (cómo instalar y correr los tests)
```

(Los nombres exactos pueden variar según la versión de cada skill; lo importante es que estén **todos los elementos**.)

**Requisitos del repo:**
- Se puede **clonar y correr los tests siguiendo solo el `README.md`**.
- El historial de commits muestra **el proceso** (fundación, discovery, change), **no un único commit final**. Cada integrante con **commits propios**.
- **Sin secretos**: ninguna API key ni credencial.

### 5.3 Informe de Discovery (PDF) — orden obligatorio

1. **Portada** (título, materia, integrantes, fecha).
2. **Resumen ejecutivo** (máx. 1 página): qué se investigó, hallazgos principales, MVP recomendado.
3. **A. Tabla comparativa** de ≥15 sistemas, ordenada por relevancia para Argentina. Cada fila: nombre, proveedor, país, URL oficial y **fecha de consulta**. Celdas sin evidencia: **"No evidenciado"**. Formato ejemplo:

| Producto / Proveedor | País · Segmento | Reserva online | Recordatorios | Fuente y fecha |
|---|---|---|---|---|
| [Producto ejemplo] [Empresa] | [País] · Consultorio | Comprobado (enlace público de reserva) | No evidenciado | [URL del centro de ayuda] · consultada el AAAA-MM-DD |

4. **B. Matriz de puntuación** 0–5 con los pesos y el **total ponderado** por sistema + **nota metodológica** (qué significa cada nota y cómo se trataron los "No evidenciado").
5. **C. Análisis competitivo** en 4 subsecciones: estándar de mercado, diferenciadores reales, vacíos del mercado argentino, oportunidades de innovación.
6. **D. Recomendación final:** 5 competidores para demo, 3 productos de referencia de UX y el **MVP en tres listas**: imprescindible, diferenciador y etapas posteriores.
7. **Verificación de fuentes:** las ≥5 fuentes comprobadas, qué afirmaba el informe, qué encontraron y qué corrigieron.
8. **Referencias completas.**

En todo el informe distinguir **"funcionalidad comprobada"** (la muestra el producto, la documentación o un video oficial) de **"afirmación comercial"** (lo dice el proveedor sin demostrarlo). *Un informe claro y bien fundado vale más que uno largo.*

### 5.4 Video de defensa (8 a 12 min)

- **Todos aparecen y hablan.** Cámara encendida al menos en la presentación de cada uno.
- **Orden sugerido:**
  1. Qué producto eligieron y qué concluyó el Discovery, con el MVP recomendado.
  2. Recorrido por el repo: knowledge-base, roadmap y `AGENTS.md`.
  3. El change elegido, mostrando **el momento real en que revisaron Propose y qué corrigieron con Ajustar**.
  4. Apply/Verify: **los tests pasando**.
  5. Archive y estado final.
  6. **Consulta a Engram.**
  7. Conclusiones.
- Se muestra **la pantalla trabajando de verdad**, no solo diapositivas.
- **Cada integrante explica la etapa de la que fue responsable.**

👉 **Grabar pantalla desde el primer día** (OBS o la grabadora de Windows `Win+Alt+R`) para tener material real de Propose/Ajustar.

### 5.5 Reflexión escrita (1 a 2 páginas, escrita por nosotros, **no** por el agente)

Debe responder:
1. ¿Qué información del Discovery resultó **incorrecta, no verificable o inventada** por el agente? ¿Cómo lo detectaron?
2. ¿En qué etapa usaron **Ajustar**, qué estaba mal y qué habría pasado si hubieran apretado **Continuar**?
3. ¿Qué diferencia notaron entre implementar con una **especificación aprobada** y pedir código con un **prompt suelto**?
4. ¿Qué parte de la fundación (KB, roadmap, reglas) le aportó **más valor** al ciclo OPSX y cuál **menos**?
5. En grupo: **qué hizo cada integrante y en qué etapa**.

👉 Para poder responderla, llevar una **bitácora de decisiones** (`evidencias/bitacora-decisiones.md`, ya creada en el repo) desde el día 1: fecha, etapa, quién, qué generó el agente, qué decidimos (Continuar/Ajustar/Parar) y por qué.

---

## 6. Metodología: Spec-Driven Development (SDD)

### 6.1 El problema: vibe coding

- **Contexto:** toda la información que el agente tiene disponible en un momento (lo que lee, recibe, genera y usa). Se mide en **tokens**. Cada modelo tiene una **ventana de contexto máxima**: lo que no entra, el agente no lo ve.
- **Vibe coding:** programar con prompts sueltos, sin especificación ni registro de decisiones. Tres problemas:
  1. **Contexto insuficiente o saturado** (sesión muy larga = pierde precisión; muy corta = le falta info).
  2. **Sin memoria de lo realizado** (hay que re-explicar todo cada sesión).
  3. **Alucinaciones** (información falsa presentada como verdadera; ej.: dice que implementó algo que no hizo).

### 6.2 Principio central

> **"Un agente no deja huecos sin resolver: los rellena."**
> Lo que no está especificado, lo decide el agente con el criterio que tenga a mano. El mismo prompt corrido dos veces puede dar decisiones distintas. Sin especificación no hay forma de verificar ni reproducir. **Si no lo declarás vos, lo decide el agente.**

### 6.3 Especificación

Comportamiento verificable frente a situaciones concretas:
1. **El requisito:** qué tiene que garantizar el sistema (declarativo, sin importar cómo se implementa).
2. **El escenario + la acción:** la situación concreta y qué hace el sistema en ese caso.

Ejemplo de las diapositivas:
```
Requisito: Autenticación de usuarios
Escenario: Contraseña incorrecta
  CUANDO el usuario ingresa un mail válido pero contraseña incorrecta
  ENTONCES el sistema muestra "Credenciales inválidas" y no inicia sesión
```
- **CUANDO:** la situación concreta (input exacto o acción del usuario).
- **ENTONCES:** la respuesta esperada — **observable, verificable y no ambigua**.
- La consigna pide formato **dado / cuando / entonces** (GIVEN/WHEN/THEN): el "dado" fija el estado previo (ej.: "dado un turno del Dr. X de 10:00 a 10:30 en el sillón 1").

Ejemplo aplicado a nuestro change (orientativo, el real lo genera Propose y lo revisamos):
```
Requisito: Crear turno sin solapamientos por profesional y por sillón

Escenario feliz:
  DADO que la Dra. Pérez no tiene turnos el 02/12 de 10:00 a 10:30 y el sillón 1 está libre
  CUANDO se crea un turno para la Dra. Pérez, sillón 1, 02/12 10:00, prestación de 30 min
  ENTONCES el turno queda registrado con estado "reservado"

Escenario error de negocio:
  DADO un turno de la Dra. Pérez el 02/12 de 10:00 a 10:30
  CUANDO se intenta crear otro turno para la Dra. Pérez el 02/12 a las 10:15
  ENTONCES el sistema rechaza el turno indicando solapamiento con el profesional

Escenario de borde:
  DADO un turno en el sillón 1 el 02/12 de 10:00 a 10:30
  CUANDO se crea un turno en el sillón 1 el 02/12 a las 10:30
  ENTONCES el turno se registra (los intervalos [inicio, fin) no se solapan)
```

### 6.4 SDD vs. vibe coding

| Vibe coding | Spec-Driven Development |
|---|---|
| Prompts sueltos | Archivos declarativos (propuesta, specs, diseño) |
| Sin registro | Memoria del estado |
| Sin memoria | Decisiones trazables |
| Sin verificación posible | Verificación por escenarios |

SDD = desarrollar un sistema siguiendo lo que se declara en los archivos del proyecto. Deja memoria de avances y estado entre sesiones: el agente siempre sabe desde dónde continuar.

---

## 7. OpenSpec (el CLI de SDD)

### 7.1 Qué es y qué no es

- **Es** un CLI ligero (paquete npm `@fission-ai/openspec`, licencia MIT) que funciona como **la única fuente de verdad del estado de los cambios**. Guarda propuestas, diseños y tareas como archivos de texto dentro de `openspec/` (versionables con Git).
- **No es** un agente: trabaja **junto** al agente (Claude Code, OpenCode, Codex…, +30 herramientas).
- **Init ≠ install:** instalar el CLI es un paso previo; `openspec init` lo inicializa sobre un proyecto e instala las skills/comandos en el agente que detecta.

### 7.2 Instalación (la hace Active Stack; manual por si falla)

```powershell
# Windows (PowerShell) — instalador oficial
irm https://openspec.dev/cli/install.ps1 | iex
# o con npm (requiere Node.js 22.20.0 o superior)
npm install -g @fission-ai/openspec@latest
```

### 7.3 Estructura que genera

```
openspec/
├── specs/                      ← specs vigentes (fuente de verdad del sistema)
│   └── <capacidad>/spec.md
└── changes/
    ├── <nombre-del-change>/    ← un change en curso
    │   ├── .openspec.yaml      ← metadata (la crea el CLI)
    │   ├── proposal.md         ← QUÉ y POR QUÉ
    │   ├── design.md           ← CÓMO (decisiones técnicas)
    │   ├── tasks.md            ← checklist de implementación
    │   └── specs/              ← delta specs (requisitos + escenarios)
    └── archive/
        └── AAAA-MM-DD-<nombre>/  ← changes cerrados
```

Formato de spec (Markdown plano):
```markdown
## ADDED Requirements

### Requirement: Theme selection
The app SHALL let users switch between light and dark themes, defaulting to the system preference.

#### Scenario: User toggles dark mode
- **WHEN** the user clicks the theme toggle
- **THEN** the app switches to dark mode and persists the choice
```

### 7.4 Comandos

**Comandos del agente (dentro de Claude Code):**

| Fase | OpenSpec 1.x (videos) | OpenSpec 2.x (actual) | Qué hace |
|---|---|---|---|
| Explorar | `/opsx:explore` | `/openspec-explore` | Modo pensamiento: analiza, propone alternativas, **no escribe archivos**. Opcional. |
| Proponer | `/opsx:propose <nombre>` | `/openspec-propose <nombre>` | Crea el change y todos sus artefactos. |
| Implementar | `/opsx:apply` | `/openspec-apply-change` | Ejecuta `tasks.md` y marca `[x]` a medida que avanza. |
| Verificar | — | `/openspec-verify-change` *(perfil expandido)* | Verifica la implementación contra el change. |
| Archivar | `/opsx:archive` | `/openspec-archive-change` | Sincroniza `openspec/specs/` y mueve el change a `archive/`. |

> Usar los nombres que imprima `openspec init` en tu instalación. Si no hay comando de verify, **correr los tests a mano y documentar** (lo permite la consigna).

**Comandos de terminal:**

```bash
openspec init                                    # inicializa openspec/ en el proyecto
openspec list --json                             # changes activos
openspec status --change "<nombre>" --json       # estado y artefactos de un change
openspec new change "<nombre>"                   # crea un change vacío
openspec instructions <artefacto> --change "<nombre>" --json
openspec instructions apply --change "<nombre>" --json
openspec config profile                          # elegir perfil (expandido = verify, onboard, etc.)
openspec update                                  # refresca las skills instaladas en el agente
openspec config set telemetry.enabled false      # desactivar telemetría anónima (opcional)
```

### 7.5 Reglas del orquestador respecto a OpenSpec

- **Nunca adivinar el estado:** siempre `openspec status` primero.
- **Nunca crear `openspec/` a mano:** usar el CLI.
- **OPSX es fluido:** no hay fases bloqueantes, cualquier acción puede correr en cualquier momento (pero **la consigna sí exige** el orden explore → propose → apply → verify → archive y no archivar en rojo).

---

## 8. Active Stack: qué es y qué trae

### 8.1 Definición

**Active Stack** (Group Active IA, autor Juan Cruz Robledo, licencia MIT) es un **instalador *methodology-first***: un único binario en Go que toma tu agente de IA (Claude Code, Codex, OpenCode, Antigravity) y le **inyecta**, de forma modular y actualizable, todo el sustrato que exige una metodología de desarrollo asistido por IA.

- **No es** un framework que corre en tu app: es un **configurador del entorno del agente**.
- **No es** code-reviewer en commit, ni instala themes/statusline/keybindings, ni es marketing.
- Frase central: **"Active Stack es un harness que instala harnesses."**

**Problema que resuelve:** preparar un agente para trabajar en serio es manual y disperso — memoria persistente, control de permisos, declaración de specs y skills a instalar se hacen a mano proyecto por proyecto. Active Stack lo arma **en un solo paso**.

### 8.2 Harness

> Cualquier módulo que prepara o guía el entorno del agente: una skill, una config o un binario external. **El agente no es solo el modelo**: es el modelo + todo el andamiaje (herramientas, reglas, memoria, permisos). Sin harnesses, el agente arranca **desnudo** — sin contexto, sin límites, sin método.

**Los tres tipos:**

| Tipo | Qué es | De dónde sale | Ejemplos |
|---|---|---|---|
| **skill** | Manual propio (`SKILL.md` + assets) que el agente lee para aprender una tarea; se carga bajo demanda | Repo propio o de terceros, **se clona al instalar** | active-orchestrator, kb-creator, roadmap-generator, find-skill |
| **config** | Texto/archivos que configuran directo al agente | **Empaquetado en el binario** (sin descarga) | SDD Orchestrator, Permissions |
| **external** | Binario/servicio de terceros | Se instala/configura aparte (npm, Homebrew, MCP) | OpenSpec CLI, Engram, Context7 |

### 8.3 Modos de instalación

| Modo | Qué instala | Para qué |
|---|---|---|
| **Lite** | Sustrato mínimo: `openspec`, `engram`, `context7`, `sdd-orchestrator`, `permissions` | Empezar con la metodología ya |
| **Full** ✅ *(el que pide la consigna)* | Lite + fundación guiada: `active-orchestrator`, `discovery-research`, `web-scraper`, `kb-creator`, `roadmap-generator`, `agent-instruction`, `skill-registry`, `find-skill`, `skill-creator` (+ en la versión actual: `design-system`, Playwright MCP, skills visuales) | Ecosistema completo, proyecto desde cero |
| **Custom** | Elegís cada harness | Control total |

🔒 **`permissions` no se puede desactivar** en ningún modo (seguridad primero).

### 8.4 Catálogo de harnesses (fuente: `internal/catalog/harnesses.yaml`)

| Harness | Tipo | Modo | Qué hace |
|---|---|---|---|
| **OpenSpec CLI** | external (npm `@fission-ai/openspec`) | lite·full | CLI de SDD; fuente de verdad del estado de cada change. |
| **Engram** | external (Homebrew `gentleman-programming/tap/engram`, MCP `engram`) | lite·full | Memoria persistente local (SQLite + búsqueda full-text) vía MCP. |
| **Context7** | external (MCP remoto `npx @upstash/context7-mcp`) | lite·full | Documentación de librerías al día, en vez de lo que el modelo "recuerda". |
| **SDD Orchestrator** | config | lite·full | Convierte al agente en coordinador SDD. Toggles: `tdd`, `engram`, `model-routing`, `delegation`, `governance`. |
| **Permissions** | config | lite·full | Permisos seguros: bloquea archivos sensibles (`.env`), pide confirmación en git destructivo. Tiers: estricto / balanceado / bypass. **No opcional.** |
| **active-orchestrator** | skill (`Group-Active-IA/active-orchestrator`) | full | Orquesta la fundación (no ejecuta inline, delega). Depende de openspec. |
| **discovery-research** | skill | full | Discovery de 11 puntos antes de la KB. Depende de web-scraper. |
| **web-scraper** | skill | full | Convierte la URL de un competidor en una nota markdown comparable (problema, usuarios, features, pricing, posicionamiento). Sin API keys. |
| **kb-creator** | skill | full | Genera los 10 `.md` canónicos de `knowledge-base/`. |
| **roadmap-generator** | skill | full | Genera `CHANGES.md` (backlog técnico) desde la KB. |
| **agent-instruction** | skill (`JuanCruzRobledo/agent-instruction`) | full | Genera `AGENTS.md`/`CLAUDE.md` (stack, convenciones, reglas duras, mapa a KB y roadmap). |
| **skill-registry** | skill (`JuanCruzRobledo/skill-registry`) | full | Crea `.atl/skill-registry.md` con reglas compactas de cada skill. |
| **find-skill** | skill de terceros (`vercel-labs/skills`) | full | Busca y **recomienda** skills (no instala). Best-effort. |
| **skill-creator** | skill de terceros (`anthropics/skills`) | full | Crea skills nuevas siguiendo la spec de Agent Skills. |
| **design-system** *(versión actual)* | skill embebida | full | Política visual: `system-and-mockups`, `system-only`, `off`, `deferred`. **Para el global: `off`.** |
| **Playwright MCP** *(versión actual)* | external | full | Navegador para mostrar mockups y verificar UI. No lo necesitamos. |
| **starter-add-command** | command | lite·full | `/active:starter-add <starter>` en Claude → wrapper de `active-stack starter add`. |

**Starters** (bundles de skills que se agregan a un proyecto con `active-stack starter add <id>`):

| Starter | Contenido |
|---|---|
| `base` | TDD, debugging sistemático, pedir/recibir code review, excelencia en review, product owner ágil |
| `backend` | base + clean architecture, FastAPI, Alembic, Redis, WebSockets, pytest, PostgreSQL, seguridad de APIs, Docker multi-stage |
| `ux-ui` | base + React, Zustand, formularios React 19, dashboards CRUD, PWA, TypeScript avanzado, Tailwind, Playwright |
| `active-ia` | backend + ux-ui + monorepo |
| `tutor-tupad` | rúbricas + campus Moodle (para tutores; no aplica) |

### 8.5 Cómo instala (pipeline de 8 pasos)

1. **Detectar** OS, arquitectura, agentes, dependencias.
2. **Elegir** agente(s).
3. **Elegir modo** Lite / Full / Custom.
4. **Resolver catálogo** (árbol de dependencias).
5. **Backup** de configs existentes. 🛟
6. **Instalar** externals + harnesses.
7. **Inyectar configs** con *markers* idempotentes. 🧩
8. **Verificar** (health checks).

Garantías: **nunca pisa tu config sin backup** (snapshot + restore), **inyección idempotente** (reinstalar no duplica bloques), **rollback por etapas** si algo falla.

### 8.6 Comandos del binario

```bash
active-stack install                      # TUI interactiva: elegís agente y modo
active-stack install --dry-run            # muestra el plan sin ejecutar
active-stack install --mode full          # headless (no interactivo)
active-stack install --agent claude       # apuntar a un agente (claude, codex, opencode, antigravity)
active-stack install --help               # todos los flags
active-stack update --check               # compara versión con la última release
active-stack update                       # actualiza binario y reaplica la selección
active-stack update --skills-only         # refresca solo las skills
active-stack starter add <starter>        # agrega un starter al proyecto actual
active-stack --version
```
Pasar `--mode` o `--agent` activa el modo headless. En Windows, doble clic en el `.exe` abre la TUI.

### 8.7 Claude Code en la versión actual (importante)

- El coordinador OPSX es la **skill `/sdd-orchestrator`**: se invoca **a mano**; el modelo no la puede invocar solo. Las sesiones normales solo tienen un bloque de reglas universales en `CLAUDE.md` (`active-stack:universal-rules`).
- **Salir del modo coordinador:** abrir sesión nueva o `/clear`.
- **Después de `/compact`:** la skill no se re-engancha → **volver a escribir `/sdd-orchestrator`**.
- Se instala en `~/.claude/skills/sdd-orchestrator/` (Machine) o `<proyecto>/.claude/skills/sdd-orchestrator/` (Project).
- Requiere **Claude Code 2.1.110 o superior**; con versiones menores queda en "modo legado" (bloque único en `CLAUDE.md`).
- Asignación de modelos por fase (model routing): orquestador **opus**, explore **sonnet**, propose **opus**, apply **sonnet**, archive **haiku**, default **sonnet**. Si no hay acceso a Opus, usa sonnet.

### 8.8 Requisitos previos

| Dependencia | Para qué |
|---|---|
| **Go 1.26+** | Solo para compilar desde fuente (`build.bat`). No hace falta si usás el `.exe` de Releases. |
| **Git** | El instalador clona las skills. |
| **Node.js LTS** (≥ 22.20 para OpenSpec por npm) | Instala harnesses external por npm (OpenSpec). |
| **Agente de IA instalado** | Claude Code (nuestro caso). Sin agente no hay nada que configurar. |

### 8.9 Descargas

- Instalador gráfico Windows: `https://github.com/Group-Active-IA/active-stack/releases/latest/download/ActiveStack-Setup.exe`
- CLI Windows: `.../active-stack_windows_amd64.exe` · CLI Linux/WSL: `.../active-stack_linux_amd64`
- Hashes: `.../SHA256SUMS.txt`
- **SmartScreen:** el instalador no está firmado → "Más información" → "Ejecutar de todas formas" (verificar SHA256 antes).
- Landing: https://active-stack-landing.vercel.app

### 8.10 Por qué skills separadas ("gremios especializados, no un maestro todólogo")

- Un módulo gigante cargaría todo su manual al contexto aunque se use una parte; tocar una parte arriesga romper las demás.
- Skills separadas: cada una en su repo y con su versión; el agente solo carga el manual que usa; actualizar una no obliga a revalidar las otras. **La modularidad es lo que hace al sistema mantenible.**

---

## 9. La fundación del proyecto (las 7 etapas)

### 9.1 Panorama (como lo explican los videos)

| # | Etapa | Skill | Qué produce |
|---|---|---|---|
| 1 | **OpenSpec Init** | openspec | `openspec/` (estructura base) |
| 2 | **Discovery** *(opcional; obligatorio en el global)* | discovery-research (+ web-scraper) | Relevamiento de 11 puntos |
| 3 | **KB Creator** | kb-creator | `knowledge-base/` (10 archivos) |
| 4 | **Roadmap Generator** | roadmap-generator | `CHANGES.md` |
| 5 | **Find Skill** | find-skill | Tabla de recomendaciones |
| 6 | **Skill Registry** | skill-registry | `.atl/skill-registry.md` |
| 7 | **Agent Instruction** | agent-instruction | `AGENTS.md` + `CLAUDE.md` |

- `/active-orchestrator` **coordina, no ejecuta**: despacha cada etapa a una skill distinta. Se corre sobre un proyecto sin KB, sin roadmap y sin reglas.
- El flujo es **determinístico**: el único momento de decisión es la **bifurcación de Discovery**, que se elige **una sola vez** al inicio.
- **Ninguna etapa arranca sin que la anterior esté aprobada.**

### 9.2 Cómo funciona HOY (`active-orchestrator` v2.6)

1. **Selección de ruta** ("Los distintos caminos", Parte 4): pregunta duración esperada, continuidad y coordinación. Recomienda **ruta directa** (tarea acotada, ~1 día, sin archivos de fundación) o **fundación** (trabajo de varias sesiones/días, con traspasos o coordinación). **Para el global: elegir FUNDACIÓN.**
2. **Inspección read-only** del repo.
3. **Checklist único** con cada fase: propósito, artefactos, obligatoria/opcional, prerequisitos, variantes, archivos reutilizables. Se elige con multi-select o lista numerada (ej. `1=interview, 2=generate, ...`).
4. **Resumen del plan** con todo lo que va a escribir/instalar → **aprobación explícita** antes de escribir nada.
5. **Ejecuta** el plan, pausando en decisiones propias de cada fase (respuestas de discovery, instalación global de skills, reglas).

**Catálogo de fases y qué elegir para el global:**

| ID | ¿Obligatoria? | Skill | Variantes | ✅ Elegir |
|---|---|---|---|---|
| `discovery` | Opcional | discovery-research | interview, existing-sources, competitors, reuse | **SÍ** — `competitors` o `interview` (y pasarle URLs) |
| `kb` | Requerida | kb-creator | interview, import, reuse | `import` (lee `docs/`) |
| `visual-design` | Opcional | design-system | system-and-mockups, system-only, off, deferred, reuse | **`off`** |
| `roadmap` | Requerida | roadmap-generator | local-markdown, reuse | `local-markdown` |
| `task-management` | Opcional | active-orchestrator | local, clickup | `local` (u omitir) |
| `find-skill` | Opcional | find-skill | recommend, install-selected | **SÍ** — `recommend` (o `install-selected` si elegimos alguna) |
| `registry` | Opcional | skill-registry | index, reuse | **SÍ** — `index` |
| `agents` | Requerida | agent-instruction | generate, update, reuse | `generate` |

Orden: discovery → kb → (visual) → roadmap → (task-management) → find-skill → registry → agents.

**Comandos en Claude Code** (con espacio):

| Comando | Para qué |
|---|---|
| `/active-orchestrator init` | Elegir ruta o retomar un plan aprobado |
| `/active-orchestrator discovery` | Correr solo el Discovery |
| `/active-orchestrator kb` | Crear, importar o reutilizar la KB |
| `/active-orchestrator design` | Definir/revisar la política visual |
| `/active-orchestrator rules` | Generar/actualizar `AGENTS.md`/`CLAUDE.md` |
| `/active-orchestrator find-skill` | Buscar skills |
| `/active-orchestrator registry` | Indexar skills |

### 9.3 Protocolo de inspección

Cada etapa termina **mostrando exactamente qué se hizo** y espera una decisión explícita:

| Opción | Qué hace |
|---|---|
| **Continuar** | Avanza a la próxima etapa. Es la única que mueve el proceso. |
| **Ajustar** ⭐ | Rehace la etapa con el feedback que des. El estado no avanza hasta que estés conforme. **La más valiosa**, sobre todo en Propose. |
| **Parar acá** | Guarda el paso actual y se retoma después. No se pierde progreso. |

> **Regla de oro (Parte 3):** "Un spec mal revisado en Propose se arrastra directo a Apply — cuanto antes en el flujo se corrige, más barato sale." / "El tiempo que 'perdés' ajustando un spec en Propose es tiempo que te ahorrás en Apply."

### 9.4 La bitácora compartida: `.active-orchestrator-state.json`

- Único archivo que **comparten todas las skills** de la fundación; está en la raíz.
- **Lectura compartida, escritura aislada:** cada skill escribe **solo su sección**; puede leer la de otra (para no repreguntar).
- El orquestador solo toca `version`, `step` (paso actual), `owner` y su sección `foundation`.
- Versión 5 del archivo, con `foundation.phases.<fase>.status` = `pending` / `in_progress` / `done` / `failed` / `skipped` / `deferred`.
- Permite **retomar** después de una interrupción.
- **Va en el repositorio** (es evidencia de la Etapa 1).

Ejemplo:
```json
{
  "version": 5,
  "step": "kb",
  "owner": "active-orchestrator",
  "foundation": {
    "version": 1,
    "order": ["kb", "roadmap", "agents"],
    "phases": {
      "kb": {"variant": "import", "status": "pending", "requires": [], "outputs": ["knowledge-base/"]},
      "roadmap": {"variant": "local-markdown", "status": "pending", "requires": ["kb"], "outputs": ["CHANGES.md"]},
      "agents": {"variant": "generate", "status": "pending", "requires": ["kb", "roadmap"], "outputs": ["AGENTS.md"]}
    }
  }
}
```

### 9.5 Detalle de cada skill

**`discovery-research`** — "No completes un punto del checklist con una suposición cuando podés preguntarlo o investigarlo."
1. **Fuentes:** si hay URLs de competidores, invoca `web-scraper` por cada una.
2. **Checklist Q&A:** ronda de preguntas por los 11 puntos sin repreguntar lo ya scrapeado.
3. **Gate final:** resume y espera confirmación antes de escribir.
4. **Escribe** `discovery/discovery.md` + sección `discovery` del state. → En este proyecto se le indica escribir en `docs/discovery/` (ver alerta 8).

Los 11 puntos: 1) Problema, 2) Usuarios, 3) Casos de uso, 4) Competidores, 5) Funcionalidades necesarias, 6) Funcionalidades opcionales, 7) Reglas de negocio, 8) Integraciones, 9) Restricciones, 10) Riesgos, 11) Preguntas abiertas.

**`kb-creator`** — dos modos automáticos:
- **Modo A — silencioso:** si `docs/` tiene documentos fuente (`.txt`, `.docx`, `.pdf`, `.md`), genera la KB sin preguntar.
- **Modo B — interactivo:** si no hay docs, actúa como **arquitecto senior + product manager** y hace **3–5 preguntas estratégicas por ronda**.

Archivos (todos obligatorios):
```
knowledge-base/
├── README.md                      (índice + resumen ejecutivo)
├── 01_vision_y_objetivos.md
├── 02_descripcion_general.md      (incluye el STACK tecnológico)
├── 03_actores_y_roles.md
├── 04_modelo_de_datos.md
├── 05_reglas_de_negocio.md        ← revisar reglas de agenda
├── 06_funcionalidades.md
├── 07_flujos_principales.md
├── 08_arquitectura_propuesta.md
├── 09_decisiones_y_supuestos.md   (el porqué de cada elección)
├── 10_preguntas_abiertas.md       ← debe tener los "No evidenciado"
└── 11_xxx.md ...                  (extras opcionales del dominio)
```

**`roadmap-generator`** — *fire-and-forget* (no pregunta). Genera `CHANGES.md` con:
- **Árbol de dependencias** (ASCII).
- **Paralelismo por fase** con *gates* y asignación sugerida a agentes/personas.
- **Camino crítico** (mínimo irreducible de changes).
- **Plan óptimo con 3 agentes** (tabla paso × agente).
- Por cada change: estado `[ ]`/`[x]`, scope operacional, dependencias, **nivel de governance** y archivos de KB a **"Leer antes"**.

Reglas de dependencias: 1) infra primero (C-01 no depende de nada); 2) modelos core antes que features; 3) auth antes que recursos protegidos; 4) entidad referenciada antes que la que referencia; 5) backend antes que frontend acoplado; 6) integraciones externas (pagos, webhooks) al final; 7) admin/dashboards al final; 8) restyle visual al final del todo.

Niveles de governance del roadmap: **BAJO** (scaffolding, CRUD simples) · **MEDIO** (flujos con estado) · **ALTO** (notificaciones, roles, observabilidad) · **CRÍTICO** (auth, pagos, seguridad, audit trail, modelos core).

Formato de cada change:
```markdown
### [C-01] `foundation-setup`
- Estado: [ ] pendiente
- Scope: bullets operacionales
- Dependencias: ninguna
- Governance: BAJO
- Leer antes:
  - knowledge-base/01_vision_y_objetivos.md
```

**`find-skill`** — a partir del stack, dominios y problema de la KB, devuelve tabla: **nombre de la skill · fuente (repo) · por qué encaja**. **Nunca instala por su cuenta**; la decisión es del usuario (instalación con `npx skills add <repo> --skill <nombre> -g` solo si se aprueba).

**`skill-registry`** — escanea todas las carpetas de skills (globales y de proyecto; Claude Code, OpenCode, Gemini CLI, Cursor, Copilot). Por cada skill: resumen compacto de 5–15 líneas, solo reglas accionables. Todo en **`.atl/skill-registry.md`**. Los sub-agentes reciben esas reglas compactas sin releer cada `SKILL.md` (**Skill Resolver Protocol**: menos tokens, más precisión).

**`agent-instruction`** — la única fase realmente interactiva:
- Detecta el stack y propone **reglas duras candidatas** (ej.: `gofmt`/`go vet` en Go, prohibido `any` en TypeScript) → **las confirma con el usuario** antes de escribir.
- **Lee el `CLAUDE.md` global** instalado por Active Stack para no duplicar reglas universales.
- Genera **`AGENTS.md` y `CLAUDE.md`** en la raíz como **copia idéntica** (distintos agentes leen uno u otro).
- Contenido: stack, referencias a la KB, skills disponibles por agente, resumen del roadmap (camino crítico, fases, primer change) y **reglas duras** del proyecto.

---

## 10. El ciclo OPSX

**OPSX = Open Spec eXecution:** el ciclo del día a día, una vuelta **por cada change**. Es **re-entrante**, no lineal: cualquier fase puede volver a dispararse.

```
explore ──► propose ──► apply ──► verify ──► archive
   ▲                                            │
   └──────────── próximo change ◄───────────────┘
```

| # | Fase | Qué se hace | Criterio de salida |
|---|---|---|---|
| 1 | **Explore** | Relevar problema, estado real del código, documentación. Nada se propone ni se toca sin contexto claro. No escribe archivos. | Contexto claro (guardar resumen para la consigna). |
| 2 | **Propose** | Redactar el spec **antes de tocar una línea**. Genera `proposal.md` (qué y por qué), `design.md` (cómo), `specs/` (escenarios CUANDO/ENTONCES), `tasks.md` (checklist accionable). | Spec escrito, **revisado y aprobado** que cubre el caso real. **Ajustar, no Continuar automático.** |
| 3 | **Apply** | Implementar contra el spec aprobado. Marca cada tarea `[x]` en `tasks.md` (si se corta la sesión, retoma desde la primera sin marcar). | Todo lo del spec implementado. **Nada más.** Si falta algo → volver a Propose. |
| 4 | **Verify** | Health checks + suite de tests (los que dejó TDD). | **Todo verde.** Sin excepciones ni "lo vemos después". |
| 5 | **Archive** | Sincroniza `openspec/specs/` con lo aplicado y mueve el change a `openspec/changes/archive/AAAA-MM-DD-<nombre>/`. | Change cerrado, specs actualizadas, bitácora lista para el próximo. |

**Cómo se usa en Claude Code (versión actual):**
1. Abrir Claude Code en el repo: `claude`
2. Escribir `/sdd-orchestrator` (activa el coordinador).
3. Pedir en lenguaje natural o con los comandos: "explorá el change C-0X", `/openspec-propose crear-turno-sin-solapamientos`, `/openspec-apply-change`, etc.
4. El orquestador corre `openspec status`, delega cada fase en un sub-agente con el modelo asignado y guarda en Engram con `topic_key: opsx/<change>/<fase>`.

---

## 11. Engram (memoria persistente)

### 11.1 Qué es

- Motor de memoria persistente para agentes (Gentleman Programming, MIT). **Un binario Go + SQLite con búsqueda full-text (FTS5)** en `~/.engram/engram.db`, expuesto por **MCP**, CLI, HTTP y una TUI.
- Sin Engram, cada sesión arranca de cero: el agente no sabe qué se decidió, qué problemas hubo ni qué se hizo.
- **La base es local y global** (de todos tus proyectos), filtrada por proyecto.

### 11.2 Herramientas MCP que usa el agente

| Intención | Herramienta |
|---|---|
| Confirmar proyecto y recuperar trabajo reciente | `mem_current_project`, `mem_context` |
| Buscar conocimiento previo | `mem_search` |
| Ver un resultado en detalle | `mem_timeline`, `mem_get_observation` |
| Guardar / refinar | `mem_save`, `mem_update`, `mem_suggest_topic_key` |
| Guardar el pedido del usuario | `mem_save_prompt` |
| Cerrar/traspasar sesión | `mem_session_summary`, `mem_session_start`, `mem_session_end` |
| Diagnóstico | `mem_doctor` |

### 11.3 Protocolo que instala Active Stack (resumen)

- **Guarda proactivamente** (sin que se lo pidan) después de: decisiones de arquitectura/diseño, convenciones, cambios de flujo, elección de librerías, bugs resueltos (con causa raíz), descubrimientos no obvios, gotchas, patrones, preferencias del usuario.
- Formato: **title** (verbo + qué), **type** (`bugfix | decision | architecture | discovery | pattern | config | preference`), **scope** (`project`), **topic_key** estable, **content** con **What / Why / Where / Learned**.
- **Buscar** cuando el usuario dice "acordate", "qué hicimos", o al empezar algo que pudo hacerse antes: `mem_context` → `mem_search` → `mem_get_observation`.
- **Cierre de sesión obligatorio:** `mem_session_summary` con Goal / Instructions / Discoveries / Accomplished / Next Steps / Relevant Files.
- **Después de compactar:** primero `mem_session_summary`, después `mem_context`.
- En OPSX guarda tras cada acción con `topic_key: "opsx/{change}/{fase}"`.

### 11.4 Comandos de terminal

```bash
engram tui                       # navegar la memoria (j/k, Enter, / buscar, Esc)
engram setup claude-code         # registrar Engram en Claude Code (si el instalador no lo hizo)
engram doctor                    # diagnóstico read-only
engram sync                      # exporta la memoria DE ESTE PROYECTO a .engram/chunks/*.jsonl.gz
engram sync --import             # importa los chunks del repo a tu base local
```

### 11.5 Compartir memoria en el equipo (Git Sync)

- Antes de `git push`: `engram sync` → `git add .engram` → commit `chore(engram): sync project memory`.
- Después de `git pull`/clonar: `engram sync --import`.
- ⚠️ **Nunca `engram sync --all`** (filtraría la memoria de TODOS tus proyectos al repo).
- ⚠️ Si el repo es **público**, la memoria queda visible: revisar que no tenga nada sensible.

### 11.6 Para la Etapa 7 / video

Pedirle a Claude, en una **sesión nueva**: *"¿Qué decisiones tomamos sobre la prevención de solapamientos y por qué?"* → el agente usa `mem_search`/`mem_context` y responde con lo guardado. Mostrar también `engram tui` con las observaciones del proyecto. Explicar: sin esto, había que re-explicar todo.

---

## 12. El SDD Orchestrator, governance y TDD

### 12.1 SDD Orchestrator

Harness **config** que convierte al agente en **coordinador, no ejecutor**: mantiene un hilo de conversación delgado, **delega** el trabajo pesado a sub-agentes y sintetiza resultados. Principios:
1. **El CLI `openspec` es dueño del estado** (`openspec status`, `list`, `instructions` son "sus ojos").
2. **Delegar, no inflar** el contexto.
3. **Engram persiste el contexto.**

Reglas de delegación:

| Acción | Inline | Delegar |
|---|---|---|
| Leer 1–3 archivos para decidir | ✅ | |
| Leer 4+ archivos para entender | | ✅ |
| Escribir un archivo mecánico | ✅ | |
| Escribir con análisis / varios archivos / lógica nueva | | ✅ |
| Bash para estado (git, openspec status) | ✅ | |
| Bash para ejecutar (tests, build) | | ✅ |

Toggles: **TDD** (cada Apply se apoya en tests), **Engram** (memoria), **model-routing** (modelo según tarea), **delegación** (sub-agentes), **governance** (el protocolo Continuar/Ajustar/Parar es "literalmente esta pieza en acción").

### 12.2 Governance — autonomía por dominio

| Nivel | Dominios típicos | Comportamiento del agente |
|---|---|---|
| **CRITICAL** | Auth, facturación, seguridad, logs de auditoría | Solo análisis; no escribe código sin aprobación humana explícita. |
| **HIGH** | Configs que afectan datos de usuario, backup/restore | Propone y espera revisión antes de escribir. |
| **MEDIUM** | Lógica de negocio, adaptadores de dominio | Implementa con checkpoints; muestra las decisiones. |
| **LOW** | CRUD simples, catálogos, tipos | Autonomía total si los tests pasan. |

👉 La creación de turnos sin solapamientos es **lógica de negocio (MEDIUM)**: implementa por pasos y muestra decisiones.

### 12.3 Strict TDD (fase Apply)

Tres leyes: 1) no escribir código de producción sin un test que falle; 2) no escribir más test del necesario para fallar; 3) no escribir más código del necesario para pasar.

Ciclo por tarea: **Safety net** (correr tests existentes) → **Understand** (escenarios del spec = criterios de aceptación) → **RED** (test que falla) → **GREEN** (mínimo código) → **TRIANGULATE** (≥2 casos por comportamiento) → **REFACTOR** (tests verdes después de cada paso) → marcar `[x]`. Prohibidas las aserciones triviales. Devuelve una tabla de evidencia TDD por tarea.

---

## 13. Trabajo en equipo con GitHub

### 13.1 Modelo de ramas (lo pide la consigna local)

- **`main`** (la "Master"): rama protegida, **solo el líder mergea**, nadie pushea directo.
- **Una rama por integrante:** `dev-<alias>`, creadas por el líder como pide la consigna local: `dev-lautaro`, `dev-agustin`, `dev-lucas`, `dev-renzo`, `dev-facundo` y `dev-ep`.
- Cada change se trabaja en la rama del integrante y se integra con un **Pull Request** a `main`, que **revisa y aprueba el líder**.

```
main ●──────●───────────●──────────●──────►   (solo merges vía PR)
      \      ▲           ▲          ▲
       \     │ PR C-01   │ PR C-02  │ PR C-03
dev-ana ●────●           │          │
dev-juan ●───────────────●          │
dev-sofi ●──────────────────────────●
```

### 13.2 Flujo de un integrante para un change

```bash
git switch dev-<alias>                 # mi rama
git pull origin main                   # traigo lo último de main
engram sync --import                   # traigo la memoria del equipo
claude                                 # abro Claude Code
#   /sdd-orchestrator → explore → propose (Ajustar!) → apply → verify → archive
git add -A
git commit -m "feat(C-0X): crear turno sin solapamientos"
engram sync && git add .engram && git commit -m "chore(engram): sync project memory"
git push origin dev-<alias>
# Abrir PR dev-<alias> → main en GitHub (o: gh pr create --base main)
```

### 13.3 Comandos esenciales

| Comando | Para qué |
|---|---|
| `git clone <url>` | Copiar el repo a tu máquina |
| `git status` | Ver qué cambió |
| `git switch <rama>` / `git switch -c <rama>` | Cambiar de rama / crear y cambiar |
| `git pull origin main` | Traer y mezclar lo último de main |
| `git add <archivo>` / `git add -A` | Preparar cambios para commit |
| `git commit -m "mensaje"` | Guardar una "foto" de los cambios |
| `git push origin <rama>` | Subir tu rama a GitHub |
| `git log --oneline --graph` | Ver historial |
| `git diff` | Ver diferencias sin commitear |
| `git fetch` | Traer novedades sin mezclar |
| `git merge main` | Mezclar main en tu rama |
| `git stash` / `git stash pop` | Guardar cambios a un costado / recuperarlos |
| `gh pr create --base main` | Crear un PR desde la terminal |

### 13.4 Convención de commits (Conventional Commits)

`tipo(alcance): descripción` — `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
Ej.: `docs(discovery): agregar tabla comparativa A`, `feat(C-03): validar solapamiento por sillón`, `test(C-03): escenario de borde 10:30`.

### 13.5 Riesgos de conflicto propios de este proyecto

| Archivo | Riesgo | Cómo evitarlo |
|---|---|---|
| `CHANGES.md` | Varios marcan `[x]` a la vez | Solo el líder lo actualiza en `main` tras mergear. |
| `openspec/specs/<capacidad>/spec.md` | Dos changes que tocan la misma capacidad al archivar | El líder secuencia esos changes (no en paralelo). |
| `.active-orchestrator-state.json` | Lo toca la fundación | Solo el líder (fundación en `main`). |
| `AGENTS.md` / `CLAUDE.md` | Reglas | Cambios solo vía PR revisado por el líder. |
| `.engram/` | Chunks | Son archivos nuevos por sync; conflictos raros. |

### 13.6 Identidad de cada integrante (se evalúa)

Cada uno con su **propia cuenta de GitHub** y su git configurado:
```bash
git config --global user.name "Nombre Apellido"
git config --global user.email "email-de-su-cuenta-github"
```
Si los commits salen con otro mail, **no cuentan** como aporte de esa persona en GitHub.

---

## 14. Organización del equipo de 6

> Propuesta base (el líder la ajusta). Regla: **cada integrante conduce al menos una etapa o un change con el agente, tiene commits propios y lo explica en el video.**

| Rol | Persona | Etapa que conduce | Entregables a cargo |
|---|---|---|---|
| **Líder (L)** | Líder | Etapa 0 (repo), Etapa 1, conducción de 3–5 (fundación) y del **change principal OPSX** | Repo, ramas, PRs, `CHANGES.md`, secuencia de changes |
| **Investigador 1 (I1)** | Integrante 2 | Etapa 2 – Discovery parte A (sistemas 1–8) + checklist 11 puntos | Tabla A (mitad), respuestas Q&A |
| **Investigador 2 (I2)** | Integrante 3 | Etapa 2 – Discovery parte A (sistemas 9–15+) + matriz B | Tabla A (mitad), matriz B + nota metodológica |
| **Verificador (V)** | Integrante 4 | Verificación de fuentes (≥5, mejor 8–10) + secciones C y D | Sección "Verificación de fuentes", C, D, PDF del informe |
| **Revisor de fundación / QA (Q)** | Integrante 5 | Revisión de KB (Etapa 3) y Roadmap (Etapa 4), regla de dominio en AGENTS.md, tests/README | Checklist de revisión, README reproducible |
| **Comunicación + Engram (C)** | Integrante 6 | Etapa 7 (Engram) + video + reflexión | Video editado, reflexión consolidada |

Todos ejecutan **algún change adicional** del roadmap en su rama (paralelismo de `CHANGES.md`) si el tiempo da, siempre por PR. **El change obligatorio y evaluado es uno solo**: priorizar que ese quede perfecto.

---

## 15. Plan de trabajo hasta la entrega (actualizado el 21/11)

| Día | Fecha | Objetivo | Responsable |
|---|---|---|---|
| D0 | Jue 19/11 | Hecho: grupo de 6 confirmado e instalación en la PC del líder. | L |
| D1 | Vie 20/11 | Hecho: prueba del stack en `GLOBAL\prueba`, repo `Pinini777/turnos-odontologia` creado con la Etapa 0 en `main`. | L |
| D2 | Sáb 21/11 | **Reunión:** Etapa 1 (openspec init + `/active-orchestrator init`), Etapa 2 (Discovery + verificación en paralelo + PDF), etapas 3, 4 y 5, y arranque de la Etapa 6 (ola 0: C-01; ola 1 en paralelo). | L + todos |
| D3 | Dom 22/11 | Terminar la ola 1: change evaluado en verify (todo verde) y archive; PR de cada integrante revisados y mergeados. | L + todos |
| D4 | Lun 23/11 | Ola 2 si sobra tiempo. README reproducible probado desde cero. Engram (Etapa 7). | L, Q, C |
| D5 | Mar 24/11 | Grabación del video y reflexión escrita. | C + todos |
| D6 | Mié 25/11 | Revisión final con el checklist §17. Merge final a `main`. **Entrega antes de las 23:00.** | L |

---

## 16. Glosario

| Término | Significado |
|---|---|
| **Agente de IA** | Programa (Claude Code, OpenCode, Codex) que usa un modelo de lenguaje para leer, escribir y ejecutar cosas en tu proyecto. |
| **Harness** | Todo el andamiaje alrededor del modelo: skills, configs, herramientas externas. |
| **Skill** | Manual (`SKILL.md` + assets) que el agente carga bajo demanda para hacer una tarea concreta. |
| **MCP** | Model Context Protocol: estándar para conectar herramientas externas (Engram, Context7) al agente. |
| **SDD** | Spec-Driven Development: especificar el comportamiento esperado en escenarios verificables antes de programar. |
| **Vibe coding** | Programar con prompts sueltos, sin spec ni memoria. Lo opuesto a SDD. |
| **Spec / especificación** | Requisito + escenarios (dado/cuando/entonces) verificables. |
| **Escenario** | Situación concreta con resultado esperado observable. |
| **OpenSpec** | CLI que guarda el estado de los changes en `openspec/`. Fuente de verdad. |
| **Change** | Una unidad de cambio (una funcionalidad) con su propia carpeta y artefactos. |
| **Delta spec** | Specs dentro de un change que indican qué se agrega/modifica/quita respecto de las vigentes. |
| **proposal.md** | Qué cambiar y por qué (incluye la justificación de la elección). |
| **design.md** | Cómo se va a implementar (decisiones técnicas). |
| **tasks.md** | Checklist de tareas accionables y verificables. |
| **Archive** | Cierre del change: specs sincronizadas, change a `archive/`. |
| **OPSX** | Ciclo explore → propose → apply → verify → archive. |
| **Fundación** | Preparación única del proyecto: openspec init, discovery, KB, roadmap, skills, reglas. |
| **Discovery** | Investigación previa: "tengo una idea" → "sé qué construir y por qué". |
| **Knowledge-base (KB)** | 10 archivos canónicos con el conocimiento del dominio. |
| **CHANGES.md** | Roadmap operativo: changes, dependencias, paralelismo, camino crítico, governance. |
| **Camino crítico** | Cadena mínima de changes imprescindibles para llegar a producción. |
| **Gate** | Punto de sincronización: no se avanza hasta que se completa lo anterior. |
| **AGENTS.md / CLAUDE.md** | Reglas e instrucciones del proyecto para los agentes (copias idénticas). |
| **skill-registry** | `.atl/skill-registry.md`: reglas compactas de todas las skills disponibles. |
| **Protocolo de inspección** | Continuar / Ajustar / Parar acá al final de cada etapa. |
| **Bitácora compartida** | `.active-orchestrator-state.json`. |
| **Engram** | Memoria persistente del agente entre sesiones (SQLite + MCP). |
| **Context7** | MCP con documentación actualizada de librerías. |
| **Governance** | Nivel de autonomía del agente según criticidad del dominio. |
| **TDD** | Test-Driven Development: test que falla → código mínimo → refactor. |
| **Sub-agente** | Agente hijo al que el orquestador delega una tarea, con contexto propio. |
| **Compactación (`/compact`)** | Resumen automático del contexto cuando se llena; tras ella hay que reinvocar `/sdd-orchestrator`. |
| **Starter** | Paquete de skills por stack (`backend`, `ux-ui`, …) que se agrega con `active-stack starter add`. |
| **Lite / Full / Custom** | Modos de instalación de Active Stack. |
| **No evidenciado** | Valor obligatorio para toda celda del Discovery sin respaldo público. |
| **Funcionalidad comprobada vs. afirmación comercial** | La primera se ve en el producto/documentación/video oficial; la segunda solo la dice el proveedor. |
| **Rama (branch)** | Línea de trabajo paralela en Git. |
| **PR (Pull Request)** | Pedido para mezclar una rama en otra, con revisión. |
| **Merge** | Mezclar los cambios de una rama en otra. |
| **Conflicto** | Dos ramas cambiaron las mismas líneas; hay que resolver a mano. |

---

## 17. Checklist final de entrega

**Repositorio**
- [ ] `AGENTS.md` y `CLAUDE.md` en la raíz, con **al menos una regla propia del dominio** agregada a mano.
- [ ] `CHANGES.md` alineado al MVP de la sección D.
- [ ] `.active-orchestrator-state.json` con las etapas en `done`.
- [ ] `.atl/skill-registry.md`.
- [ ] `docs/discovery/informe-discovery.md` + `informe-discovery.pdf` + checklist de 11 puntos.
- [ ] `knowledge-base/` con los 10 canónicos (reglas de agenda + "No evidenciado" en preguntas abiertas).
- [ ] `openspec/specs/` actualizado y `openspec/changes/archive/AAAA-MM-DD-<change>/` con proposal, design, tasks, specs.
- [ ] Resumen del Explore guardado.
- [ ] `src/` y `tests/` con **un test por escenario** (≥3: feliz, error de negocio, borde), todos en verde.
- [ ] `README.md`: cómo instalar y correr los tests (probado clonando de cero en otra PC).
- [ ] Historial con commits del proceso y **commits de los 6 integrantes**.
- [ ] Sin secretos ni datos reales de pacientes.
- [ ] `.engram/` sincronizado (si se decide versionarlo).

**Informe de Discovery (PDF):** portada · resumen ejecutivo (≤1 pág.) · A (≥15, URL + fecha) · B (pesos + total + nota metodológica) · C (4 subsecciones) · D (5 demo, 3 UX, MVP en 3 listas) · Verificación de fuentes (≥5) · Referencias.

**Video (8–12 min):** los 6 hablan y aparecen · orden (1)–(7) · pantalla real · momento de Ajustar en Propose · tests en verde · consulta a Engram.

**Reflexión (1–2 págs.):** las 5 preguntas, escrita por nosotros, con el aporte de cada integrante.

**Entrega:** subida en la tarea "Entrega SDD" del campus antes del **25/11/2026 23:00**.
