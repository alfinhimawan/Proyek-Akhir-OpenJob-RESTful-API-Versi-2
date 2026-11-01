/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('jobs', {
    id: { type: 'VARCHAR(50)', primaryKey: true },
    owner_id: {
      type: 'VARCHAR(50)',
      references: 'users',
      onDelete: 'SET NULL',
    },
    company_id: {
      type: 'VARCHAR(50)',
      notNull: true,
      references: 'companies',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'VARCHAR(50)',
      notNull: true,
      references: 'categories',
      onDelete: 'RESTRICT',
    },
    title: { type: 'VARCHAR(200)', notNull: true },
    description: { type: 'TEXT', notNull: true },
    job_type: { type: 'VARCHAR(30)', notNull: true },
    experience_level: { type: 'VARCHAR(30)', notNull: true },
    location_type: { type: 'VARCHAR(30)', notNull: true },
    location_city: { type: 'VARCHAR(150)' },
    salary_min: { type: 'INTEGER' },
    salary_max: { type: 'INTEGER' },
    is_salary_visible: { type: 'BOOLEAN', notNull: true, default: true },
    status: { type: 'VARCHAR(20)', notNull: true, default: 'open' },
    created_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'TIMESTAMPTZ', notNull: true, default: pgm.func('NOW()') },
  });

  pgm.addConstraint('jobs', 'jobs_status_check', {
    check: "status IN ('open', 'close')",
  });
  pgm.addConstraint('jobs', 'jobs_salary_range_check', {
    check: 'salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min',
  });

  pgm.createIndex('jobs', 'company_id');
  pgm.createIndex('jobs', 'category_id');
  pgm.createIndex('jobs', 'owner_id');
  pgm.createIndex('jobs', 'title');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('jobs');
};
