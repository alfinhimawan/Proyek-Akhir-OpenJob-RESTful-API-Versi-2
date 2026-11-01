import * as documentsService from '../services/documentsService.js';
import { sendSuccess } from '../utils/response.js';

export const postDocument = async (req, res) => {
  const data = await documentsService.addDocument(req.user.id, req.file);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Dokumen berhasil diunggah',
    data,
  });
};

export const getDocuments = async (_req, res) => {
  const documents = await documentsService.getDocuments();
  return sendSuccess(res, { data: { documents } });
};

export const getDocument = async (req, res, next) => {
  const { filePath, mimeType, downloadName } = await documentsService.getDocumentFileById(
    req.params.id,
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);

  return res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
};

export const deleteDocument = async (req, res) => {
  await documentsService.deleteDocument(req.params.id, req.user.id);
  return sendSuccess(res, { message: 'Dokumen berhasil dihapus' });
};
