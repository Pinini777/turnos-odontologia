import { buildApp } from './app';
import { PORT } from './shared/config';
import { abrirRepositorios } from './shared/persistencia/arranque';

async function iniciar(): Promise<void> {
  const { repos, cerrar } = await abrirRepositorios(process.env.DATABASE_URL, new Date());
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  try {
    app = await buildApp({ logger: true, repos });
    const servidor = app;
    let cerrando = false;
    const apagar = () => {
      if (cerrando) return;
      cerrando = true;
      void servidor.close().catch(() => {
        console.error('No se pudo cerrar la API normalmente.');
        process.exitCode = 1;
      });
    };
    servidor.addHook('onClose', async () => {
      process.off('SIGINT', apagar);
      process.off('SIGTERM', apagar);
      await cerrar();
    });
    process.once('SIGINT', apagar);
    process.once('SIGTERM', apagar);
    await servidor.listen({ port: PORT, host: '0.0.0.0' });
  } catch {
    await (app ? app.close() : cerrar()).catch(() => {});
    throw new Error('No se pudo iniciar la API.');
  }
}

try {
  await iniciar();
} catch (error) {
  console.error(error instanceof Error && error.message === 'No se pudo iniciar PostgreSQL.'
    ? error.message : 'No se pudo iniciar la API.');
  process.exitCode = 1;
}
