import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { DATA_SOURCE_CACHE, DATA_SOURCE_DATABASE } from '../config/env.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';
import { cacheService } from './CacheService.js';

const SALT_ROUNDS = 10;

export const getUserCacheKey = (id) => `user:${id}`;

/**
 * Mendaftarkan pengguna baru dengan password yang di-hash menggunakan bcrypt.
 * @param {{ name: string, email: string, password: string, role: string }} payload
 * @returns {Promise<string>}
 */
export const addUser = async ({ name, email, password, role }) => {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [generateId('user'), name, email.toLowerCase(), hashedPassword, role],
  );
  return rows[0].id;
};

/**
 * Mengambil detail pengguna berdasarkan ID dengan dukungan cache Redis (TTL 1 jam).
 * @param {string} id
 * @returns {Promise<{ data: { id: string, name: string, email: string, role: string }, source: string }>}
 */
export const getUserById = async (id) => {
  const cacheKey = getUserCacheKey(id);
  const cached = await cacheService.getJson(cacheKey);
  if (cached) {
    return { data: cached, source: DATA_SOURCE_CACHE };
  }

  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [id],
  );
  if (!rows.length) {
    throw new NotFoundError('User tidak ditemukan');
  }

  const user = rows[0];
  await cacheService.setJson(cacheKey, user);
  return { data: user, source: DATA_SOURCE_DATABASE };
};

/**
 * Memperbarui nama dan email pengguna (hanya pemilik akun sendiri) serta menghapus cache detail user.
 * @param {string} id
 * @param {string} requesterId
 * @param {{ name: string, email: string }} payload
 * @returns {Promise<void>}
 */
export const updateUser = async (id, requesterId, { name, email }) => {
  const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
  if (!existing.rowCount) {
    throw new NotFoundError('User tidak ditemukan');
  }

  if (id !== requesterId) {
    throw new AuthorizationError('Anda hanya dapat memperbarui data akun Anda sendiri');
  }

  await pool.query(
    `UPDATE users
     SET name = $1, email = $2, updated_at = NOW()
     WHERE id = $3`,
    [name, email.toLowerCase(), id],
  );

  await cacheService.delete(getUserCacheKey(id));
};

/**
 * Memverifikasi email dan password pengguna saat login.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>}
 */
export const verifyUserCredential = async (email, password) => {
  const { rows } = await pool.query('SELECT id, password FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  const user = rows[0];
  const isMatch = user ? await bcrypt.compare(password, user.password) : false;

  if (!isMatch) {
    throw new AuthenticationError('Kredensial yang Anda berikan salah');
  }
  return user.id;
};
