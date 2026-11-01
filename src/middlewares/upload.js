import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import {
  ALLOWED_DOCUMENT_MIME_TYPE,
  MAX_UPLOAD_SIZE_BYTES,
  UPLOADS_DIRECTORY,
} from '../config/env.js';
import InvariantError from '../exceptions/InvariantError.js';

const storage = multer.diskStorage({
  destination: UPLOADS_DIRECTORY,
  filename: (_req, _file, cb) => {
    cb(null, `${nanoid(21)}.pdf`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype !== ALLOWED_DOCUMENT_MIME_TYPE || ext !== '.pdf') {
    return cb(
      new InvariantError('File is required to be a valid PDF document (application/pdf)'),
    );
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
  fileFilter,
});

export const uploadSingleDocument = upload.single('document');

export default upload;
