/** Variables de entorno, leídas una sola vez. El dominio nunca lee process.env. */
export const APP_TZ = process.env.APP_TZ ?? 'America/Argentina/Mendoza';
export const PORT = Number(process.env.PORT ?? 3000);
