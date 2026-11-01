import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { companyPayloadSchema } from '../validators/companies.js';
import { idParamSchema } from '../validators/common.js';
import * as controller from '../controllers/companiesController.js';

const router = Router();

router.get('/', asyncHandler(controller.getCompanies));
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getCompany),
);
router.post(
  '/',
  auth,
  validate(companyPayloadSchema),
  asyncHandler(controller.postCompany),
);
router.put(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  validate(companyPayloadSchema),
  asyncHandler(controller.putCompany),
);
router.delete(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteCompany),
);

export default router;
