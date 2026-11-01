import pool from '../config/database.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';

const COLUMNS = 'id, name, created_at, updated_at';

/**
 * Menambahkan kategori pekerjaan baru.
 * @param {{ name: string }} payload
 * @returns {Promise<string>}
 */
export const addCategory = async ({ name }) => {
  const { rows } = await pool.query(
    'INSERT INTO categories (id, name) VALUES ($1, $2) RETURNING id',
    [generateId('category'), name],
  );
  return rows[0].id;
};

/**
 * Mengambil seluruh daftar kategori pekerjaan.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export const getCategories = async () => {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM categories ORDER BY created_at DESC`,
  );
  return rows;
};

/**
 * Mengambil detail satu kategori berdasarkan ID.
 * @param {string} id
 * @returns {Promise<Record<string, unknown>>}
 */
export const getCategoryById = async (id) => {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM categories WHERE id = $1`, [
    id,
  ]);
  if (!rows.length) {
    throw new NotFoundError('Category tidak ditemukan');
  }
  return rows[0];
};

/**
 * Memperbarui nama kategori berdasarkan ID.
 * @param {string} id
 * @param {{ name: string }} payload
 * @returns {Promise<void>}
 */
export const updateCategory = async (id, { name }) => {
  const { rowCount } = await pool.query(
    'UPDATE categories SET name = $1, updated_at = NOW() WHERE id = $2',
    [name, id],
  );
  if (!rowCount) {
    throw new NotFoundError('Category tidak ditemukan');
  }
};

/**
 * Menghapus kategori berdasarkan ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteCategory = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  if (!rowCount) {
    throw new NotFoundError('Category tidak ditemukan');
  }
};
