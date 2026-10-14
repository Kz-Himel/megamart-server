import { Router } from 'express';
import { AdminController } from '../services/admin/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Protect all admin endpoints
router.use(authenticate, authorize(UserRole.ADMIN));

// Sellers Oversight
router.get('/sellers', AdminController.getAllSellers);
router.get('/sellers/:id', AdminController.getSellerById);
router.patch('/sellers/:id/status', AdminController.updateSellerStatus);
router.patch('/sellers/:id/commission', AdminController.updateCommission);

// Payouts Oversight
router.get('/payouts', AdminController.getAllPayouts);
router.patch('/payouts/:id', AdminController.processPayout);

export default router;
