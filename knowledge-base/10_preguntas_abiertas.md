# Preguntas Abiertas

## Inconsistencias detectadas

### IN-01 — Segmento "sin recepción" vs. rol recepcionista
**Documento A dice**: primera respuesta de la entrevista: consultorio independiente, 1 a 3 profesionales, **sin recepción**.
**Documento B dice**: respuestas siguientes: el **recepcionista se mantiene** y puede agendar, modificar y cancelar turnos.
**Impacto**: define si existe el rol y su matriz de permisos.
**Resolución aplicada**: EP confirmó mantener al recepcionista. El segmento queda como "1 a 3 profesionales con recepcionista" (`discovery.md` §1 y §2).

### IN-02 — "Eliminar" vs. auditoría
**Documento A dice**: la recepcionista puede "eliminar" turnos.
**Documento B dice**: el MVP exige auditoría de todos los cambios.
**Resolución aplicada**: eliminar = cancelar, sin borrado físico (RN-TU-03, DD-04).

### IN-03 — Tamaño del MVP vs. plazo
**Documento A dice**: el MVP incluye reserva online, email, ganancias, historia clínica y odontograma.
**Documento B dice**: la entrega es el 25/11/2026 y solo un change es obligatorio.
**Impacto**: riesgo de dejar changes a medias.
**Resolución propuesta**: `CHANGES.md` prioriza el camino crítico hasta "crear turno sin solapamientos". El resto se reparte como changes paralelos según el tiempo.

### IN-04 — Cantidad de sistemas que no publican precio
**Documento A dice**: `informe-discovery.md` (resumen ejecutivo y C.3): "7 de 16 no publican el precio de la licencia".
**Documento B dice**: las fichas de `docs/discovery/sources/` muestran **8** sin ningún precio de licencia (DentalTec, OdontoClinIA, DentalSoft, DentalCore, Reservo, Dentidesk, Clinic Cloud y Dentally), más 2 que solo publican una parte (Bilog: Lite y Premium "a cotizar"; Dentalink: planes "a cotizar").
**Impacto**: dato incorrecto en el entregable del Discovery.
**Resolución aplicada (2026-11-21, aprobada por EP)**: el informe (.md, Google Doc y PDF) y `discovery.md` dicen ahora "8 de 16 no publican el precio de la licencia y otros 2 (Bilog y Dentalink) solo publican una parte". La corrección quedó registrada en la lista "Correcciones aplicadas" del informe.

## Preguntas abiertas (priorizadas)

| ID | Prioridad | Pregunta | Bloquea | Decisor |
|---|---|---|---|---|
| PA-03 | Media | ¿El precio de una prestación puede variar por profesional? | US-002, RN-GA | EP |
| PA-04 | Media | Si un turno `atendido` se corrige o cancela después, ¿cómo impacta en las ganancias ya mostradas? | RN-GA-03 | EP |
| PA-05 | Media | ¿Hay un máximo de duración por prestación o de anticipación para reservar online? | US-020 | EP |
| PA-06 | Media | ¿Qué detalle tiene el odontograma del MVP: piezas y estado, o también caras? (5 competidores no evidencian odontograma; NE-10) | US-051 | Profesional del equipo / EP |
| PA-07 | Media | ¿Cómo se cumple con la Ley 25.326 (datos personales y de salud) y la Ley 26.529 (historia clínica: consentimiento, acceso, conservación)? **Ningún competidor lo declara (NE-18)** | HC en producción | Equipo |
| PA-10 | Media | Si la recepción cargó a un paciente antes de que se registre, ¿la vinculación por documento + email alcanza o hace falta confirmación? | US-022 | EP |
| PA-12 | Media | ¿La exportación de datos del consultorio entra en el MVP o queda como diferenciador posterior? (ningún competidor la documenta; NE-17) | Roadmap | EP |
| PA-08 | Baja | ¿Se reenvía el email al cancelar? ¿Con qué texto? | US-011 | EP |
| PA-09 | Baja | ¿El profesional puede ver los turnos de otros profesionales o solo los suyos? (supuesto: ve toda la agenda, pero solo sus ganancias) | US-014 | EP |

### Resueltas en la revisión de la etapa 3 (2026-11-21, EP)

| ID | Pregunta | Respuesta | Dónde se aplicó |
|---|---|---|---|
| PA-00 | Stack | **Node.js + TypeScript** (backend) y React + Vite (frontend) | DD-01, DD-12, 02, 08 |
| PA-01 | ¿El paciente reserva con cuenta o con código de reserva? | **Con cuenta** | DD-10, RN-RE-03, RN-RE-05, US-022, F-03, 03 y 04 |
| PA-02 | ¿Quién carga los horarios de atención? | **Cada profesional, los suyos** | DD-11, RN-AG-09, US-003, matriz RBAC |
| PA-11 | ¿Política visual? | **`system-and-mockups`** (design system en revisión 1, aprobación pospuesta por EP) | DD-09, `design-system/README.md` |

## Puntos que el Discovery dejó como "No evidenciado"

Relevados celda por celda de las tablas A.1 y A.2 de `docs/discovery/informe-discovery.md` y de las fichas de `docs/discovery/sources/`. "No evidenciado" quiere decir que **no aparece en las fuentes públicas consultadas** (2026-11-21), no que la función no exista. Cada punto queda como pregunta para las demos de la sección D.1 del informe (Bilog, AgendaPro, OdontoClinIA, DentalTec, Dentalink), con su consecuencia para nuestro producto.

### Agenda (núcleo del producto)

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-01 | **Regla de prevención de solapamientos** y tratamiento de bordes | Los 16 sistemas. Dentalink solo separa la agenda principal del "sobreagendamiento", sin explicar la regla | Es el diferencial del MVP: RN-AG-02, RN-AG-03, RN-AG-04 y el change evaluado (US-010). Pregunta para la demo: ¿qué pasa si se agenda a las 10:30, justo cuando termina un turno de 10:00–10:30? |
| NE-02 | **Box (sillón o unidad dental) como recurso de la agenda** | 13 de 16: Bilog, DentalTec, DentalSoft, Odonto.ar, DentalCore, Odonthia, Reservo, Doctoralia PRO, Doctocliq, Dentidesk, Clinic Cloud, Open Dental, Dentally. Solo AgendaPro y OdontoClinIA lo declaran y Dentalink lo documenta | RN-AG-01 y RN-AG-03: todo turno reserva profesional + box |
| NE-03 | **Sobreturnos** | 15 de 16. Solo Dentalink documenta el sobreagendamiento | RN-AG-07: el producto no los permite (decisión consciente) |
| NE-04 | **Bloqueos de agenda** (feriados, ausencias, mantenimiento) | Bilog, DentalTec, OdontoClinIA, Odonto.ar, AgendaPro, Dentalink, Doctocliq, DentalCore, Reservo, Dentidesk, Odonthia, Doctoralia PRO, Clinic Cloud, Dentally. Solo DentalSoft y Open Dental los mencionan | RN-AG-08 y US-003 en el MVP |
| NE-05 | **Duración variable por prestación** | Bilog, OdontoClinIA, DentalSoft, DentalCore, Reservo, Odonthia, Doctoralia PRO, Dentidesk, Clinic Cloud, Dentally. La declaran AgendaPro y Odonto.ar; DentalTec y Dentalink, por intervalo del profesional | RN-AG-06: la duración sale de la prestación (múltiplos de 15) |

### Turnos digitales y automatización

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-06 | **Reserva online del paciente** | DentalTec y Dentidesk; en Reservo, la agenda entera quedó sin evidencia | En el MVP (US-020, con cuenta del paciente) |
| NE-07 | **Lista de espera** | 14 de 16. Solo Doctoralia PRO (plan VIP) y Dentally la declaran | Post-MVP (diferenciador de la siguiente ola) |
| NE-08 | **Recordatorios automáticos / WhatsApp** | Odonto.ar (recordatorios y WhatsApp), Reservo (automatización), Doctoralia PRO (WhatsApp) | MVP: solo email de confirmación (RN-NO-01). WhatsApp, post-MVP |
| NE-09 | **Recuperación de pacientes, recall y campañas** | Bilog, DentalTec, OdontoClinIA, DentalSoft, Odonto.ar | Post-MVP |

### Gestión odontológica

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-10 | **Odontograma** | DentalCore, Reservo (en la fuente oficial), Doctoralia PRO, Doctocliq, Clinic Cloud | En el MVP (US-051); el nivel de detalle es PA-06 |
| NE-11 | **Periodontograma** | 15 de 16. Solo Dentidesk declara una ficha de periodoncia | Post-MVP |
| NE-12 | **Presupuestos** | DentalTec | Post-MVP |

### Administración e integraciones

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-13 | **Caja, cobros y facturación** | Odonthia, Doctoralia PRO, Odonto.ar (facturación) | Post-MVP. En el MVP, solo ganancias calculadas (RN-GA) |
| NE-14 | **ARCA, Mercado Pago y obras sociales** | DentalSoft (ARCA, Mercado Pago), Odonto.ar (ARCA), AgendaPro (ARCA y obras sociales), Bilog (Mercado Pago), Doctocliq (nada específico de Argentina) | Post-MVP. La obra social es un dato informativo (SU-03) |
| NE-15 | **Google Calendar y API pública** | Bilog (Google Calendar y API), Odonto.ar (API) | MVP: botón "Agregar a Google Calendar" sin OAuth (DD-06). API pública, post-MVP |

### Operación, seguridad y cumplimiento

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-16 | **Roles, permisos y auditoría** | Bilog (roles), OdontoClinIA (roles), DentalSoft (roles y auditoría); DentalCore, Reservo y Doctoralia PRO, toda la sección de operación y seguridad | En el MVP: RBAC (RN-RO) y auditoría de turnos (RN-TU-05) |
| NE-17 | **Exportación de datos del consultorio** | Los 16 sistemas (ninguno la documenta) | PA-12 |
| NE-18 | **Adecuación declarada a la normativa argentina** (Ley 25.326, Ley 26.529) | Los 16 sistemas | PA-07 y RN-DA-03 |

### Modelo comercial y contexto

| ID | Tema | Sin evidencia pública en | Consecuencia para el proyecto |
|---|---|---|---|
| NE-19 | **Precio de la licencia** | DentalTec, OdontoClinIA, DentalSoft, DentalCore, Reservo, Dentidesk, Clinic Cloud, Dentally; en parte Bilog y Dentalink ("a cotizar") | Precio publicado como diferencial. Ver IN-04 |
| NE-20 | **Empresa, país o modalidad** | DentalCore (empresa, país y modalidad), Dentidesk (país y modalidad), AgendaPro (país de origen) | Solo contexto competitivo |
| NE-21 | **Evidencia de adopción** (clientes, casos) | OdontoClinIA, Odonto.ar, DentalCore, Dentidesk, Doctoralia PRO, Open Dental, Dentally. En el resto, solo cifras declaradas por el proveedor | No se toman decisiones con cifras de adopción declaradas |
