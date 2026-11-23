# Marca — Clínica Dental Alvear (Revisión 2)

| Elemento | Valor actual | Estado | Fuente |
|---|---|---|---|
| Nombre del producto | "Clínica Dental Alvear" | Definido para la demo | Identidad ficticia realista (RN-DA-01) |
| Dirección y horario | Av. Alvear 1420, Ciudad de Mendoza · Lun a Vie 08:30 a 19:30 | Ficticios | Datos de fantasía para contexto clínico |
| Especialidades | Odontología general, Ortodoncia, Implantología, Endodoncia | Definido | Consultorio de 1 a 3 profesionales |
| Logo | `assets/logo.svg` (emblema dental sobre teal clínico + punto esmeralda) | Propuesta rev. 2 | Rediseño aprobado por EP |
| Imágenes | Sin fotos reales; íconos SVG de línea limpios (`aria-hidden="true"`), sin emojis | Decidido | Cumple RN-DA-01 y accesibilidad |
| Idioma | Español rioplatense en voseo ("Ingresá a tu cuenta", "Elegí un horario") | Decidido | Mercado argentino |

## Tono visual y redacción

- **Clínico, luminoso y real.** Cero jerga técnica visible para el usuario final (sin códigos de change, sin menciones a endpoints ni "maqueta").
- **Paleta estable.** Porcelana `#F4F8F9`, superficie blanca `#FFFFFF`, tinta pizarra `#0F2937`, teal clínico `#0E7490` y esmeralda salud `#059669`.
- **Privacidad por rol.** Recepción y paciente nunca ven precios ni ganancias; el paciente nunca ve turnos de otros pacientes.
- **Accesibilidad.** Contraste >= 4.5:1, `:focus-visible`, etiquetas ARIA y soporte completo para `prefers-reduced-motion`.
