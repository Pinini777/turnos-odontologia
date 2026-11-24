# Proposal — C-16 Persistencia en Supabase

## Why

Un reinicio de la API elimina los datos que están en memoria. Se propone PostgreSQL como modo optativo para conservarlos sin obligar al equipo ni al CI a configurar un servicio externo.

## What Changes

- Agregar un adaptador para los 12 repositorios existentes, activado solo con `DATABASE_URL`.
- Versionar el esquema y reforzar los invariantes de agenda e inmutabilidad en PostgreSQL; no conceder acceso por la Data API pública.
- Inicializar una base vacía con datos ficticios, y verificar el mismo contrato de persistencia en ambos modos con pruebas aisladas.
- Mantener sin cambios las rutas, los casos de uso, los puertos, la autenticación de C-04 y el modo en memoria por defecto. No se migran datos previos ni se introduce Supabase Auth.

## Capabilities

### New Capabilities

- `persistencia`: selección de backend, equivalencia del adaptador, invariantes de base, migraciones, siembra y verificación aislada.

### Modified Capabilities

- `plataforma`: acotar el aislamiento por instancia al modo en memoria y precisar cuándo se cargan los datos semilla en cada modo.

## Impact

- Adaptador nuevo en `src/shared/persistencia/`, integración en `src/server.ts`, migraciones en `supabase/migrations/` y pruebas en `tests/persistencia/`.
- `postgres` con versión exacta será la única dependencia nueva. Los cambios de configuración y documentación no requieren credenciales en el repositorio ni cambios de UI.
- Change crítico: la propuesta no autoriza implementación, acceso a la base, migración ni publicación antes de la aprobación explícita de EP.
