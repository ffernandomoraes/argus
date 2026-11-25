import http from 'node:http';

import { createApp } from './app';
import { loadConfig, PROVIDERS, providerEnabled } from './config';
import { createDatabase } from './db/client';
import { createAuth } from './modules/auth/auth';

// Sobe o servidor: confere as variáveis, aplica as migrações do banco e começa a ouvir. Na Railway,
// o PORT vem do serviço e o healthcheck é /api/health (ver README.md).

// Log comum do servidor (a Railway guarda a saída padrão).
const log = (message: string) => process.stdout.write(`${message}\n`);

const config = loadConfig();
const database = await createDatabase(config.DATABASE_URL);
await database.migrate();

const auth = createAuth({ db: database.db, config });
const app = createApp({ config, db: database.db, auth });
const server = http.createServer(app);

server.listen(config.PORT, () => {
  const providers = PROVIDERS.filter((p) => providerEnabled(config, p));
  log(`[account] Ouvindo na porta ${config.PORT} (PUBLIC_URL=${config.PUBLIC_URL}, login: ${providers.join(', ') || 'nenhum'})`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`[account] ${signal} recebido, encerrando`);
  server.close(() => {
    database
      .close()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
