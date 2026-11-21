# Actores y Roles

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|---|---|---|
| **Profesional** (odontólogo) | Atiende pacientes y es dueño de su agenda y de sus números. Entre 1 y 3 por consultorio. | API autenticada: configura prestaciones, precios, horarios y bloqueos; gestiona turnos; registra HC y odontograma; consulta sus ganancias |
| **Recepcionista** | Atiende al paciente que llama o se presenta. | API autenticada: ve pacientes y turnos; agenda, modifica y cancela turnos. No ve precios ni ganancias |
| **Paciente** | Persona que se atiende en el consultorio. En el repositorio, **siempre ficticio**. | **Con cuenta propia** (PA-01): se registra, inicia sesión, consulta disponibilidad, reserva y cancela o reprograma sus turnos hasta 24 h antes |
| Sistema (proceso) | Envía emails y registra auditoría. | Interno, disparado por los casos de uso |

> "Eliminar" un turno, para cualquier rol, significa **cancelarlo** (RN-TU-03).

## RBAC — Matriz de permisos

C = crear · L = leer · M = modificar · X = cancelar · — = sin acceso

| Recurso | Profesional | Recepcionista | Paciente (autenticado) |
|---|---|---|---|
| Profesionales, boxes | C L M | L | L (nombre, para elegir) |
| Prestaciones: nombre y duración | C L M | L | L (las reservables) |
| Prestaciones: **precio** | C L M | — | — |
| Horarios de atención y bloqueos | C L M X (**cada profesional, los suyos**; PA-02) | L | — |
| Pacientes (datos de contacto, obra social) | C L M | C L M | L M (solo los propios) |
| Turnos | C L M X | C L M X | C; L de los propios; X/M de los propios hasta 24 h antes |
| Estado del turno (confirmado, atendido, ausente) | M | M | — |
| **Ganancias** | L (solo las propias) | — | — |
| Historia clínica y odontograma | C L (entradas append-only) | — | — |
| Auditoría de turnos | L | — | — |

Reglas asociadas: RN-RO-01 a RN-RO-04 ([05_reglas_de_negocio.md](05_reglas_de_negocio.md)).

## Rutas públicas

Accesibles sin autenticación. Todo lo que opera sobre turnos requiere la **cuenta del paciente** (PA-01):

- `POST /api/public/pacientes/registro`: alta de la cuenta del paciente (email y contraseña, más sus datos).
- `POST /api/public/login`: inicio de sesión para cualquier rol.
- `GET /api/public/prestaciones`: prestaciones reservables, sin precio.
- `GET /api/public/disponibilidad?prestacionId&desde&hasta[&profesionalId]`: huecos libres (sin datos de otros pacientes).

Rutas del paciente autenticado (`/api/paciente/...`): reservar, listar sus turnos, cancelar o reprogramar hasta 24 h antes y descargar el `.ics`.

## Escala

Un consultorio (sin multi-tenant), de 1 a 3 profesionales, 1 o más recepcionistas y pacientes con cuenta. Orientativo: decenas de turnos por día.
