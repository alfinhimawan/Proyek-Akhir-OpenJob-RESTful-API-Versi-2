import app from './app.js';
import { closeDatabasePool } from './config/database.js';
import config from './config/env.js';
import { closeRabbitConnection } from './config/rabbitmq.js';
import { closeRedisClient } from './config/redis.js';
import { outboxService } from './services/OutboxService.js';
import logger from './utils/logger.js';

const { host, port } = config.server;

const server = app.listen(port, host, () => {
  outboxService.startRelay();
  logger.info(`OpenJob RESTful API V2 berjalan pada http://${host}:${port}`);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Menerima sinyal berhenti, menutup HTTP server dan koneksi...');

  await new Promise((resolve) => {
    server.close((error) => {
      if (error) {
        logger.warn({ err: error }, 'Terjadi kendala saat menutup HTTP server');
      }
      resolve();
    });
  });

  await outboxService.stopRelay();

  await Promise.allSettled([
    closeRedisClient(),
    closeRabbitConnection(),
    closeDatabasePool(),
  ]);

  logger.info('Seluruh layanan ditutup secara bersih');
  process.exit(0);
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});
