import { log } from './logger.js';
import * as memory from './memory.js';
import { startServer } from './server.js';

let server;

async function main() {
  await memory.init();
  server = startServer();

  const shutdown = () => {
    server?.close(() => {
      memory.close();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('No se pudo arrancar el servidor web:', err.message);
  memory.close();
  process.exitCode = 1;
});
