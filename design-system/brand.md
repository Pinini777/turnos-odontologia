# Marca — turnos-odontologia (Revisión 2)

| Elemento | Valor actual | Estado | Fuente |
|---|---|---|---|
| Nombre del producto | "Consultorio Odontológico" | Genérico (parametrizable) | Acordado en C-06 y C-12 hasta definir marca final |
| Logo | `assets/logo.svg` (emblema dental en línea sobre teal clínico + punto esmeralda de disponibilidad) | Propuesta rev. 2 | Rediseño aprobado por EP |
| Imágenes | Sin fotos reales; íconos SVG de línea limpios (`aria-hidden="true"`), sin emojis | Decidido | Cumple RN-DA-01 y reglas UI/UX |
| Idioma | Español rioplatense en voseo ("Ingresá a tu cuenta", "Elegí un horario") | Decidido | Mercado argentino (`knowledge-base/01`) |

## Tono visual

- **Clínico, luminoso y sereno.** Superficies blancas sobre fondo porcelana `#F4F8F9`, tinta pizarra `#0F2937` de alto contraste, teal clínico profundo `#0E7490` como color principal y esmeralda `#059669` solo para disponibilidad y confirmaciones.
- **Sin exageraciones.** Sin gradientes neón/violetas, sin tarjetas infladas, sin animaciones intrusivas. Las transiciones animan solo `transform` y `opacity` y respetan `prefers-reduced-motion`.
- **Agenda como identidad.** El diferencial del sistema (turnos por profesional y por box en bloques de 15 min sin solapamientos) aparece como apoyo visual sobrio en la pantalla de acceso.
- **Legibilidad en datos.** Horarios, DNI y cifras usan `font-variant-numeric: tabular-nums`.

## Reglas de uso

- Los errores de negocio explican qué pasó en lenguaje claro y accionable, nunca solo "Error".
- Los estados del turno (`reservado`, `confirmado`, `atendido`, `ausente`, `cancelado`) combinan color + texto explícito (nunca solo color).
- La recepcionista y el paciente nunca ven precios ni ganancias (RN-RO-01).
- En mockups, capturas y demos, solo datos 100 % ficticios (`@example.com`, DNI `00000001`).
