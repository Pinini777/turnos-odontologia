# Explore — C-16 Persistencia en Supabase

**Estado:** exploración local completada. No se consultó ni se modificó Supabase. C-01 a C-15 figuran mergeados en `CHANGES.md`; `dev-ep` ya incluía `origin/main` después de sincronizar.

## Punto de integración

`src/server.ts` arma hoy los repositorios en memoria y carga la semilla de demostración. `buildApp({ repos })` ya inyecta la misma instancia en los módulos, la autenticación y la disponibilidad. El handler existente convierte `ReglaDeNegocioError` en `409 {code}`. No se necesita cambiar `src/app.ts`, módulos ni interfaces.

| Puertos en `src/shared/repositorios.ts` | Entidades | Comportamiento actual |
|---|---|---|
| `Repositorio<T>` | Usuarios, profesionales, boxes, prestaciones, pacientes, turnos y odontogramas | Guardar por ID, buscar, listar y comprobar existencia. |
| `RepositorioConBorrado<T>` | Horarios y bloqueos | También permite borrar. |
| `RepositorioAppendOnly<T>` | Auditoría, historia clínica y estados de pieza | Agregar y listar; no edita ni borra. |

`EnMemoria` conserva el orden de inserción, clona los datos y recibe predicados JavaScript. Las entidades distinguen fechas `Date`, campos opcionales ausentes, documentos con ceros iniciales y valores en ARS con hasta dos decimales. En auditoría, alta, reserva online y reprogramación guardan fechas también dentro de `detalle`; los cambios de estado guardan valores de texto.

## Invariantes y dependencias de escritura

- **Agenda:** `crearLockDeAgenda` serializa en una instancia. Las exclusiones GiST propuestas refuerzan en la base RN-AG-02/03/04/07: profesional y box, intervalos `[inicio, fin)`, sin incluir cancelados. No reemplazan horarios, bloqueos ni grilla del dominio.
- **C-04:** registro, alta y actualización validan dentro del lock. El correo se recorta y pasa a minúsculas; el documento solo se recorta. Se impiden correos ajenos duplicados en ambos conjuntos y documentos repetidos en pacientes. Una ficha y su propia cuenta pueden compartir correo. Las unicidades de tabla son un refuerzo, no un reemplazo de la regla cruzada.
- **Reserva online:** `src/modules/reserva-online/aplicacion/reservar-turno.ts` agrega auditoría antes de guardar el turno nuevo. Su actor puede ser el literal `paciente`, no un ID de usuario.
- **Odontograma:** `src/modules/clinica/aplicacion/odontograma.ts` agrega estados antes de guardar la primera cabecera. Una FK inmediata para cualquiera de estos dos flujos rechazaría operaciones válidas. El diseño propone conservar los vínculos lógicos sin esas FKs ni cambiar el orden de escritura.
- **Siembra:** `cargarSeed` y `cargarSeedDemo` disparan escrituras sin esperarlas, válidas por la semántica de memoria. Se pueden reutilizar en un conjunto temporal en memoria y copiar el resultado a PostgreSQL con escrituras esperadas, sin modificar las semillas originales.
- **Specs vigentes:** `plataforma` describe memoria aislada por instancia y semilla en el arranque, sin contemplar un backend optativo. Se propone acotar ambos requisitos a sus respectivos modos, sin cambiar el contrato por defecto.

## Riesgos y límites por verificar en Apply

- Preparar `btree_gist` como dependencia compartida de la base no equivale a migrar un esquema de tests. La suite no debe instalar extensiones ni escribir en `public`.
- La inspección local no verifica las extensiones instaladas, los permisos del rol de conexión ni los advisors del proyecto autorizado. Verificar tras la aprobación, sin imprimir credenciales ni usar datos reales.
- `npm ci` en este checkout falló dos veces con `EPERM` al desvincular `esbuild.exe`. Con el mismo lockfile y los mismos manifiestos, `npm ci` instaló 323 paquetes en una copia temporal. La instalación del checkout queda pendiente antes de Apply.
