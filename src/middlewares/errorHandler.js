import { MulterError } from 'multer';
import ClientError from '../exceptions/ClientError.js';
import logger from '../utils/logger.js';
import { sendFailure } from '../utils/response.js';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

const uniqueMessages = {
  users_email_key: 'Email sudah digunakan',
  applications_user_job_unique: 'Anda sudah melamar pekerjaan ini',
  bookmarks_user_job_unique: 'Pekerjaan ini sudah ada di bookmark Anda',
  documents_filename_key: 'Nama berkas dokumen sudah digunakan',
};

const multerMessages = {
  LIMIT_FILE_SIZE: 'Ukuran berkas melebihi batas maksimal 5 MB',
  LIMIT_UNEXPECTED_FILE: 'File is required pada field "document"',
};

const errorHandler = (error, _req, res, _next) => {
  if (error instanceof ClientError) {
    return sendFailure(res, error.statusCode, error.message);
  }

  if (error instanceof MulterError) {
    const message =
      multerMessages[error.code] ?? `Kesalahan unggah berkas: ${error.message}`;
    return sendFailure(res, 400, message);
  }

  if (error.type === 'entity.parse.failed') {
    return sendFailure(res, 400, 'Format JSON pada request body tidak valid');
  }

  if (error.code === PG_UNIQUE_VIOLATION) {
    return sendFailure(res, 400, uniqueMessages[error.constraint] ?? 'Data sudah ada');
  }

  if (error.code === PG_FOREIGN_KEY_VIOLATION) {
    return sendFailure(res, 400, 'Data masih berelasi dengan data lain atau tidak valid');
  }

  logger.error({ err: error }, 'Unhandled server error');
  return sendFailure(res, 500, 'Terjadi kegagalan pada server kami');
};

export default errorHandler;
