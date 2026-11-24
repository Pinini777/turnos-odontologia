import type postgres from 'postgres';
import { crearRepositoriosEnMemoria } from '../repositorios';
import type { Repositorio, RepositorioAppendOnly } from '../repositorios';
import { cargarSeedDemo } from '../seed-demo';
import { sqlDeTransaccion } from './conexion';
import { crearRepositoriosPostgres, TABLAS_APLICACION } from './repositorios-postgres';

async function copiar<T extends { id: string }>(origen: Repositorio<T>, destino: Repositorio<T>): Promise<void> {
  for (const fila of await origen.listar()) await destino.guardar(fila);
}

async function copiarHistorial<T>(origen: RepositorioAppendOnly<T>, destino: RepositorioAppendOnly<T>): Promise<void> {
  for (const fila of await origen.listar()) await destino.agregar(fila);
}

export async function sembrarPostgres(sql: postgres.Sql, ahora: Date, esquema = 'public'): Promise<boolean> {
  return sql.begin(async transaccion => {
    const tx = sqlDeTransaccion(transaccion);
    const destino = crearRepositoriosPostgres(tx, esquema);
    await tx`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${`turnos-odontologia:siembra:${esquema}`}))`;
    for (const tabla of TABLAS_APLICACION) {
      const [fila] = await tx<{ tiene: boolean }[]>`select exists(select 1 from ${tx(esquema)}.${tx(tabla)}) as tiene`;
      if (fila?.tiene) return false;
    }

    const base = crearRepositoriosEnMemoria();
    cargarSeedDemo(base, ahora);
    await copiar(base.usuarios, destino.usuarios);
    await copiar(base.profesionales, destino.profesionales);
    await copiar(base.boxes, destino.boxes);
    await copiar(base.prestaciones, destino.prestaciones);
    await copiar(base.pacientes, destino.pacientes);
    await copiar(base.horarios, destino.horarios);
    await copiar(base.bloqueos, destino.bloqueos);
    await copiar(base.turnos, destino.turnos);
    await copiar(base.odontogramas, destino.odontogramas);
    await copiarHistorial(base.auditoria, destino.auditoria);
    await copiarHistorial(base.historiaClinica, destino.historiaClinica);
    await copiarHistorial(base.estadosPieza, destino.estadosPieza);
    return true;
  });
}
