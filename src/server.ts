import { buildApp } from './app';
import { PORT } from './shared/config';

const app = await buildApp({ logger: true });
await app.listen({ port: PORT, host: '0.0.0.0' });
