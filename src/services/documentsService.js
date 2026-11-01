import pool from '../config/database.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import InvariantError from '../exceptions/InvariantError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import { generateId } from '../utils/id.js';
import { storageService } from './StorageService.js';

/**
 * Memvalidasi isi PDF, menyimpan metadata dokumen ke database,
 * dan menghapus berkas dari disk apabila penyimpanan database gagal.
 * @param {string} userId
 * @param {Express.Multer.File | undefined} file
 * @returns {Promise<{ documentId: string, filename: string, originalName: string, size: number }>}
 */
export const addDocument = async (userId, file) => {
  if (!file) {
    throw new InvariantError('File is required');
  }

  try {
    await storageService.verifyPdfSignature(file.filename);

    const { rows } = await pool.query(
      `INSERT INTO documents (id, user_id, filename, original_name, mime_type, size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, filename, original_name, size`,
      [
        generateId('doc'),
        userId,
        file.filename,
        file.originalname,
        file.mimetype,
        file.size,
      ],
    );

    const saved = rows[0];
    return {
      documentId: saved.id,
      filename: saved.filename,
      originalName: saved.original_name,
      size: saved.size,
    };
  } catch (error) {
    await storageService.deleteFile(file.filename);
    throw error;
  }
};

/**
 * Mengambil daftar seluruh dokumen yang tersimpan.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export const getDocuments = async () => {
  const { rows } = await pool.query(
    `SELECT id, user_id, filename, original_name, mime_type, size, created_at
     FROM documents
     ORDER BY created_at DESC`,
  );
  return rows;
};

/**
 * Mengambil metadata dan path berkas dokumen untuk ditampilkan/diunduh.
 * @param {string} id
 * @returns {Promise<{ filePath: string, mimeType: string, downloadName: string }>}
 */
export const getDocumentFileById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, filename, original_name, mime_type FROM documents WHERE id = $1',
    [id],
  );

  if (!rows.length) {
    throw new NotFoundError('Dokumen tidak ditemukan');
  }

  const doc = rows[0];
  const filePath = await storageService.ensureFileExists(doc.filename);
  const downloadName = storageService.sanitizeContentDispositionFilename(
    doc.original_name,
  );

  return {
    filePath,
    mimeType: doc.mime_type,
    downloadName,
  };
};

/**
 * Menghapus dokumen milik pengguna dari database dan penyimpanan disk.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteDocument = async (id, userId) => {
  const { rows } = await pool.query(
    'SELECT user_id, filename FROM documents WHERE id = $1',
    [id],
  );

  if (!rows.length) {
    throw new NotFoundError('Dokumen tidak ditemukan');
  }

  if (rows[0].user_id !== userId) {
    throw new AuthorizationError('Anda tidak berhak menghapus dokumen ini');
  }

  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
  await storageService.deleteFile(rows[0].filename);
};
