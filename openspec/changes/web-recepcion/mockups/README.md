# Mockups de C-13 `web-recepcion`

- Design system revision: 2 (`design-system/tokens.css`, `design-system/brand.js`, `design-system/assets/logo.svg`)
- Approval: pending
- Todos los datos son ficticios ("Paciente Ficticio Uno" a "Ocho", DNI `00000001`, `@example.com`).

## Pantallas

| Archivo | Pantalla | Estado que muestra | Escenarios del spec |
|---|---|---|---|
| `agenda.html` | Agenda del día por box | Turnos contiguos (10:00 y 10:30 del Box 1) sin marca de conflicto; los cinco estados; un cancelado que libera el horario; el menú de acciones de un turno `reservado` abierto (Confirmar, Reprogramar, Cancelar). En celular, lista por hora. | Agenda por día; Turnos contiguos; Acciones según el estado |
| `nuevo-turno.html` | Nuevo turno | El hueco de las 10:30 se ocupó mientras se cargaba: alerta `SOLAPAMIENTO_PROFESIONAL` con el texto legible de C-12, lista de huecos actualizada, paciente conservado, box "Automático". | Nuevo turno en un hueco libre; Paciente existente o nuevo; Errores de negocio legibles |
| `reprogramar.html` | Reprogramar | Turno `confirmado` de las 10:00 movido al hueco de las 11:00; aviso de que vuelve a `reservado` y se reenvía el email. | Reprogramar eligiendo un hueco libre |

`recepcion.css` tiene los estilos compartidos; solo usa tokens del design system.

## Capturas

En `previews/`, renderizadas el 2026-11-23 en el navegador integrado:

- `desktop-1440x900-agenda.jpg`, `mobile-390x844-agenda.jpg`
- `desktop-1440x900-nuevo-turno.jpg`, `mobile-390x844-nuevo-turno.jpg`
- `desktop-1440x900-reprogramar.jpg`, `mobile-390x844-reprogramar.jpg`

Sin errores de consola y con todos los recursos locales cargados (200/304).

## Cómo verlos

Las rutas a `design-system/` son relativas, así que hay que servir la raíz del repo (abrir el archivo con doble clic no carga los estilos en todos los navegadores):

```
python -m http.server 8766 --bind 127.0.0.1
```

y abrir `http://127.0.0.1:8766/openspec/changes/web-recepcion/mockups/agenda.html`.

## Fuera del mockup

La vista semanal, el filtro por profesional y la pantalla de pacientes siguen los mismos componentes y se describen en el spec; no tienen mockup propio porque la ficha de `CHANGES.md` pide solo agenda, nuevo turno con error y reprogramar.
