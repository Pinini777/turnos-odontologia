import postgres from 'postgres';

export function crearConexionPostgres(url: string) {
  return postgres(url, { ssl: 'require', max: 3, connect_timeout: 10, onnotice: () => {} });
}

export function sqlDeTransaccion(tx: postgres.TransactionSql): postgres.Sql {
  // La definición Omit de postgres 3.4.8 omite las firmas invocables que sí existen en runtime.
  if (typeof tx !== 'function') throw new Error('No se pudo abrir la transacción.');
  return tx as unknown as postgres.Sql;
}
