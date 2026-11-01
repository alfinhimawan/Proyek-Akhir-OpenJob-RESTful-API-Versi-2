import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import { jobPayloadSchema, jobSearchQuerySchema } from '../validators/jobs.js';
import { idParamSchema } from '../validators/common.js';
import * as controller from '../controllers/jobsController.js';

const router = Router();

router.get(
  '/',
  validate(jobSearchQuerySchema, 'query'),
  asyncHandler(controller.getJobs),
);
router.get('/company/:companyId', asyncHandler(controller.getJobsByCompany));
router.get('/category/:categoryId', asyncHandler(controller.getJobsByCategory));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getJob));
router.post('/', auth, validate(jobPayloadSchema), asyncHandler(controller.postJob));
router.put(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  validate(jobPayloadSchema),
  asyncHandler(controller.putJob),
);
router.delete(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deleteJob),
);

export default router;
