import { buildApp } from './app';
import { PORT } from './shared/config';
import { crearRepositoriosEnMemoria } from './shared/repositorios';
import { cargarSeedDemo } from './shared/seed-demo';

// Los pacientes de demostración solo existen al levantar la API; los tests arman la app sin ellos.
const repos = crearRepositoriosEnMemoria();
cargarSeedDemo(repos, new Date());
const app = await buildApp({ logger: true, repos });
await app.listen({ port: PORT, host: '0.0.0.0' });
