import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
  loginPayloadSchema,
  refreshTokenPayloadSchema,
} from '../validators/authentications.js';
import * as controller from '../controllers/authenticationsController.js';

const router = Router();

router.post(
  '/',
  validate(loginPayloadSchema),
  asyncHandler(controller.postAuthentication),
);
router.put(
  '/',
  validate(refreshTokenPayloadSchema),
  asyncHandler(controller.putAuthentication),
);
router.delete(
  '/',
  auth,
  validate(refreshTokenPayloadSchema),
  asyncHandler(controller.deleteAuthentication),
);

export default router;
