import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import * as controller from '../controllers/profileController.js';

const router = Router();

router.use(auth);

router.get('/', asyncHandler(controller.getProfile));
router.get('/applications', asyncHandler(controller.getProfileApplications));
router.get('/bookmarks', asyncHandler(controller.getProfileBookmarks));

export default router;
