# Modelo de Datos

## Dominios

| Dominio | Entidades | Descripción |
|---|---|---|
| Configuración | Profesional, Box, Prestación, HorarioAtencion, BloqueoAgenda | Recursos que se reservan y sus reglas de disponibilidad |
| Agenda | Turno, AuditoriaTurno | El núcleo: turnos que ocupan profesional + box en un intervalo |
| Pacientes | Paciente | Datos de contacto y obra social (informativa). Siempre ficticios en el repo |
| Clínica | EntradaHistoriaClinica, Odontograma, EstadoPieza | Registro clínico del profesional (append-only) |
| Acceso | Usuario | Cuentas de profesionales y recepcionistas |

## ERD

```
Usuario ──(0..1)── Profesional
                      │1
          ┌───────────┼──────────────┬───────────────┐
          │*          │*             │*              │*
   HorarioAtencion  BloqueoAgenda  Turno ───*──1── Prestación
                      │(prof. o box) │ *
                      │              ├──1── Box ──*── BloqueoAgenda
                                     ├──1── Paciente ──1── Odontograma ──*── EstadoPieza
                                     └──*── AuditoriaTurno      │
                                                 Paciente ──*── EntradaHistoriaClinica ──1── Profesional (autor)
```

## Entidades

### Profesional
- `id: UUID` · `nombre: string` · `matricula: string` · `activo: boolean` · `usuarioId: UUID`
- Relaciones: 1 Profesional → * Turno, * HorarioAtencion, * BloqueoAgenda
- Constraints: `matricula` única.

### Box
- `id: UUID` · `nombre: string` (ej. "Box 1") · `activo: boolean`
- Relaciones: 1 Box → * Turno, * BloqueoAgenda
- Constraints: `nombre` único. Un box inactivo no recibe turnos nuevos.
- *Terminología*: los proveedores lo llaman "sillón" o "unidad dental". En este proyecto se usa **box**.

### Prestación
- `id: UUID` · `nombre: string` · `duracionMin: int` · `precio: decimal(12,2)` (ARS) · `reservableOnline: boolean` · `activa: boolean`
- Constraints: `duracionMin > 0` y `duracionMin % 15 == 0` (RN-AG-06); `precio >= 0`.

### HorarioAtencion
- `id` · `profesionalId` · `diaSemana: 1..7` · `desde: HH:mm` · `hasta: HH:mm`
- Constraints: `desde < hasta`, ambos en la grilla de 15 min.

### BloqueoAgenda
- `id` · `profesionalId?: UUID` · `boxId?: UUID` · `inicio: datetime` · `fin: datetime` · `motivo: string`
- Constraints: exactamente uno de `profesionalId` o `boxId`; `inicio < fin`.

### Paciente
- `id` · `usuarioId?: UUID` (cuenta del paciente; vacío si lo cargó la recepcionista y todavía no se registró) · `nombre` · `apellido` · `documento: string` · `email` · `telefono?` · `obraSocial?: string` · `plan?: string` · `nroAfiliado?: string`
- Constraints: `documento` único; `email` único. Al registrarse, un paciente cargado antes por la recepción se vincula por documento + email (PA-10). **Datos ficticios en seeds, tests y capturas** (RN-DA-01).

### Turno
- `id: UUID` · `profesionalId` · `boxId` · `prestacionId` · `pacienteId`
- `inicio: datetime` · `fin: datetime` (= `inicio + prestacion.duracionMin`)
- `estado: reservado | confirmado | atendido | ausente | cancelado`
- `origen: online | recepcion | profesional`
- `precioAlReservar: decimal` (snapshot del precio, RN-GA-02)
- `creadoPor: usuarioId` · `creadoEn: datetime`
- Constraints:
  - Intervalo semiabierto `[inicio, fin)` (RN-AG-04).
  - **Sin superposición entre turnos no cancelados del mismo profesional ni del mismo box** (RN-AG-02, RN-AG-03). Se valida en el dominio y, con SQLite, también en una transacción serializada.
- Índices: `(profesionalId, inicio)`, `(boxId, inicio)`, `(pacienteId, inicio)`.

### AuditoriaTurno
- `id` · `turnoId` · `accion: creado | reprogramado | cancelado | estado_cambiado` · `actor: usuarioId | "paciente"` · `fecha` · `detalle: json` (valores antes y después)
- Append-only: nunca se modifica ni se borra.

### EntradaHistoriaClinica
- `id` · `pacienteId` · `profesionalId` (autor) · `fecha` · `texto` · `turnoId?`
- Append-only: una corrección es una entrada nueva que referencia a la anterior.

### Odontograma y EstadoPieza
- `Odontograma`: `id` · `pacienteId` (1 a 1) · `actualizadoEn`
- `EstadoPieza`: `pieza: FDI 11..48 y 51..85` · `cara?: oclusal | mesial | distal | vestibular | lingual` · `estado: sano | caries | obturado | ausente | corona | endodoncia | a_extraer` · `registradoPor` · `fecha`
- El nivel de detalle (con o sin caras) es una pregunta abierta (PA-06).

### Usuario
- `id` · `email` · `hashPassword` · `rol: profesional | recepcionista | paciente` · `activo`
- Sin contraseñas reales en el repo: los seeds usan valores de ejemplo y van en `.env.example`.

## Seed data inicial (ficticia)

| Tipo | Datos |
|---|---|
| Profesionales | "Dra. Ana Pérez" (MP 0001), "Dr. Bruno Gómez" (MP 0002) |
| Boxes | "Box 1", "Box 2" |
| Prestaciones | Consulta (30 min), Limpieza (45 min), Extracción simple (60 min), Control (15 min), con precios de ejemplo |
| Horarios | Lunes a viernes, 09:00 a 13:00 y 15:00 a 19:00 |
| Pacientes | "Paciente Ficticio Uno", DNI 00000001, email `paciente1@example.com` (y así sucesivamente) |
| Usuarios | `profesional@example.com`, `recepcion@example.com` y `paciente1@example.com`, con contraseñas de ejemplo solo en `.env.example` |
