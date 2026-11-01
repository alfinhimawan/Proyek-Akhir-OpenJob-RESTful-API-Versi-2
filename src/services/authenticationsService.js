import pool from '../config/database.js';
import InvariantError from '../exceptions/InvariantError.js';

/**
 * Menyimpan refresh token aktif ke database.
 * @param {string} token
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const addRefreshToken = async (token, userId) => {
  await pool.query('INSERT INTO authentications (token, user_id) VALUES ($1, $2)', [
    token,
    userId,
  ]);
};

/**
 * Memastikan refresh token masih terdaftar di database.
 * @param {string} token
 * @returns {Promise<void>}
 */
export const verifyRefreshTokenRegistered = async (token) => {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM authentications WHERE token = $1',
    [token],
  );
  if (!rowCount) {
    throw new InvariantError('Refresh token tidak ditemukan di database');
  }
};

/**
 * Menghapus refresh token dari database saat pengguna logout.
 * @param {string} token
 * @returns {Promise<void>}
 */
export const deleteRefreshToken = async (token) => {
  await pool.query('DELETE FROM authentications WHERE token = $1', [token]);
};
