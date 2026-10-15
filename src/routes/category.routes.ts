import { Router } from 'express';
import { CategoryController } from '../services/category/category.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public routes (anyone can fetch categories)
router.get('/', CategoryController.getAllCategories);
router.get('/:id', CategoryController.getCategoryById);

// Protected Admin-only routes
router.post('/', authenticate, authorize(UserRole.ADMIN), CategoryController.createCategory);
router.patch('/:id', authenticate, authorize(UserRole.ADMIN), CategoryController.updateCategory);
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), CategoryController.deleteCategory);

export default router;

