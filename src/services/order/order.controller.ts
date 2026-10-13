import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { OrderService } from './order.service';
import { sendSuccess } from '../../utils/response';

export class OrderController {
  // ==========================================
  // Process Full Checkout
  // ==========================================
  static async checkout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;

      const result = await OrderService.checkout(
        userId,
        req.body
      );

      return sendSuccess(
        res,
        201,
        'Checkout completed successfully',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Create Single Product Order
  // ==========================================
  static async createOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;

      const order = await OrderService.createOrder(
        userId,
        req.body
      );

      return sendSuccess(
        res,
        201,
        'Order created successfully',
        order
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get All Orders
  // ==========================================
  static async getAllOrders(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      const orders = await OrderService.getAllOrders(
        userId,
        role
      );

      return sendSuccess(
        res,
        200,
        'Orders retrieved successfully',
        orders
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get Order By ID
  // ==========================================
  static async getOrderById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      const order = await OrderService.getOrderById(
        req.params.id as string,
        userId,
        role
      );

      return sendSuccess(
        res,
        200,
        'Order retrieved successfully',
        order
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Update Order
  // ==========================================
  static async updateOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      const order = await OrderService.updateOrder(
        req.params.id as string,
        userId,
        role,
        req.body
      );

      return sendSuccess(
        res,
        200,
        'Order updated successfully',
        order
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Delete Order
  // ==========================================
  static async deleteOrder(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const order = await OrderService.deleteOrder(
        req.params.id as string
      );

      return sendSuccess(
        res,
        200,
        'Order deleted successfully (soft delete)',
        order
      );
    } catch (error) {
      next(error);
    }
  }
}