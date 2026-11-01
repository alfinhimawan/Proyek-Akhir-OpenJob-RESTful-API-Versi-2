/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('documents', {
    id: { type: 'VARCHAR(50)', primaryKey: true },
    user_id: {
      type: 'VARCHAR(50)',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    filename: { type: 'VARCHAR(255)', notNull: true, unique: true },
    original_name: { type: 'VARCHAR(255)', notNull: true },
    mime_type: { type: 'VARCHAR(100)', notNull: true },
    size: { type: 'INTEGER', notNull: true },
    created_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('documents', 'documents_size_positive_check', {
    check: 'size > 0',
  });

  pgm.createIndex('documents', 'user_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('documents');
};
