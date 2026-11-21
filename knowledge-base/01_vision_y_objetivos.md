# Visión y Objetivos

> Fuentes: `docs/discovery/discovery.md` (entrevista de Discovery con EP, 2026-11-21) y `docs/discovery/informe-discovery.md` (16 sistemas relevados).

## Propósito del sistema

**Una agenda odontológica que no permite turnos superpuestos.** Es un sistema de turnos para consultorios odontológicos chicos de Argentina, con 1 a 3 profesionales y recepcionista. Garantiza que ningún profesional y ningún box queden con dos turnos superpuestos, y deja que el paciente reserve su turno online.

Contexto: el Discovery relevó 16 sistemas (Bilog, DentalTec, OdontoClinIA, AgendaPro, Dentalink y otros). La agenda, la reserva online y los recordatorios ya son estándar de mercado. Pero **ninguno documenta públicamente la regla con la que previene solapamientos**, y solo 3 de 16 tratan el box como un recurso de la agenda. Ese es el vacío que el producto ataca primero: una agenda "correcta por construcción", con reglas de borde documentadas y testeadas (informe, sección C.3 y C.4).

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Paciente | Reservar un turno online sin llamar | Cancelar o reprogramar hasta 24 h antes; agregar el turno a Google Calendar |
| Recepcionista | Agendar, modificar y cancelar turnos de pacientes que llaman o vienen | Ver la agenda del día por profesional y por box |
| Profesional (odontólogo) | Trabajar con una agenda sin superposiciones | Definir prestaciones con duración y precio; ver sus ganancias; registrar historia clínica y odontograma |

## Alcance v1.0 (MVP)

- Alta y gestión de profesionales, boxes y prestaciones con duración (múltiplos de 15 min) y precio.
- Agenda diaria y semanal por profesional y por box, en bloques de 15 minutos.
- **Crear turno evitando solapamientos por profesional y por box**, con intervalos [inicio, fin). Sin sobreturnos.
- Cancelar y reprogramar turnos liberando el horario. La cancelación es lógica: no hay borrado físico.
- Estados del turno (reservado, confirmado, atendido, ausente, cancelado) y bloqueos de agenda.
- Reserva online del paciente, con email de confirmación y botón "Agregar a Google Calendar".
- Vista de ganancias del profesional, que solo ve él.
- Historia clínica y odontograma del paciente.
- Roles (profesional, recepcionista, paciente) con permisos y auditoría de los cambios en turnos.
- Interfaz web responsive (celular y escritorio) para los tres roles, construida sobre el design system del proyecto.

## Fuera de alcance (v1.0)

Decidido en el Discovery (`discovery.md` §6) y en la sección D.3 del informe:

- Recordatorios y confirmación por WhatsApp; lista de espera; recall de controles.
- Presupuestos, caja, cobros, señas y Mercado Pago.
- Facturación electrónica ARCA; liquidación y validación con obras sociales (la obra social es solo un dato informativo del paciente).
- Receta electrónica (ReNaPDiS), periodontograma, imágenes y radiografías.
- App móvil nativa, multisucursal, API pública y asistentes de IA.
- Sincronización con la cuenta de Google del profesional (OAuth).
- Diseño visual fuera del design system aprobado. Toda pantalla nueva pasa por un mockup aprobado antes de implementarse (política `system-and-mockups`, DD-09).

## Métricas de éxito

| Métrica | Meta | Cómo se mide |
|---|---|---|
| Turnos superpuestos creados | 0 | Tests por escenario (feliz, error de negocio y borde) en verde, más una consulta de control sobre los turnos activos |
| Reglas de agenda cubiertas por tests | 100 % de RN-AG y RN-TU | Un test por escenario del spec de cada change |
| Reserva online sin intervención | Paciente reserva, cancela o reprograma sin llamar | Flujo F-03 ejecutado de punta a punta |
| Trazabilidad | Todo alta, cambio o cancelación de turno queda auditado | Registros de auditoría por operación |

## Contexto académico

Proyecto del Trabajo Global SDD + Active Stack (UTN FRM, Desarrollo de Software), con entrega el **25/11/2026 a las 23:00**. El único change evaluado es "Crear un turno evitando solapamientos por profesional y por box". El resto del MVP se reparte como changes paralelos del equipo de 6, según `CHANGES.md`.
