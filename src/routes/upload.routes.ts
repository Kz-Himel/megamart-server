import { Router } from 'express';
import { UploadController } from '../services/upload/upload.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { uploadImageMiddleware, uploadDocMiddleware } from '../middlewares/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Product images: Admins and Sellers can upload
router.post(
  '/product-image',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SELLER),
  uploadImageMiddleware.single('image'),
  UploadController.uploadProductImage
);

// Seller verification documents (PDF, JPG, PNG): Any signed-in user applying for seller status
router.post(
  '/verification-doc',
  authenticate,
  uploadDocMiddleware.single('document'),
  UploadController.uploadVerificationDoc
);

export default router;