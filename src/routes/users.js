import { Router } from 'express';
import * as controller from '../controllers/usersController.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { idParamSchema } from '../validators/common.js';
import { userPayloadSchema, userUpdatePayloadSchema } from '../validators/users.js';

const router = Router();

router.post('/', validate(userPayloadSchema), asyncHandler(controller.postUser));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getUser));
router.put(
  '/:id',
  auth,
  validate(idParamSchema, 'params'),
  validate(userUpdatePayloadSchema),
  asyncHandler(controller.putUser),
);

export default router;
