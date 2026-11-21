# Discovery — Sistema de turnos para consultorios odontológicos (Argentina)

**Fecha**: 2026-11-21
**Fuentes investigadas**: 16 sistemas (ver `docs/discovery/sources/` y `docs/discovery/informe-discovery.md`)
**Respuestas de la entrevista**: EP (líder), 2026-11-21

## 1. Problema que resuelve

Los consultorios odontológicos chicos (1 a 3 profesionales, con recepcionista) gestionan los turnos a mano o con herramientas que no garantizan que un profesional o un box no queden con dos turnos superpuestos. Ninguno de los 16 sistemas relevados documenta públicamente cómo previene esos solapamientos, que son la regla central de una agenda odontológica.

## 2. Usuarios / roles

- **Profesional (odontólogo)**: gestiona su agenda, prestaciones y precio de la consulta; agenda, modifica y cancela turnos; registra historia clínica y odontograma; es el **único** que ve las ganancias.
- **Recepcionista**: ve pacientes y turnos; agenda, modifica y cancela turnos. No ve precios ni ganancias.
- **Paciente**: reserva su turno online y lo cancela o reprograma hasta 24 h antes.

## 3. Casos de uso

1. Como paciente, quiero reservar un turno online para atenderme sin tener que llamar.
2. Como paciente, quiero cancelar o reprogramar mi turno hasta 24 h antes para liberar el horario.
3. Como recepcionista, quiero agendar, modificar o cancelar turnos para atender a los pacientes que llaman o vienen en persona.
4. Como profesional, quiero definir prestaciones con duración y precio para que la agenda y las ganancias se calculen solas.
5. Como profesional, quiero ver mis ganancias para saber cuánto facturo.
6. Como profesional, quiero registrar la historia clínica y el odontograma del paciente para tener su evolución en un solo lugar.

## 4. Competidores / soluciones existentes

Detalle completo en `informe-discovery.md` (tablas A.1 y A.2, matriz B). Resumen de los cinco priorizados para demo:

| Competidor | Problema que resuelve | Pricing | Diferenciadores |
|---|---|---|---|
| Bilog (AR) | Gestión integral de consultorio y clínica | Freemium gratis; Lite y Premium a cotizar | Más de 20 años en el sector argentino, liquidaciones a obras sociales, app |
| AgendaPro (LATAM) | Llenar la agenda con reserva online y cobros | ARS 9.900 a 129.900 por mes | Agenda por box, Google Reserve, marketplace, IA por WhatsApp |
| OdontoClinIA (AR) | Digitalizar la consulta odontológica | No publicado | Agenda por box, odontograma versionado, receta ReNaPDiS |
| DentalTec (AR) | Débitos y facturación a obras sociales | No publicado | Validación online con más de 15 obras sociales, ARCA, roles y auditoría |
| Dentalink (CL) | Gestión de clínica dental con IA | A cotizar | Módulo argentino documentado, IA en todo el recorrido del paciente |

**Notas**: casi toda la evidencia es afirmación comercial del proveedor. Ninguno documenta la regla de prevención de solapamientos. Solo 3 tratan el box como recurso: AgendaPro y OdontoClinIA lo declaran, y Dentalink lo documenta junto con un "sobreagendamiento" explícito.

## 5. Funcionalidades necesarias (MVP)

- Alta y gestión de profesionales, boxes y prestaciones con duración y precio.
- Agenda diaria y semanal por profesional y por box.
- Crear turno evitando solapamientos por profesional y por box.
- Cancelar y reprogramar turno liberando el horario.
- Estados del turno (reservado, confirmado, atendido, ausente, cancelado) y bloqueos de agenda.
- Reserva online del paciente.
- Email de confirmación con botón "Agregar a Google Calendar".
- Vista de ganancias del profesional.
- Historia clínica y odontograma.
- Roles (profesional, recepcionista, paciente) con permisos y auditoría de los cambios en turnos.

## 6. Funcionalidades opcionales

- Recordatorios y confirmación por WhatsApp.
- Lista de espera que ofrezca los huecos liberados.
- Recall de controles periódicos y pacientes inactivos.
- Presupuestos, caja, cobros y señas con Mercado Pago.
- Facturación electrónica ARCA; liquidación y validación con obras sociales.
- Receta electrónica (ReNaPDiS), periodontograma, imágenes y radiografías.
- App móvil, multisucursal, API pública, asistentes de IA.

## 7. Reglas de negocio

- Todo turno ocupa **un profesional y un box** a la vez.
- **No se permiten solapamientos**: un profesional no puede tener dos turnos superpuestos, y un box tampoco.
- Los intervalos se tratan como **[inicio, fin)**: un turno que empieza justo cuando termina otro **no** se solapa.
- **No existen sobreturnos.**
- La agenda usa **bloques de 15 minutos**: los turnos empiezan en múltiplos de 15 y las prestaciones duran 15, 30, 45 o 60 minutos (múltiplos de 15).
- El paciente puede cancelar o reprogramar **hasta 24 h antes** del turno; después, solo el profesional o la recepcionista.
- "Eliminar" un turno es **cancelarlo**: pasa a estado cancelado, libera el horario y conserva quién lo hizo y cuándo. No hay borrado físico.
- Las **ganancias** son la suma del precio de las prestaciones de los turnos en estado **atendido**. Solo las ve el profesional.
- La recepcionista no ve precios ni ganancias.
- Los datos de pacientes en el repositorio, los ejemplos, los tests y las capturas son **siempre ficticios**.

## 8. Integraciones

- **Email**: confirmación del turno al paciente.
- **Google Calendar (del lado del paciente)**: botón o archivo `.ics` en el email para agregar el turno. **No** se sincroniza la cuenta de Google del profesional (evita OAuth en el MVP).
- Fuera del MVP, de forma consciente: WhatsApp, Mercado Pago, ARCA, obras sociales y ReNaPDiS (ver punto 6).

## 9. Restricciones

- Entrega el **25/11/2026 a las 23:00**, con un único change evaluado (etapa 6) que tiene que quedar archivado con tests en verde.
- No hace falta interfaz gráfica: puede ser API o módulo con lógica de dominio.
- **Stack sin restricciones**: se decide en la etapa 3 (KB).
- Equipo de 6 personas trabajando en paralelo por ramas `dev-<alias>` y PR a `main`.
- Sin datos reales de pacientes ni secretos en el repositorio.

## 10. Riesgos

- **Datos del Discovery mal citados** (riesgo elegido): si el informe tiene afirmaciones inventadas o mal leídas, se arrastran a la KB y al roadmap. Mitigación: verificación humana de al menos 5 fuentes, en realidad 7, antes de la etapa 3.
- **Coordinación de 6 personas en paralelo** (riesgo elegido): conflictos de merge en `openspec/specs/` y en archivos compartidos. Mitigación: reglas de `CONTRIBUTING.md` y changes secuenciados por el líder según `CHANGES.md`.
- **Alcance vs. fecha**: el MVP de producto creció (reserva online, email, ganancias, historia clínica, odontograma). Solo el change de la etapa 6 es obligatorio; el resto se reparte según el tiempo.
- **Supuesto sin probar**: que los pacientes prefieran reservar online en vez de llamar o escribir. No está validado con usuarios reales.
- **Datos sensibles de salud**: la historia clínica y el odontograma caen bajo la Ley 26.529 y la Ley 25.326. Ningún competidor declara cómo cumple. El diseño tiene que prever control de acceso y trazabilidad desde el inicio.

## 11. Preguntas abiertas

- ¿El paciente necesita cuenta con login para reservar, o alcanza con nombre, documento y email por turno?
- ¿Quién define y cómo los horarios de atención de cada profesional y la disponibilidad de cada box?
- ¿El precio de una prestación puede variar por profesional?
- ¿Qué pasa con las ganancias si un turno atendido se cancela o corrige después?
- ¿Qué nivel de detalle tiene el odontograma del MVP (piezas y estados, o también caras)?
- ¿Cómo se cumple con las Leyes 25.326 y 26.529 (consentimiento, acceso, conservación de la historia clínica)? Ningún competidor lo declara (No evidenciado).
- Puntos que el informe dejó como **No evidenciado** y que habría que validar con demos: exportación de datos, regla de prevención de solapamientos, sobreturnos y box como recurso (solo Dentalink documenta ambos), precios ocultos (7 de 16 sistemas).
