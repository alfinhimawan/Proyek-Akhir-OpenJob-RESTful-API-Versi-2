import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  applicationPayloadSchema,
  applicationStatusPayloadSchema,
} from '../validators/applications.js';
import { idParamSchema } from '../validators/common.js';
import * as controller from '../controllers/applicationsController.js';

const router = Router();

router.use(auth);

router.post(
  '/',
  validate(applicationPayloadSchema),
  asyncHandler(controller.postApplication),
);
router.get('/', asyncHandler(controller.getApplications));
router.get('/user/:userId', asyncHandler(controller.getApplicationsByUser));
router.get('/job/:jobId', asyncHandler(controller.getApplicationsByJob));
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getApplication),
);
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(applicationStatusPayloadSchema),
  asyncHandler(controller.putApplication),
);
router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteApplication),
);

export default router;
