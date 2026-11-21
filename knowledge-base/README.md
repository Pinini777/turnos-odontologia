# Turnos Odontología — Base de Conocimiento

Base de conocimiento generada con `kb-creator` (modo `import`) a partir de `docs/discovery/`: el informe de Discovery de 16 sistemas, el checklist de 11 puntos con las respuestas de EP y las fichas por competidor.

## Índice de archivos

| Archivo | Contenido |
|---|---|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito (agenda sin superposiciones), objetivos por actor, alcance del MVP, fuera de alcance, métricas |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack confirmado (Node + TypeScript; frontend React + Vite), arquitectura hexagonal, integraciones (email, Google Calendar), API REST |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Profesional, recepcionista y paciente; matriz RBAC; rutas públicas |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Entidades (Turno, Box, Prestación, Bloqueo, Paciente, HC, Odontograma…), ERD, seeds ficticios |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | RN-AG (agenda: box, solapamientos, [inicio, fin), grilla de 15 min, sin sobreturnos), RN-TU, RN-RE, RN-NO, RN-GA, RN-RO, RN-CL, RN-DA |
| [06_funcionalidades.md](06_funcionalidades.md) | 7 épicas, US-001 a US-061, con criterios de aceptación; US-010 es el change evaluado |
| [07_flujos_principales.md](07_flujos_principales.md) | F-01 crear turno, cancelar y reprogramar, reserva online, regla de 24 h, email + GCal, ganancias, clínica |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Patrones, estructura de directorios, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | DD-01 a DD-11 (stack, intervalos, box, cancelación lógica, precio congelado, paciente con cuenta…) y SU-01 a SU-04 |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Inconsistencias resueltas, PA-00 a PA-09 y puntos "No evidenciado" del Discovery |

## Quick start para desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md). **Empezá por RN-AG.**
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Antes de codificar → [10](10_preguntas_abiertas.md)

## Resumen ejecutivo

Agenda odontológica para consultorios de 1 a 3 profesionales con recepcionista. Su diferencial es una regla que ningún competidor documenta: **ningún profesional ni box puede tener turnos superpuestos**, con intervalos [inicio, fin), grilla de 15 minutos y sin sobreturnos. El MVP suma reserva online con email y Google Calendar, ganancias del profesional, historia clínica y odontograma. WhatsApp, cobros, ARCA y obras sociales quedan para después. Todos los datos de pacientes del repositorio son ficticios.
