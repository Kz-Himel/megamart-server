import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import { SellerService } from './seller.service';
import { sendSuccess, sendError } from '../../utils/response';
import { OrderStatus } from '@prisma/client';

function handleError(res: Response, error: any, defaultMsg: string) {
  if (error instanceof ZodError || error?.name === 'ZodError') {
    return sendError(res, 400, 'Validation Error', error.issues);
  }
  return sendError(res, error.statusCode || 500, error.message || defaultMsg);
}

export class SellerController {
  // Apply for seller account
  static async apply(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await SellerService.apply(userId, req.body);
      return sendSuccess(res, 201, 'Seller application submitted successfully for review', result);
    } catch (error: any) {
      return handleError(res, error, 'Failed to submit seller application');
    }
  }

  // Get current user's seller store & status
  static async getMyStore(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const store = await SellerService.getMyStore(userId);
      return sendSuccess(res, 200, 'Seller store retrieved successfully', store);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve store');
    }
  }

  // Update store profile
  static async updateStoreProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const storeId = req.store!.id;
      const result = await SellerService.updateStoreProfile(userId, storeId, req.body);
      return sendSuccess(res, 200, 'Store profile updated successfully', result);
    } catch (error: any) {
      return handleError(res, error, 'Failed to update store profile');
    }
  }

  // Seller Products
  static async getProducts(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const products = await SellerService.getSellerProducts(storeId);
      return sendSuccess(res, 200, 'Seller products retrieved successfully', products);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve products');
    }
  }

  static async createProduct(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const product = await SellerService.createSellerProduct(storeId, req.body);
      return sendSuccess(res, 201, 'Product created successfully', product);
    } catch (error: any) {
      return handleError(res, error, 'Failed to create product');
    }
  }

  static async updateProduct(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const id = req.params.id as string;
      const product = await SellerService.updateSellerProduct(storeId, id, req.body);
      return sendSuccess(res, 200, 'Product updated successfully', product);
    } catch (error: any) {
      return handleError(res, error, 'Failed to update product');
    }
  }

  static async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const id = req.params.id as string;
      await SellerService.deleteSellerProduct(storeId, id);
      return sendSuccess(res, 200, 'Product deleted successfully');
    } catch (error: any) {
      return handleError(res, error, 'Failed to delete product');
    }
  }

  // Seller Orders
  static async getOrders(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const status = req.query.status as OrderStatus | undefined;
      const orders = await SellerService.getSellerOrders(storeId, status);
      return sendSuccess(res, 200, 'Seller orders retrieved successfully', orders);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve orders');
    }
  }

  static async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const id = req.params.id as string;
      const { status } = req.body;
      const updatedOrder = await SellerService.updateSellerOrderStatus(storeId, id, status);
      return sendSuccess(res, 200, 'Order status updated successfully', updatedOrder);
    } catch (error: any) {
      return handleError(res, error, 'Failed to update order status');
    }
  }

  // Seller Analytics
  static async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const analytics = await SellerService.getSellerAnalytics(storeId);
      return sendSuccess(res, 200, 'Seller analytics retrieved successfully', analytics);
    } catch (error: any) {
      return handleError(res, error, 'Failed to load analytics');
    }
  }

  // Payouts
  static async requestPayout(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const payout = await SellerService.requestPayout(storeId, req.body);
      return sendSuccess(res, 201, 'Payout request submitted successfully', payout);
    } catch (error: any) {
      return handleError(res, error, 'Failed to request payout');
    }
  }

  static async getPayouts(req: AuthRequest, res: Response) {
    try {
      const storeId = req.store!.id;
      const payouts = await SellerService.getMyPayouts(storeId);
      return sendSuccess(res, 200, 'Payout history retrieved successfully', payouts);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve payouts');
    }
  }

  // Public Store by Slug
  static async getPublicStore(req: AuthRequest, res: Response) {
    try {
      const slug = req.params.slug as string;
      const store = await SellerService.getPublicStore(slug);
      return sendSuccess(res, 200, 'Public store details retrieved', store);
    } catch (error: any) {
      return handleError(res, error, 'Store not found');
    }
  }
}
