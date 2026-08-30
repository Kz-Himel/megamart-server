import { Router } from 'express';
import { UploadController } from '../services/upload/upload.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { uploadImageMiddleware } from '../middlewares/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Admin-only — images are uploaded as part of creating/editing a product.
router.post(
  '/product-image',
  authenticate,
  authorize(UserRole.ADMIN),
  uploadImageMiddleware.single('image'),
  UploadController.uploadProductImage
);

export default router;