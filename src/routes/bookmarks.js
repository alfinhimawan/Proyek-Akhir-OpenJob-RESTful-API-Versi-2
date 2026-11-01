import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middlewares/auth.js';
import * as controller from '../controllers/bookmarksController.js';

const router = Router();

router.get('/bookmarks', auth, asyncHandler(controller.getBookmarks));
router.post('/jobs/:jobId/bookmark', auth, asyncHandler(controller.postBookmark));
router.get('/jobs/:jobId/bookmark/:id', auth, asyncHandler(controller.getBookmark));
router.delete('/jobs/:jobId/bookmark', auth, asyncHandler(controller.deleteBookmark));

export default router;
