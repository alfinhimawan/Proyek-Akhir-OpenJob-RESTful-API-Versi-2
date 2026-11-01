import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { categoryPayloadSchema } from '../validators/categories.js';
import { idParamSchema } from '../validators/common.js';
import * as controller from '../controllers/categoriesController.js';

const router = Router();

router.get('/', asyncHandler(controller.getCategories));
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getCategory),
);
router.post(
  '/',
  auth,
  validate(categoryPayloadSchema),
  asyncHandler(controller.postCategory),
);
router.put(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  validate(categoryPayloadSchema),
  asyncHandler(controller.putCategory),
);
router.delete(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteCategory),
);

export default router;
