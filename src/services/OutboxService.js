import { withTransaction } from '../config/database.js';
import {
  OUTBOX_BASE_RETRY_DELAY_MS,
  OUTBOX_BATCH_SIZE,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_POLL_INTERVAL_MS,
} from '../config/env.js';
import { generateId } from '../utils/id.js';
import logger from '../utils/logger.js';
import { producerService } from './ProducerService.js';

const MAX_BACKOFF_DELAY_MS = 60_000;

const calculateBackoffMs = (attempts) =>
  Math.min(
    OUTBOX_BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1),
    MAX_BACKOFF_DELAY_MS,
  );

export default class OutboxService {
  constructor() {
    this.timer = null;
    this.activeRunPromise = null;
    this.hasPendingTrigger = false;
    this.isShuttingDown = false;
  }

  /**
   * Menyimpan pesan event ke tabel `outbox_messages` di dalam transaksi database yang sama
   * dengan operasi bisnis utama (Transactional Outbox Pattern).
   * @param {import('pg').PoolClient} client
   * @param {{
   *   aggregateType: string,
   *   aggregateId: string,
   *   queue: string,
   *   payload: Record<string, unknown>
   * }} message
   * @returns {Promise<{ id: string }>}
   */
  async enqueueMessage(client, { aggregateType, aggregateId, queue, payload }) {
    const id = generateId('outbox');
    await client.query(
      `INSERT INTO outbox_messages (id, aggregate_type, aggregate_id, queue, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [id, aggregateType, aggregateId, queue, JSON.stringify(payload)],
    );
    return { id };
  }

  /**
   * Memproses kumpulan pesan `pending` yang sudah jatuh tempo secara aman terhadap konkurensi
   * menggunakan `FOR UPDATE SKIP LOCKED`.
   * @returns {Promise<number>} Jumlah pesan yang berhasil dipublikasikan
   */
  async processPendingMessages() {
    if (this.isShuttingDown) {
      return 0;
    }

    if (this.activeRunPromise) {
      this.hasPendingTrigger = true;
      return this.activeRunPromise;
    }

    this.activeRunPromise = (async () => {
      let totalPublished = 0;

      do {
        this.hasPendingTrigger = false;
        if (this.isShuttingDown) {
          break;
        }
        const publishedInBatch = await this.#processSingleBatch();
        totalPublished += publishedInBatch;
      } while (this.hasPendingTrigger && !this.isShuttingDown);

      return totalPublished;
    })()
      .catch((error) => {
        logger.warn({ err: error }, 'Kendala saat menjalankan siklus Outbox relay');
        return 0;
      })
      .finally(() => {
        this.activeRunPromise = null;
      });

    return this.activeRunPromise;
  }

  async #processSingleBatch() {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, aggregate_type, aggregate_id, queue, payload, attempts
         FROM outbox_messages
         WHERE status = 'pending' AND next_retry_at <= NOW()
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [OUTBOX_BATCH_SIZE],
      );

      let publishedCount = 0;

      for (const row of rows) {
        try {
          await producerService.sendMessage(row.queue, row.payload, {
            messageId: row.id,
          });

          await client.query(
            `UPDATE outbox_messages
             SET status = 'published',
                 attempts = attempts + 1,
                 published_at = NOW(),
                 last_error = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [row.id],
          );

          publishedCount += 1;
          logger.info(
            {
              outboxId: row.id,
              queue: row.queue,
              aggregateType: row.aggregate_type,
              aggregateId: row.aggregate_id,
            },
            'Pesan outbox berhasil dipublikasikan ke RabbitMQ',
          );
        } catch (error) {
          const nextAttempts = row.attempts + 1;
          const errorMessage = error?.message || 'Unknown RabbitMQ publish error';

          if (nextAttempts >= OUTBOX_MAX_ATTEMPTS) {
            await client.query(
              `UPDATE outbox_messages
               SET status = 'failed',
                   attempts = $2,
                   last_error = $3,
                   updated_at = NOW()
               WHERE id = $1`,
              [row.id, nextAttempts, errorMessage],
            );
            logger.error(
              {
                err: error,
                outboxId: row.id,
                aggregateId: row.aggregate_id,
                attempts: nextAttempts,
              },
              'Pesan outbox gagal dipublikasikan setelah batas percobaan maksimum',
            );
          } else {
            const backoffMs = calculateBackoffMs(nextAttempts);
            await client.query(
              `UPDATE outbox_messages
               SET attempts = $2,
                   next_retry_at = NOW() + ($3 * INTERVAL '1 millisecond'),
                   last_error = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [row.id, nextAttempts, backoffMs, errorMessage],
            );
            logger.warn(
              {
                err: error,
                outboxId: row.id,
                aggregateId: row.aggregate_id,
                attempts: nextAttempts,
                backoffMs,
              },
              'Broker RabbitMQ belum terjangkau; pesan outbox dijadwalkan untuk retry otomatis',
            );
          }

          // Hentikan batch saat ini agar transaksi segera dilepas ketika broker sedang down.
          break;
        }
      }

      return publishedCount;
    });
  }

  /**
   * Memicu pengiriman pesan outbox segera secara non-blocking setelah transaksi commit.
   */
  triggerImmediateDispatch() {
    void this.processPendingMessages();
  }

  /**
   * Menjalankan worker background berkala untuk memulihkan pesan outbox yang tertunda.
   * @param {number} [intervalMs=OUTBOX_POLL_INTERVAL_MS]
   */
  startRelay(intervalMs = OUTBOX_POLL_INTERVAL_MS) {
    if (this.timer) {
      return;
    }

    this.isShuttingDown = false;
    this.triggerImmediateDispatch();

    this.timer = setInterval(() => {
      this.triggerImmediateDispatch();
    }, intervalMs);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Menghentikan worker outbox relay secara bersih dan menunggu batch aktif selesai.
   * @returns {Promise<void>}
   */
  async stopRelay() {
    this.isShuttingDown = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.activeRunPromise) {
      await this.activeRunPromise;
    }
  }
}

export const outboxService = new OutboxService();
