import { closeDatabasePool } from '../config/database.js';
import {
  APPLICATION_DLQ_NAME,
  APPLICATION_DLX_NAME,
  APPLICATION_QUEUE_NAME,
  CONSUMER_PREFETCH_COUNT,
} from '../config/env.js';
import { closeMailTransporter } from '../config/mail.js';
import {
  closeRabbitConnection,
  ensureApplicationMessagingTopology,
} from '../config/rabbitmq.js';
import { outboxService } from '../services/OutboxService.js';
import logger from '../utils/logger.js';
import { createApplicationMessageListener } from './listener.js';

let activeChannel = null;
let consumerTag = null;
let isShuttingDown = false;

const shutdownConsumer = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Menerima sinyal berhenti, menutup consumer RabbitMQ...');

  await outboxService.stopRelay();

  try {
    if (activeChannel && consumerTag) {
      await activeChannel.cancel(consumerTag);
    }
  } catch (error) {
    logger.warn({ err: error }, 'Gagal membatalkan consumer tag RabbitMQ');
  }

  closeMailTransporter();
  await Promise.allSettled([closeRabbitConnection(), closeDatabasePool()]);

  logger.info('Consumer berhasil dihentikan secara bersih');
  process.exit(0);
};

const startConsumer = async () => {
  try {
    activeChannel = await ensureApplicationMessagingTopology();
    await activeChannel.prefetch(CONSUMER_PREFETCH_COUNT);

    const listener = createApplicationMessageListener(activeChannel);
    const consumed = await activeChannel.consume(APPLICATION_QUEUE_NAME, listener, {
      noAck: false,
    });
    consumerTag = consumed.consumerTag;

    outboxService.startRelay();

    logger.info(
      {
        queue: APPLICATION_QUEUE_NAME,
        dlx: APPLICATION_DLX_NAME,
        dlq: APPLICATION_DLQ_NAME,
      },
      'OpenJob RabbitMQ consumer aktif dan menunggu pesan lamaran...',
    );
  } catch (error) {
    logger.error({ err: error }, 'Gagal menjalankan consumer RabbitMQ');
    await outboxService.stopRelay();
    closeMailTransporter();
    await Promise.allSettled([closeRabbitConnection(), closeDatabasePool()]);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  shutdownConsumer('SIGINT');
});
process.on('SIGTERM', () => {
  shutdownConsumer('SIGTERM');
});

startConsumer();
