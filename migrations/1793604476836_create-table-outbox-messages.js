/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('outbox_messages', {
    id: { type: 'VARCHAR(50)', primaryKey: true },
    aggregate_type: { type: 'VARCHAR(50)', notNull: true },
    aggregate_id: { type: 'VARCHAR(50)', notNull: true },
    queue: { type: 'VARCHAR(100)', notNull: true },
    payload: { type: 'JSONB', notNull: true },
    status: { type: 'VARCHAR(20)', notNull: true, default: 'pending' },
    attempts: { type: 'INTEGER', notNull: true, default: 0 },
    next_retry_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
    last_error: { type: 'TEXT' },
    published_at: { type: 'TIMESTAMPTZ' },
    created_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('outbox_messages', 'outbox_messages_status_check', {
    check: "status IN ('pending', 'published', 'failed')",
  });

  pgm.addConstraint('outbox_messages', 'outbox_messages_attempts_non_negative_check', {
    check: 'attempts >= 0',
  });

  pgm.createIndex('outbox_messages', ['next_retry_at', 'created_at'], {
    name: 'outbox_messages_pending_idx',
    where: "status = 'pending'",
  });

  pgm.createIndex('outbox_messages', ['aggregate_type', 'aggregate_id'], {
    name: 'outbox_messages_aggregate_idx',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('outbox_messages');
};
