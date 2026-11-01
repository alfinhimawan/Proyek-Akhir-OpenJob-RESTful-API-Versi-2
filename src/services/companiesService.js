import pool, { withTransaction } from '../config/database.js';
import { DATA_SOURCE_CACHE, DATA_SOURCE_DATABASE } from '../config/env.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';
import { cacheService } from './CacheService.js';

const COLUMNS = 'id, name, location, description, created_at, updated_at';

export const getCompanyCacheKey = (id) => `company:${id}`;

/**
 * Menambahkan perusahaan baru dan memastikan cache detail terkait bersih.
 * @param {string} ownerId
 * @param {{ name: string, location: string, description?: string }} payload
 * @returns {Promise<string>}
 */
export const addCompany = async (ownerId, { name, location, description }) => {
  const { rows } = await pool.query(
    `INSERT INTO companies (id, owner_id, name, location, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [generateId('company'), ownerId, name, location, description ?? null],
  );

  const id = rows[0].id;
  await cacheService.delete(getCompanyCacheKey(id));
  return id;
};

/**
 * Mengambil daftar seluruh perusahaan.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export const getCompanies = async () => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM companies ORDER BY created_at DESC`,
  );
  return rows;
};

/**
 * Mengambil detail perusahaan berdasarkan ID dengan dukungan cache Redis (TTL 1 jam).
 * @param {string} id
 * @returns {Promise<{ data: Record<string, unknown>, source: string }>}
 */
export const getCompanyById = async (id) => {
  const cacheKey = getCompanyCacheKey(id);
  const cached = await cacheService.getJson(cacheKey);
  if (cached) {
    return { data: cached, source: DATA_SOURCE_CACHE };
  }

  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM companies WHERE id = $1`, [
    id,
  ]);
  if (!rows.length) {
    throw new NotFoundError('Company tidak ditemukan');
  }

  const company = rows[0];
  await cacheService.setJson(cacheKey, company);
  return { data: company, source: DATA_SOURCE_DATABASE };
};

/**
 * Memastikan pengguna adalah pemilik perusahaan.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const verifyCompanyOwner = async (id, userId) => {
  const { rows } = await pool.query('SELECT owner_id FROM companies WHERE id = $1', [id]);
  if (!rows.length) {
    throw new NotFoundError('Company tidak ditemukan');
  }
  if (rows[0].owner_id !== userId) {
    throw new AuthorizationError('Anda tidak berhak mengakses company ini');
  }
};

/**
 * Memperbarui data perusahaan dan menghapus cache detail perusahaan.
 * @param {string} id
 * @param {{ name: string, location: string, description?: string }} payload
 * @returns {Promise<void>}
 */
export const updateCompany = async (id, { name, location, description }) => {
  await pool.query(
    `UPDATE companies
     SET name = $1, location = $2, description = $3, updated_at = NOW()
     WHERE id = $4`,
    [name, location, description ?? null, id],
  );
  await cacheService.delete(getCompanyCacheKey(id));
};

/**
 * Menghapus perusahaan beserta invalidasi cache detail perusahaan dan data turunan yang terdampak CASCADE.
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteCompany = async (id) => {
  const keysToDelete = await withTransaction(async (client) => {
    const jobsRes = await client.query('SELECT id FROM jobs WHERE company_id = $1', [id]);
    const jobIds = jobsRes.rows.map((row) => row.id);

    const keys = [getCompanyCacheKey(id)];

    if (jobIds.length) {
      for (const jobId of jobIds) {
        keys.push(`applications:job:${jobId}`);
      }

      const appsRes = await client.query(
        'SELECT id, user_id FROM applications WHERE job_id = ANY($1::varchar[])',
        [jobIds],
      );
      for (const app of appsRes.rows) {
        keys.push(`application:${app.id}`, `applications:user:${app.user_id}`);
      }

      const bmRes = await client.query(
        'SELECT DISTINCT user_id FROM bookmarks WHERE job_id = ANY($1::varchar[])',
        [jobIds],
      );
      for (const bm of bmRes.rows) {
        keys.push(`bookmarks:user:${bm.user_id}`);
      }
    }

    await client.query('DELETE FROM companies WHERE id = $1', [id]);
    return [...new Set(keys)];
  });

  await cacheService.delete(keysToDelete);
};
