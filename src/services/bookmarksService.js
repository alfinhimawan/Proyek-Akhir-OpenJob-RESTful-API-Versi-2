import pool, { withTransaction } from '../config/database.js';
import { DATA_SOURCE_CACHE, DATA_SOURCE_DATABASE } from '../config/env.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';
import { cacheService } from './CacheService.js';

const BOOKMARK_LIST_SELECT = `
  SELECT b.id, b.user_id, b.job_id, b.created_at,
         j.company_id, c.name AS company_name,
         j.category_id, cat.name AS category_name,
         j.title, j.description, j.job_type, j.experience_level,
         j.location_type, j.location_city, j.salary_min, j.salary_max,
         j.is_salary_visible, j.status
  FROM bookmarks b
  JOIN jobs j ON j.id = b.job_id
  JOIN companies c ON c.id = j.company_id
  JOIN categories cat ON cat.id = j.category_id`;

export const getBookmarksByUserCacheKey = (userId) => `bookmarks:user:${userId}`;

/**
 * Menyimpan lowongan ke daftar bookmark pengguna dalam transaksi lalu menginvalidasi cache bookmark user.
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<string>}
 */
export const addBookmark = async (userId, jobId) => {
  const id = await withTransaction(async (client) => {
    const job = await client.query('SELECT 1 FROM jobs WHERE id = $1 FOR SHARE', [jobId]);
    if (!job.rowCount) {
      throw new NotFoundError('Job tidak ditemukan');
    }

    const { rows } = await client.query(
      'INSERT INTO bookmarks (id, user_id, job_id) VALUES ($1, $2, $3) RETURNING id',
      [generateId('bookmark'), userId, jobId],
    );
    return rows[0].id;
  });

  await cacheService.delete(getBookmarksByUserCacheKey(userId));
  return id;
};

/**
 * Mengambil detail satu bookmark berdasarkan ID bookmark, ID job, dan kepemilikan user.
 * @param {string} id
 * @param {string} jobId
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
export const getBookmarkById = async (id, jobId, userId) => {
  const { rows } = await pool.query(
    'SELECT id, user_id, job_id, created_at FROM bookmarks WHERE id = $1 AND job_id = $2',
    [id, jobId],
  );
  if (!rows.length) {
    throw new NotFoundError('Bookmark tidak ditemukan');
  }
  if (rows[0].user_id !== userId) {
    throw new AuthorizationError('Anda tidak berhak mengakses bookmark ini');
  }
  return rows[0];
};

/**
 * Mengambil seluruh bookmark milik pengguna beserta detail lowongan dengan cache Redis (TTL 1 jam).
 * @param {string} userId
 * @returns {Promise<{ data: Array<Record<string, unknown>>, source: string }>}
 */
export const getBookmarksByUserId = async (userId) => {
  const cacheKey = getBookmarksByUserCacheKey(userId);
  const cached = await cacheService.getJson(cacheKey);
  if (cached && cached.ownerId === userId && Array.isArray(cached.data)) {
    return { data: cached.data, source: DATA_SOURCE_CACHE };
  }

  const { rows } = await pool.query(
    `${BOOKMARK_LIST_SELECT}
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId],
  );

  await cacheService.setJson(cacheKey, { ownerId: userId, data: rows });
  return { data: rows, source: DATA_SOURCE_DATABASE };
};

/**
 * Menghapus bookmark pengguna berdasarkan job ID serta menginvalidasi cache bookmark user.
 * @param {string} userId
 * @param {string} jobId
 * @returns {Promise<void>}
 */
export const deleteBookmark = async (userId, jobId) => {
  const { rowCount } = await pool.query(
    'DELETE FROM bookmarks WHERE user_id = $1 AND job_id = $2',
    [userId, jobId],
  );
  if (!rowCount) {
    throw new NotFoundError('Bookmark tidak ditemukan');
  }

  await cacheService.delete(getBookmarksByUserCacheKey(userId));
};
