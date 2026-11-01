import { Router } from 'express';
import applicationsRoutes from './applications.js';
import authenticationsRoutes from './authentications.js';
import bookmarksRoutes from './bookmarks.js';
import categoriesRoutes from './categories.js';
import companiesRoutes from './companies.js';
import documentsRoutes from './documents.js';
import jobsRoutes from './jobs.js';
import profileRoutes from './profile.js';
import usersRoutes from './users.js';

const router = Router();

router.use('/users', usersRoutes);
router.use('/authentications', authenticationsRoutes);
router.use('/documents', documentsRoutes);
router.use('/companies', companiesRoutes);
router.use('/categories', categoriesRoutes);
router.use('/jobs', jobsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/profile', profileRoutes);
router.use('/', bookmarksRoutes);

export default router;
