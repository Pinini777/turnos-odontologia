# Informe de Discovery — Sistemas de gestión de turnos y agenda para consultorios odontológicos (Argentina)

| | |
|---|---|
| **Materia** | Desarrollo de Software — UTN FRM |
| **Trabajo** | Trabajo de Integración: del Discovery al primer Change, con SDD y Active Stack |
| **Integrantes** | (completar: los 6 integrantes y el rol de cada uno) |
| **Fecha de consulta de las fuentes** | 2026-11-21 |
| **Estado** | Borrador generado con agente de IA (Claude Code). **Pendiente de verificación humana de fuentes y revisión del equipo.** |

---

## Resumen ejecutivo

**Qué se investigó.** Se relevaron 16 sistemas que gestionan turnos y agenda en consultorios odontológicos: 7 de origen argentino o con foco declarado en Argentina, 5 latinoamericanos que operan en Argentina y 4 internacionales usados como referencia. La fuente principal fue el sitio oficial de cada proveedor (funcionalidades y precios). Se sumaron un centro de ayuda (Dentalink) y un marketplace de reseñas (Capterra). Todas las fuentes se consultaron el 2026-11-21.

**Hallazgos principales.**
1. La agenda multiprofesional, la reserva online, los recordatorios por WhatsApp, el odontograma digital y la historia clínica son **estándar de mercado**: casi todos los proveedores locales los declaran.
2. **Ninguno de los 16 sistemas documenta públicamente cómo previene los solapamientos de turnos** por profesional y por sillón o box. Solo AgendaPro y OdontoClinIA mencionan la agenda "por sillón". Es la regla de negocio central de una agenda odontológica y en todos queda como "No evidenciado".
3. Lo que realmente diferencia a los sistemas argentinos es **la integración con el ecosistema local**: obras sociales (validación online en DentalTec), ARCA (DentalTec, Reservo, DentalCore), receta electrónica en ReNaPDiS (OdontoClinIA, Dentalink AR, Bilog, Reservo) y Mercado Pago (AgendaPro, Reservo, Odonto.ar para la suscripción).
4. **La transparencia de precios es baja**: 7 de 16 no publican el precio de la licencia. Los que sí lo publican van de un plan gratuito (Odonthia, Bilog Freemium, Doctocliq) a ARS 129.900/mes (AgendaPro Pro IA).
5. **Ninguna de las páginas consultadas declara adecuación a la Ley 25.326 (datos personales) ni a la Ley 26.529 (derechos del paciente e historia clínica).** La seguridad se comunica con mensajes comerciales, salvo DentalTec, que detalla roles, auditoría y cifrado.
6. Casi toda la evidencia disponible es **afirmación comercial del proveedor**. Las cifras de adopción y los resultados ("40% menos ausentismo") no tienen respaldo independiente.

**MVP recomendado (detalle en D).** Una agenda odontológica confiable para consultorios de 1 a 3 profesionales con recepcionista. Su núcleo es **crear turnos que impidan solapamientos por profesional y por sillón**, con cancelación y reprogramación que liberen el horario. Incluye reserva online del paciente con email de confirmación y botón de Google Calendar, prestaciones con precio y vista de ganancias para el profesional, e historia clínica y odontograma, con tres roles (profesional, recepcionista y paciente). WhatsApp, la lista de espera, la facturación ARCA y las obras sociales quedan para etapas posteriores.

---

## Metodología y convenciones

- **Fuentes**: solo fuentes verificables (sitio oficial, página de precios, centro de ayuda, marketplace de reseñas). Cada sistema tiene su ficha en `docs/discovery/sources/<sistema>.md`, con URL y fecha.
- **Nivel de evidencia** de cada dato:
  - **Doc.**: documentado en un centro de ayuda o manual público del proveedor.
  - **Demo**: visible en una demo pública interactiva dentro del sitio.
  - **Decl.**: declarado en una página comercial del proveedor (afirmación comercial, no comprobada).
  - **No evidenciado**: no aparece en las fuentes consultadas. No significa que la función no exista.
- **Funcionalidad comprobada vs. afirmación comercial**: en este borrador solo las celdas marcadas **Doc.** o **Demo** se acercan a "comprobada". Todo lo demás es afirmación comercial hasta que el equipo lo verifique (ver la sección "Verificación de fuentes").
- **País de origen**: cuando el sitio no lo declara, se indica "inferido" y de qué dato sale (dominio, teléfono, normativa).
- **Limitaciones**: no se crearon cuentas ni se contactó a proveedores, como exige la consigna. Las páginas se leyeron como texto, así que contenido detrás de login, pestañas o videos puede haber quedado afuera. Los precios en USD o ARS son los publicados en la fecha de consulta.

---

## A. Tabla comparativa (ordenada por relevancia para Argentina)

Criterio de relevancia: primero los sistemas hechos o pensados para Argentina con integraciones locales; después los latinoamericanos con operación en Argentina; al final las referencias internacionales.

### A.1 Identificación, agenda, turnos digitales y automatización

| # | Producto · Proveedor · País · URL | Segmento · Modalidad | Gestión de agenda | Turnos digitales | Automatización | Fuente · fecha |
|---|---|---|---|---|---|---|
| 1 | **Bilog** · Bilog · Argentina (Decl.: "clínicas de todo el país") · bilog.com.ar | Consultorio, clínica, obras sociales/gerenciadoras · SaaS web + app iOS/Android | Vista diaria y semanal, varios profesionales, consultorios (Decl.). Sillones/boxes: No evidenciado. Duración variable: No evidenciado. Bloqueos y sobreturnos: No evidenciado. Prevención de solapamientos: No evidenciado | Reserva, cancelación y consulta online por el paciente; turnos para pacientes nuevos desde redes/WhatsApp; alta por QR (Decl.). Lista de espera: No evidenciado | Recordatorio WhatsApp "en un clic" (individual); confirmaciones automáticas (Decl.). Recuperación y campañas: No evidenciado | bilog.com.ar, /funcionalidades, /planes · 2026-11-21 |
| 2 | **DentalTec** · DentalTec · Argentina (Decl.) · web.dentaltec.com.ar | Odontólogos e instituciones (círculos, federaciones) · 100% web | Turnos por odontólogo, día, horario e intervalos configurables (Decl.). Sillones, bloqueos, sobreturnos, solapamientos: No evidenciado | Reserva online del paciente: No evidenciado. Confirmación desde WhatsApp (Decl.) | Recordatorios automáticos por WhatsApp (Decl.). Recuperación y campañas: No evidenciado | web.dentaltec.com.ar/funcionalidades · 2026-11-21 |
| 3 | **OdontoClinIA** · ClinIA · Argentina (Decl.) · clinia.com.ar/odontologia | Consultorio, clínica, servicio hospitalario · Web | Agenda por profesional, especialidad o **sillón** (Decl.). Duración variable, bloqueos, sobreturnos, solapamientos: No evidenciado | Turno por WhatsApp con asistente de IA validado contra la agenda; confirmación, cancelación y reprogramación; turnero web y app (Decl.). Lista de espera: No evidenciado | Recordatorios automáticos por WhatsApp y correo (Decl.). Recuperación y campañas: No evidenciado | clinia.com.ar/odontologia · 2026-11-21 |
| 4 | **DentalSoft** · DentalSoft · Argentina (Decl.) · dentalsoft.com.ar | Consultorio y clínica · Nube | Vistas semanal, diaria y mensual; drag & drop; urgencias; **bloqueos**; multi-sucursal (Decl.). Sillones, sobreturnos, solapamientos: No evidenciado | Turnos online desde la web de la clínica; chatbot; botón de WhatsApp (Decl.; demo pública en /demo no revisada) | Recordatorios por WhatsApp y e-mail; la agenda se actualiza con la respuesta del paciente (Decl.). Recuperación de inactivos: mencionada como problema, función No evidenciado | dentalsoft.com.ar · 2026-11-21 |
| 5 | **Odonto.ar** · Odonto.ar · Argentina (inferido: dominio .ar y precios en ARS) · odonto.ar | Independiente a clínica de hasta 10 personas · Web (PC, tablet, celular) | Día, semana y mes del equipo; turnos movibles; **duración por motivo de consulta** (Decl.). Sillones, bloqueos, sobreturnos, solapamientos: No evidenciado | Reserva online por link con disponibilidad, anticipación y reglas de cancelación/reprogramación (Decl. + widget de ejemplo). WhatsApp: No evidenciado | Recordatorios: No evidenciado. Campañas: No evidenciado | odonto.ar · 2026-11-21 |
| 6 | **DentalCore** · No evidenciado · País No evidenciado (factura ARCA) · dentalcore.app | Consultorio y clínica LATAM · No evidenciado | No evidenciado (solo menciona que el horario se libera al cancelar) | Confirmación o cancelación con un toque; bandeja de WhatsApp del equipo (Decl.) | Confirmación por WhatsApp, e-mail o SMS 48 y 24 h antes; listas de tratamientos sin agendar, controles vencidos e inactivos (Decl.) | dentalcore.app · 2026-11-21 |
| 7 | **Odonthia** · Odonthia · Argentina (Decl.: "Hecho en Argentina") · odonthia.com | Consultorio · Web | Agenda (Decl., sin detalle). Resto: No evidenciado | Turnos desde link (Decl.) | Recordatorios automáticos; WhatsApp automático en planes pagos (Decl.) | odonthia.com · 2026-11-21 |
| 8 | **AgendaPro** · AgendaPro Inc. · País No evidenciado (opera en AR, tel. +54) · agendapro.com/ar | Independiente a cadena multisede; multirrubro · SaaS + app iOS/Android | Por odontólogo, práctica y **sillón**; duración por práctica (Decl.). Bloqueos, sobreturnos, solapamientos: No evidenciado | Online 24/7, sitio de reservas, Google Reserve/Maps, marketplace; recepcionista IA en WhatsApp/Instagram/Messenger (Decl.) | Recordatorios por WhatsApp con insistencia por IA; oportunidades de nueva visita; campañas segmentadas (Decl.) | agendapro.com/ar/dental/software-odontologico; /ar/planes · 2026-11-21 |
| 9 | **Dentalink** · Dentalink · Chile (Capterra: Santiago, fundada en 2009) · softwaredentalink.com | Consultorio a red multisede · 100% en línea | Agenda (Decl.); multicentro (plan Pro). Sillones, bloqueos, sobreturnos, solapamientos: No evidenciado | Agenda online 24/7; agendamiento por WhatsApp; Contact Center IA (Decl.) | Confirmaciones automáticas; tareas automáticas de control; NPS; email marketing (Decl.) | softwaredentalink.com; /planes; ayuda.softwaredentalink.com · 2026-11-21 |
| 10 | **Reservo** · Reservo · Chile (inferido: dominio .cl) · reservo.cl/ar | Consultorios multiespecialidad · Web | No evidenciado | Turnero online (Decl.) | No evidenciado | reservo.cl/ar · 2026-11-21 |
| 11 | **Doctoralia PRO** · Doctoralia Internet SL (DocPlanner) · España (pie del sitio) · pro.doctoralia.com/ar | Profesionales y clínicas multiespecialidad · SaaS + app | Calendario de consultas (Decl.). Resto: No evidenciado | Reserva online; **lista de espera** (VIP); consulta en línea (Decl.). WhatsApp: No evidenciado | Recordatorios por e-mail, push y SMS; campañas de SMS (Decl.) | pro.doctoralia.com/ar/precio · 2026-11-21 |
| 12 | **Doctocliq** · Doctocliq · Perú (inferido: teléfono +51 y "libro de reclamaciones") · doctocliq.com | Independiente y clínica · SaaS + app | Por consultorio y doctor; agrupación de agendas (Decl.). Sillones, bloqueos, sobreturnos, solapamientos: No evidenciado | Agendamiento en línea; IA por WhatsApp (Decl.) | Confirmación automática por WhatsApp; campañas, cumpleaños, segmentación (Decl.) | doctocliq.com; /planes-y-precios · 2026-11-21 |
| 13 | **Dentidesk** · Dentidesk · País No evidenciado · dentidesk.com | Clínica, centro médico, academia, sindicatos · No evidenciado | Agenda personalizable; reprogramar (Decl.). Resto: No evidenciado | No evidenciado | Recordatorios personalizados (Decl., sin canal) | dentidesk.com · 2026-11-21 |
| 14 | **Clinic Cloud** · Clinic Cloud · España (inferido: Verifactu/TicketBAI) · clinic-cloud.com | Clínicas multiespecialidad · Nube | Multi-profesional, multi-sede (Decl.). Resto: No evidenciado | Reserva online vía Doctoralia (España) (Decl.) | Recordatorios y confirmaciones por WhatsApp, SMS y email (Decl.) | clinic-cloud.com · 2026-11-21 |
| 15 | **Open Dental** · Open Dental Software · EE.UU. (inferido: tarifas y teléfono) · opendental.com | Consultorio de cualquier tamaño · **Instalación local / self-hosted** | **Bloqueos** (Blockouts); configuración de agenda por proveedor (Decl.). Solapamientos: No evidenciado | Web Sched, portal del paciente (Decl.) | Mensajería automática, texting, recall, email masivo (Decl.) | opendental.com; /site/fees.html · 2026-11-21 |
| 16 | **Dentally** · Dentally · Reino Unido (inferido: en-gb, NHS) · dentally.com | Independiente a grupo multisede · Nube | Multisede (Decl.). Resto: No evidenciado | Reserva online; formularios digitales; **relleno de turnos liberados** (Decl.) | Mensajería automática (Decl.) | dentally.com/en-gb · 2026-11-21 |

### A.2 Gestión odontológica, administración, integraciones, operación, seguridad y modelo comercial

| # | Producto | Gestión odontológica | Administración | Integraciones | Operación y seguridad | Modelo comercial | Adopción (solo si está publicada) |
|---|---|---|---|---|---|---|---|
| 1 | Bilog | Ficha, odontograma, HC, adjuntos, presupuestos, consentimientos, recetas (Decl.). Periodontograma: No evidenciado | Caja diaria, bancos, proveedores, prestaciones, liquidaciones de obras sociales, KPIs (Decl.) | WhatsApp, receta electrónica, facturación electrónica (Decl.). Google Calendar, API, Mercado Pago: No evidenciado | Auditoría para obras sociales (Decl.). Roles, exportación, normativa argentina: No evidenciado | Freemium gratis; Lite y Premium a cotizar | +1.500 clínicas, +5.000 usuarios (Decl.) |
| 2 | DentalTec | Odontograma, HC, CIE-10, imágenes (Decl.). Presupuestos y periodontograma: No evidenciado | Facturación a obras sociales, liquidación a prestadores, reportes exportables a PDF/Excel (Decl.) | **Validación online con +15 obras sociales (SOAP)**, ARCA, WhatsApp (Decl.) | 10 roles, auditoría completa, JWT/bcrypt (Decl.). Normativa argentina: No evidenciado | Licencia no publicada; WhatsApp desde USD 9 por 50 mensajes | "Las instituciones más importantes del país" (Decl., sin nombres) |
| 3 | OdontoClinIA | **Odontograma FDI versionado (Demo pública)**, HC, CIE-10, plan de tratamiento con importe (Decl.) | Liquidación de obras sociales por nomenclador (dato de búsqueda; no visto en la página leída). Caja: No evidenciado | WhatsApp con IA; **receta electrónica ReNaPDiS N.º 248** (Decl.). ARCA, RENAPER, PUCO: mención genérica, no confirmada | Backups cada 10 min (Decl.). Roles y normativa argentina: No evidenciado | No publicado ("sin costo por usuario") | No evidenciado |
| 4 | DentalSoft | HC, odontograma con 18 estados e historial, ortodoncia, presupuestos (Decl.) | Presupuestos con cobertura de obra social, liquidaciones (comisiones y reintegros), reportes (Decl.) | WhatsApp, Google Calendar, web propia (Decl.). ARCA, Mercado Pago: No evidenciado | Multi-sucursal (Decl.). Roles, auditoría, exportación, normativa: No evidenciado | Prueba gratis; precio no publicado | Testimonios en el sitio (Decl.) |
| 5 | Odonto.ar | Odontograma con autor y fecha de cada cambio, HC, radiografías, presupuestos y tratamientos (Decl.) | Obras sociales con cálculo de cobertura, nomenclador, panel de finanzas (Decl.). Facturación: No evidenciado | Importación desde Excel (Decl.). WhatsApp, ARCA, API: No evidenciado | Permisos por persona (Decl.). Exportación y normativa: No evidenciado | **USD 29 / 49 / 99 por mes**, 30 días gratis, pago en ARS por Mercado Pago | No evidenciado |
| 6 | DentalCore | Alertas de alergias y medicación (Decl.). Odontograma: No evidenciado | Caja, deudas, liquidación de obras sociales, finanzas por profesional (Decl.) | **Factura ARCA desde el cobro**, WhatsApp, SMS (Decl.) | No evidenciado | Prueba de 1 semana; precio no publicado | No evidenciado |
| 7 | Odonthia | Ficha clínica, odontograma FDI, HC versionada con autor, consentimientos con firma electrónica (Decl.) | No evidenciado | WhatsApp en planes pagos (Decl.) | "Datos protegidos y con respaldo" (Decl.). Normativa: No evidenciado | **Gratis ilimitado**; IA ARS 78.700/mes; Max ARS 162.500/mes | 4.662 cuentas registradas (Decl.) |
| 8 | AgendaPro | Anamnesis, odontograma, evoluciones, radiografías, presupuestos, firma electrónica (Decl., desde Premium) | Caja, inventario, comisiones, honorarios, seña o pago con Mercado Pago (Decl.). ARCA y obras sociales: No evidenciado | **Mercado Pago**, WhatsApp, Google Calendar, Google Reserve, Meta/Google Ads (Decl.) | Multisede; "ficha clínica cifrada" (Decl.). La certificación CENS es de Chile | **ARS 9.900 / 19.900 / 39.900 / 129.900 por mes** (IVA incluido) | +30.000 negocios en LATAM (Decl.) |
| 9 | Dentalink | HC, odontograma, RX con IA, firma electrónica, presupuestos, ortodoncia (Decl.) | Caja, morosidad, gastos, inventario, liquidaciones; **cobro y conciliación con obras sociales en Argentina (Doc.)** | **Receta electrónica argentina (Doc.)**; API como adicional (Decl.) | Multicentro (Decl.). Normativa argentina: No evidenciado | A cotizar; Contact Center IA USD 50/mes (promoción); Capterra: desde USD 29/mes | +15.000 clínicas (Decl.); 2 opiniones en Capterra (5,0) |
| 10 | Reservo | Ficha clínica electrónica (Decl.). Odontograma: No evidenciado en la fuente oficial | Cobro en ARS (Decl.) | **ARCA, Mercado Pago, recetas electrónicas** (Decl.) | No evidenciado | No publicado | +4.000 clientes en 15 países (Decl.) |
| 11 | Doctoralia PRO | Registros médicos electrónicos (Decl.). Odontograma: No evidenciado | No evidenciado | SMS y página web (Decl.) | No evidenciado | **ARS 25.000 / 35.000 / 55.000 por mes** (anual); versión gratuita | No evidenciado en la página leída |
| 12 | Doctocliq | HC, presupuestos, archivos, consentimientos, ortodoncia, órdenes de laboratorio (Decl.). Odontograma: No evidenciado | Caja, comisiones, inventario, reportes (Decl.) | WhatsApp (Meta Business Partner), Google Calendar (Decl.). AR: No evidenciado | Usuarios administrativos (Decl.). Normativa AR: No evidenciado | **USD 0 / 19 / 29 / 49 por mes** | +6.500 profesionales (Decl.) |
| 13 | Dentidesk | Historial, fichas de ortodoncia y **periodoncia** (Decl.) | Facturación, stock, más de 20 reportes (Decl.) | "Integraciones" sin detalle (Decl.) | Multisucursal (Decl.) | No publicado (demo) | No evidenciado |
| 14 | Clinic Cloud | HC con IA, consentimientos (Decl.). Odontograma: No evidenciado en fuente oficial | Facturación, bonos, mutuas (España), stock, KPIs (Decl.) | WhatsApp, Doctoralia (España) (Decl.) | Trazabilidad de stock por lote (Decl.) | No publicado; promoción del 50% | +12.000 doctores (Decl.) |
| 15 | Open Dental | Tooth chart gráfico y 3D, recetas electrónicas (EE.UU.), formularios (Decl.) | Facturación y seguros de EE.UU., portal de pagos (Decl.) | Cientos de bridges (imágenes), más de 20 clearinghouses (Decl.) | Self-hosted; consultas propias sobre la base (Decl.) | **USD 199/mes por sede** (12 meses), luego USD 149 | No evidenciado en la página leída |
| 16 | Dentally | Charting, notas con IA, imágenes con detección por IA (Decl.) | Reportes en tiempo real (Decl.) | NHS/HSC (Reino Unido) (Decl.) | Visibilidad de grupo multisede (Decl.) | No publicado | No evidenciado |

---

## B. Matriz de puntuación (0 a 5)

| Criterio | Peso |
|---|---|
| T — Gestión de turnos y automatización | 25 % |
| C — Funcionalidad odontológica clínica | 20 % |
| I — Integraciones locales y WhatsApp | 15 % |
| A — Administración, cobros y facturación | 15 % |
| P — Experiencia del paciente | 10 % |
| S — Seguridad, exportación y trazabilidad | 10 % |
| $ — Precio y facilidad de adopción | 5 % |
| **Total** | **100 %** |

| Sistema | T | C | I | A | P | S | $ | **Total ponderado** |
|---|---|---|---|---|---|---|---|---|
| OdontoClinIA | 5 | 5 | 4 | 3 | 4 | 3 | 2 | **4,10** |
| AgendaPro | 5 | 4 | 4 | 3 | 5 | 2 | 5 | **4,05** |
| DentalSoft | 5 | 4 | 3 | 4 | 4 | 2 | 3 | **3,85** |
| Bilog | 4 | 4 | 3 | 5 | 4 | 2 | 4 | **3,80** |
| Dentalink | 4 | 5 | 3 | 4 | 4 | 2 | 2 | **3,75** |
| DentalTec | 3 | 3 | 5 | 5 | 2 | 4 | 2 | **3,55** |
| DentalCore | 5 | 2 | 4 | 4 | 3 | 1 | 3 | **3,40** |
| Open Dental | 4 | 5 | 1 | 3 | 4 | 3 | 1 | **3,35** |
| Odonto.ar | 3 | 4 | 2 | 3 | 3 | 3 | 5 | **3,15** |
| Doctocliq | 4 | 3 | 2 | 3 | 4 | 1 | 5 | **3,10** |
| Dentally | 4 | 4 | 1 | 2 | 4 | 2 | 1 | **2,90** |
| Odonthia | 3 | 4 | 2 | 1 | 3 | 3 | 5 | **2,85** |
| Reservo | 3 | 2 | 4 | 3 | 3 | 1 | 2 | **2,70** |
| Clinic Cloud | 4 | 2 | 1 | 3 | 3 | 2 | 2 | **2,60** |
| Doctoralia PRO | 4 | 1 | 1 | 1 | 5 | 2 | 4 | **2,40** |
| Dentidesk | 2 | 4 | 1 | 3 | 1 | 1 | 1 | **2,15** |

Total ponderado = Σ (nota × peso). El máximo posible es 5,00. Las cuentas se recalcularon con un script y la suma de pesos da 100 %.

### Nota metodológica

- **Qué significa cada nota**: 0 = no hay ninguna evidencia del criterio; 1 = evidencia mínima o que no aplica a Argentina; 2 = cobertura parcial; 3 = cobertura básica del criterio; 4 = cobertura amplia con algún hueco; 5 = cobertura amplia y específica para el contexto argentino o con evidencia más fuerte (documentación o demo).
- **Cómo se trataron los "No evidenciado"**: una función No evidenciado **no suma** a la nota del criterio. No se presume que exista. Por eso un producto con poca información pública (Dentidesk, Reservo) puntúa bajo aunque en la práctica pueda ser bueno: **la matriz mide evidencia pública, no calidad real**.
- **Criterio I (integraciones locales)**: se valoran por igual las obras sociales, ARCA, la receta electrónica ReNaPDiS, Mercado Pago y WhatsApp. Las integraciones de otros países (FONASA, NHS, Verifactu) valen 1.
- **Criterio $**: suma un precio publicado, un plan gratuito o una prueba sin tarjeta; resta un precio solo "a cotizar" o pensado para otro mercado.
- **Sesgo conocido**: las notas son juicios del analista (agente de IA) sobre afirmaciones comerciales. **El equipo tiene que revisarlas y ajustarlas** antes de la entrega.

---

## C. Análisis competitivo

### C.1 Funcionalidades que ya son estándar de mercado
- Agenda multiprofesional con vista diaria y semanal (prácticamente todos).
- Reserva online por link o web (12 de 16 la declaran).
- Recordatorios automáticos, en el mercado local casi siempre por **WhatsApp** (DentalTec, OdontoClinIA, DentalSoft, AgendaPro, Dentalink, Doctocliq, DentalCore, Odonthia en planes pagos).
- Odontograma digital FDI e historia clínica con adjuntos.
- Presupuestos y planes de tratamiento.
- Caja y cobros básicos.
- Asistentes de IA. Desde 2026 casi todos los proveedores muestran alguno, ya sea para agendar por WhatsApp, dictar notas o analizar radiografías.

### C.2 Funcionalidades diferenciadoras reales
- **Validación online de prácticas contra obras sociales** antes de cargarlas (DentalTec). Es la única integración profunda con obras sociales que aparece documentada en detalle.
- **Receta electrónica desde una plataforma inscripta en ReNaPDiS** (OdontoClinIA N.º 248; Dentalink AR con documentación en su centro de ayuda). Hay obligación normativa vigente, según el blog de Reservo, un dato a verificar en la fuente oficial del Ministerio de Salud.
- **Odontograma versionado con bloqueo y comparación entre versiones** (OdontoClinIA, comprobable en demo pública) y HC versionada donde lo firmado no se edita (Odonthia).
- **Marketplace y visibilidad** (AgendaPro con Google Reserve y marketplace; Doctoralia con su directorio): traen pacientes, no solo ordenan la agenda.
- **Alertas clínicas** de alergias y medicación cruzadas con el tratamiento (DentalCore).
- **Precio publicado en pesos y plan gratuito** (AgendaPro, Doctoralia, Odonthia, Bilog Freemium). En un mercado donde la mitad de los proveedores no publica precio, esto pesa.

### C.3 Vacíos frecuentes en el mercado argentino
1. **Prevención de solapamientos sin documentar.** Ningún sistema explica cómo evita superponer turnos del mismo profesional o del mismo sillón, ni cómo trata los bordes (un turno que empieza justo cuando termina otro). Solo 2 de 16 mencionan sillones.
2. **Sillones y boxes como recurso de agenda.** Casi todos modelan "profesional" o "consultorio", pero no el sillón como recurso compartido con su propia disponibilidad.
3. **Sobreturnos explícitos.** Ningún sistema los documenta, aunque son una práctica habitual (las "urgencias" de DentalSoft son lo más cercano).
4. **Cumplimiento normativo declarado.** Ninguna página consultada menciona la Ley 25.326 ni la Ley 26.529, ni cómo se exportan los datos del paciente si el consultorio cambia de sistema (solo Odonto.ar responde en sus preguntas frecuentes "Si dejo de pagar o me voy, ¿pierdo mis datos?", sin respuesta visible en el texto relevado).
5. **Opacidad de precios.** 7 de 16 no publican el precio de la licencia.
6. **Fragmentación.** Los que integran bien las obras sociales (DentalTec) no muestran reserva online, y los fuertes en experiencia del paciente (AgendaPro, Doctoralia) no muestran obras sociales ni ARCA.
7. **Periodontograma.** Solo Dentidesk declara una ficha de periodoncia.

### C.4 Oportunidades de innovación
- **Una agenda odontológica "correcta por construcción"**: profesional, sillón y prestación con duración variable como recursos de primer nivel, rechazo de solapamientos con mensajes claros y reglas de borde documentadas y testeadas. Es justo la regla que nadie muestra.
- **Cancelación y reprogramación que liberen el horario** y, más adelante, una **lista de espera** que ofrezca automáticamente el hueco liberado (solo Doctoralia VIP y Dentally lo declaran).
- **Transparencia como argumento**: precio en pesos publicado, exportación de datos documentada y adecuación a la Ley 25.326 declarada.
- **Trazabilidad de la agenda**: quién creó, movió o canceló cada turno (auditoría). Hoy solo DentalTec la detalla, y para la facturación.
- **Integración progresiva del ecosistema local** (WhatsApp, después ARCA y receta electrónica, después obras sociales) sobre un núcleo de agenda sólido, en lugar de intentar cubrir todo desde el inicio.

---

## D. Recomendación final

### D.1 Cinco competidores prioritarios para analizar mediante demo
1. **Bilog**: el de mayor trayectoria declarada en Argentina, con plan gratuito para probar la agenda real sin contactar a ventas.
2. **AgendaPro**: referente de reserva online y experiencia del paciente, con precios en pesos; además es el único que declara agenda "por sillón" y duración por práctica.
3. **OdontoClinIA**: mejor puntuación de la matriz; agenda por sillón, IA por WhatsApp y receta en ReNaPDiS.
4. **DentalTec**: el mejor caso de integración con obras sociales y ARCA, y de seguridad declarada (roles y auditoría).
5. **Dentalink**: competidor regional grande, con un módulo argentino documentado en su centro de ayuda.

> Por la consigna, la "demo" se hace con planes gratuitos, pruebas sin datos personales reales o demos públicas. No se crean cuentas con datos reales ni se contacta a los proveedores.

### D.2 Tres productos de referencia para experiencia de usuario
1. **AgendaPro**: el recorrido del paciente de punta a punta (reserva 24/7, recordatorio, seña, confirmación).
2. **Odonto.ar**: el flujo de reserva por link con reglas configurables y una página de precios simple y transparente.
3. **Dentally**: la experiencia del paciente y el relleno de turnos liberados con poca anticipación.

### D.3 MVP sugerido

> Ajustado el 2026-11-21 con las respuestas de la entrevista de Discovery (EP): segmento de 1 a 3 profesionales con recepcionista; la reserva online, el email con Google Calendar, el precio y las ganancias, la historia clínica y el odontograma pasan al MVP. Detalle en `docs/discovery/discovery.md`.

**Imprescindibles (MVP):**
1. Alta y gestión de **profesionales**, **sillones o boxes** y **prestaciones con duración (múltiplos de 15 min) y precio**.
2. **Agenda** diaria y semanal por profesional y por sillón, en bloques de 15 minutos.
3. **Crear turno evitando solapamientos por profesional y por sillón o box**, tratando los intervalos como [inicio, fin) para que un turno pueda empezar justo cuando termina otro. Sin sobreturnos.
4. **Cancelar turno** liberando el horario y **reprogramar turno** con las mismas validaciones. El paciente puede hacerlo hasta 24 h antes; la cancelación no borra el turno, que queda con estado cancelado.
5. **Estados del turno** (reservado, confirmado, atendido, ausente, cancelado) y **bloqueos de agenda** (feriados, ausencias del profesional, mantenimiento del sillón).
6. **Reserva online del paciente**, con **email de confirmación** y botón **"Agregar a Google Calendar"**.
7. **Ganancias del profesional**: suma del precio de los turnos atendidos, visible solo para él.
8. **Historia clínica y odontograma** del paciente. En el repositorio, siempre con **datos ficticios**.
9. **Roles** (profesional, recepcionista, paciente) con permisos y **registro de auditoría** de altas, modificaciones y cancelaciones de turnos.

**Diferenciadores (siguiente ola):**
- Recordatorios y confirmación por **WhatsApp** con actualización automática del estado del turno.
- **Lista de espera** que ofrece automáticamente los huecos liberados.
- **Recall** de controles periódicos y pacientes inactivos.
- **Exportación de datos** del consultorio y adecuación declarada a la Ley 25.326.

**Para etapas posteriores:**
- Periodontograma, imágenes y radiografías.
- Presupuestos y planes de tratamiento; caja, cobros y señas con Mercado Pago.
- Facturación electrónica ARCA; liquidación y validación online con obras sociales.
- Receta electrónica ReNaPDiS; firma digital de consentimientos.
- Asistentes de IA, marketing y campañas, app móvil, multisucursal y API pública.

---

## Verificación de fuentes

> **Pendiente: esta sección la tienen que completar los integrantes del equipo**, abriendo cada URL personalmente. El agente de IA no puede reemplazar esa verificación (consigna, criterio de 10 puntos). La tabla propone un conjunto mínimo con una fuente de cada tipo. Se pueden sumar más (se recomiendan entre 8 y 10).

| # | Tipo de fuente | URL | Qué afirma este informe | Verificado por | ¿Está en la URL? (Sí / No / Parcial) | Corrección aplicada |
|---|---|---|---|---|---|---|
| 1 | Sitio oficial | https://web.dentaltec.com.ar/funcionalidades | Validación online con +15 obras sociales vía SOAP, integración ARCA, 10 roles y auditoría | (completar) | (completar) | (completar) |
| 2 | Página de precios | https://agendapro.com/ar/planes | Planes de ARS 9.900, 19.900, 39.900 y 129.900 por mes con IVA; ficha clínica desde Premium | (completar) | (completar) | (completar) |
| 3 | Centro de ayuda | https://ayuda.softwaredentalink.com/es/collections/19196578-modulo-exclusivo-para-argentina | Módulo argentino con obras sociales, conciliaciones y receta electrónica | (completar) | (completar) | (completar) |
| 4 | Video oficial | Videos testimoniales en https://www.softwaredentalink.com/planes | Clientes de México, Colombia y Chile describen la automatización de la agenda | (completar) | (completar) | (completar) |
| 5 | Marketplace / reseñas | https://www.capterra.es/software/196361/dentalink | Precio inicial de 29 US$/mes; 2 opiniones (5,0); empresa en Santiago de Chile, fundada en 2009 | (completar) | (completar) | (completar) |
| 6 | Demo pública | https://www.clinia.com.ar/odontologia | Odontograma interactivo FDI; recetario ReNaPDiS N.º 248 | (completar) | (completar) | (completar) |
| 7 | Página de precios | https://odonto.ar/ | USD 29, 49 y 99 por mes; 30 días gratis; pago en ARS por Mercado Pago | (completar) | (completar) | (completar) |

**Hallazgos detectados por el propio agente durante la investigación** (sirven de insumo para la reflexión):
- Un resumen automático de búsqueda nombró a "Benty" como software con fuerte manejo de obras sociales. **No se encontró ninguna fuente oficial** y se excluyó del informe.
- La "Certificación CENS e integración con FONASA" que muestra AgendaPro en su página argentina **corresponde a Chile**. No se tomó como evidencia de cumplimiento en Argentina.
- DentalTec etiqueta sus métricas como "Resultado comprobado" sin citar ninguna fuente. Se tratan como afirmación comercial.
- Los precios "USD 20–150" que aparecían en la búsqueda salen de un blog de un proveedor (DentalCore). No se usaron como precios de mercado.

---

## Referencias

Todas consultadas el 2026-11-21.

1. Bilog — https://bilog.com.ar/ · https://bilog.com.ar/funcionalidades/ · https://bilog.com.ar/planes/
2. DentalTec — https://web.dentaltec.com.ar/funcionalidades
3. OdontoClinIA (ClinIA) — https://www.clinia.com.ar/odontologia
4. DentalSoft — https://www.dentalsoft.com.ar/
5. Odonto.ar — https://odonto.ar/
6. DentalCore — https://dentalcore.app/
7. Odonthia — https://odonthia.com/
8. AgendaPro — https://agendapro.com/ar/dental/software-odontologico · https://agendapro.com/ar/planes
9. Dentalink — https://www.softwaredentalink.com/ · https://www.softwaredentalink.com/planes · https://ayuda.softwaredentalink.com/es/collections/19196578-modulo-exclusivo-para-argentina
10. Capterra España, ficha de Dentalink — https://www.capterra.es/software/196361/dentalink
11. Reservo — https://reservo.cl/ar/ · https://reservo.cl/blog/profesionales/dental/guia-para-elegir-el-mejor-software-dental-en-argentina/ (contenido del proveedor)
12. Doctoralia PRO Argentina — https://pro.doctoralia.com/ar/precio · https://www.doctoraliar.com/clinicas
13. Doctocliq — https://www.doctocliq.com/ · https://www.doctocliq.com/planes-y-precios
14. Dentidesk — https://www.dentidesk.com/
15. Clinic Cloud — https://clinic-cloud.com/
16. Open Dental — https://www.opendental.com/ · https://www.opendental.com/site/fees.html
17. Dentally — https://www.dentally.com/en-gb/

Fichas por sistema: `docs/discovery/sources/`.
