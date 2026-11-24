import { crearConexionPostgres } from './conexion';
import { leerMigraciones, migrarEsquema } from './migraciones';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no está configurada.');
  process.exitCode = 1;
} else {
  let sql: ReturnType<typeof crearConexionPostgres> | undefined;
  try {
    const migraciones = await leerMigraciones();
    sql = crearConexionPostgres(url);
    const cantidad = await migrarEsquema(sql, 'public', migraciones);
    console.log(`Migraciones aplicadas: ${cantidad}`);
  } catch {
    console.error('No se pudieron aplicar las migraciones de PostgreSQL.');
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 2 }).catch(() => { process.exitCode = 1; });
  }
}
