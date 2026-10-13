import { Router } from 'express';
import { OrderController } from '../services/order/order.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Protect all order endpoints
router.use(authenticate);

// Checkout and single-order placement
router.post('/checkout', OrderController.checkout);
router.post('/', OrderController.createOrder);

// Query and mutate orders
router.get('/', OrderController.getAllOrders);
router.get('/:id', OrderController.getOrderById);
router.patch('/:id', OrderController.updateOrder);
router.delete('/:id', authorize(UserRole.ADMIN), OrderController.deleteOrder);

export default router;