import { Router } from 'express';
import { SellerController } from '../services/seller/seller.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireApprovedSeller } from '../middlewares/seller.middleware';

const router = Router();

// Public store showcase
router.get('/stores/:slug', SellerController.getPublicStore);

// Authenticated Seller Application & Personal Store Info
router.post('/apply', authenticate, SellerController.apply);
router.get('/me', authenticate, SellerController.getMyStore);

// Protected Approved-Seller Endpoints
router.put('/profile', authenticate, requireApprovedSeller, SellerController.updateStoreProfile);

// Product Management
router.get('/products', authenticate, requireApprovedSeller, SellerController.getProducts);
router.post('/products', authenticate, requireApprovedSeller, SellerController.createProduct);
router.put('/products/:id', authenticate, requireApprovedSeller, SellerController.updateProduct);
router.delete('/products/:id', authenticate, requireApprovedSeller, SellerController.deleteProduct);

// Orders & Fulfillment
router.get('/orders', authenticate, requireApprovedSeller, SellerController.getOrders);
router.patch('/orders/:id/status', authenticate, requireApprovedSeller, SellerController.updateOrderStatus);

// Analytics & Financials
router.get('/analytics', authenticate, requireApprovedSeller, SellerController.getAnalytics);

// Payouts
router.post('/payouts', authenticate, requireApprovedSeller, SellerController.requestPayout);
router.get('/payouts', authenticate, requireApprovedSeller, SellerController.getPayouts);

export default router;
