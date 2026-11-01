/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('companies', {
    id: { type: 'VARCHAR(50)', primaryKey: true },
    owner_id: {
      type: 'VARCHAR(50)',
      references: 'users',
      onDelete: 'SET NULL',
    },
    name: { type: 'VARCHAR(150)', notNull: true },
    location: { type: 'VARCHAR(150)', notNull: true },
    description: { type: 'TEXT' },
    created_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.createIndex('companies', 'owner_id');
  pgm.createIndex('companies', 'name');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('companies');
};
