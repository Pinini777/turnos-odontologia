# Design system — turnos-odontologia

Mode: system-and-mockups
Revision: 2
Approval: approved (2026-11-23, by EP)

## Política visual

- **Dirección estética**: clínica moderna, limpia y cálida sin sobrecarga visual, construida aplicando `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines` y `vercel-react-best-practices`.
- **Única fuente de tokens**: `design-system/tokens.css`, importado directamente por `web/src/main.tsx` y por los mockups HTML de `openspec/changes/web-base/mockups/`.
- **Referencia viva**: abrir `design-system/components.html` en el navegador para revisar paleta, tipografía, botones, campos, badges de estado, alertas de error de negocio, tabla y estado vacío.

## Archivos

| Archivo | Uso |
|---|---|
| `tokens.css` | Tokens de color, tipografía, espaciado, radios, foco accesible y movimiento |
| `brand.md` | Identidad, tono visual y reglas de uso |
| `brand.js` | Nombre visible para mockups HTML |
| `assets/logo.svg` | Emblema SVG del consultorio |
| `components.html` | Catálogo interactivo de componentes compartidos |
