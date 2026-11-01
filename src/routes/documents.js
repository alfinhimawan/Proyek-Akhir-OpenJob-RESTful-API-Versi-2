import { Router } from 'express';
import * as controller from '../controllers/documentsController.js';
import auth from '../middlewares/auth.js';
import { uploadSingleDocument } from '../middlewares/upload.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.js';

const router = Router();

router.post('/', auth, uploadSingleDocument, asyncHandler(controller.postDocument));
router.get('/', asyncHandler(controller.getDocuments));
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getDocument),
);
router.delete(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteDocument),
);

export default router;
