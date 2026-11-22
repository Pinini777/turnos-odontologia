import type { FastifyInstance } from 'fastify';
import { registrarRutasAgenda } from './rutas-agenda';
import { registrarRutasCatalogos } from './rutas-catalogos';

export default async function configuracionRoutes(app: FastifyInstance): Promise<void> {
  await registrarRutasCatalogos(app);
  await registrarRutasAgenda(app);
}
