import fs from 'node:fs/promises';
import path from 'node:path';
import { PDF_MAGIC_SIGNATURE, UPLOADS_DIRECTORY } from '../config/env.js';
import InvariantError from '../exceptions/InvariantError.js';
import NotFoundError from '../exceptions/NotFoundError.js';
import logger from '../utils/logger.js';

const PDF_SIGNATURE_LENGTH = Buffer.byteLength(PDF_MAGIC_SIGNATURE, 'ascii');

export default class StorageService {
  constructor(directory = UPLOADS_DIRECTORY) {
    this.directory = path.resolve(directory);
  }

  /**
   * Menghasilkan path absolut berkas di dalam folder uploads secara aman (anti path traversal).
   * @param {string} filename
   * @returns {string}
   */
  resolveSafePath(filename) {
    const safeName = path.basename(String(filename));
    const resolvedPath = path.resolve(this.directory, safeName);

    if (
      resolvedPath !== path.join(this.directory, safeName) ||
      !resolvedPath.startsWith(`${this.directory}${path.sep}`)
    ) {
      throw new InvariantError('Nama berkas tidak valid');
    }

    return resolvedPath;
  }

  /**
   * Memeriksa magic bytes (%PDF-) pada awal berkas untuk memastikan isi benar-benar PDF.
   * @param {string} filename
   * @returns {Promise<void>}
   */
  async verifyPdfSignature(filename) {
    const filePath = this.resolveSafePath(filename);
    const handle = await fs.open(filePath, 'r');

    try {
      const buffer = Buffer.alloc(PDF_SIGNATURE_LENGTH);
      const { bytesRead } = await handle.read(buffer, 0, PDF_SIGNATURE_LENGTH, 0);
      const signature = buffer.subarray(0, bytesRead).toString('ascii');

      if (bytesRead < PDF_SIGNATURE_LENGTH || signature !== PDF_MAGIC_SIGNATURE) {
        throw new InvariantError(
          'File is required to be a valid PDF document (application/pdf)',
        );
      }
    } finally {
      await handle.close();
    }
  }

  /**
   * Memastikan berkas tersedia di disk dan mengembalikan path absolutnya.
   * @param {string} filename
   * @returns {Promise<string>}
   */
  async ensureFileExists(filename) {
    const filePath = this.resolveSafePath(filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundError('Berkas dokumen tidak ditemukan');
    }
  }

  /**
   * Menghapus berkas dari folder uploads tanpa melempar error jika berkas sudah tidak ada.
   * @param {string} filename
   * @returns {Promise<void>}
   */
  async deleteFile(filename) {
    if (!filename) {
      return;
    }

    try {
      const filePath = this.resolveSafePath(filename);
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn({ err: error, filename }, 'Gagal menghapus berkas dari penyimpanan');
      }
    }
  }

  /**
   * Menyanitasi nama berkas asli sebelum dimasukkan ke header Content-Disposition.
   * Menghapus karakter kontrol, tanda kutip, newline, dan pemisah path.
   * @param {string} originalName
   * @returns {string}
   */
  sanitizeContentDispositionFilename(originalName) {
    const baseName = path.basename(String(originalName || 'document.pdf'));
    const sanitized = baseName
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f"\\\r\n/]/g, '')
      .trim();

    if (!sanitized) {
      return 'document.pdf';
    }

    return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
  }
}

export const storageService = new StorageService();
