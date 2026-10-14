import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import { AdminService } from './admin.service';
import { sendSuccess, sendError } from '../../utils/response';
import { StoreStatus, PayoutStatus } from '@prisma/client';

function handleError(res: Response, error: any, defaultMsg: string) {
  if (error instanceof ZodError || error?.name === 'ZodError') {
    return sendError(res, 400, 'Validation Error', error.issues);
  }
  return sendError(res, error.statusCode || 500, error.message || defaultMsg);
}

export class AdminController {
  // Get all sellers with filter & search
  static async getAllSellers(req: AuthRequest, res: Response) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await AdminService.getAllSellers({
        status: status as StoreStatus | undefined,
        search: search as string | undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return sendSuccess(res, 200, 'Sellers retrieved successfully', result);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve sellers');
    }
  }

  // Get seller details by ID
  static async getSellerById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const seller = await AdminService.getSellerById(id);
      return sendSuccess(res, 200, 'Seller details retrieved successfully', seller);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve seller');
    }
  }

  // Update seller status (Approve, Reject, Suspend, Request Changes)
  static async updateSellerStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.userId;
      const { status, reason } = req.body;
      const updated = await AdminService.updateSellerStatus(id, adminId, status, reason);
      return sendSuccess(res, 200, `Seller status successfully updated to ${status}`, updated);
    } catch (error: any) {
      return handleError(res, error, 'Failed to update seller status');
    }
  }

  // Update custom commission rate
  static async updateCommission(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { commissionRate } = req.body;
      const updated = await AdminService.updateSellerCommission(id, Number(commissionRate));
      return sendSuccess(res, 200, 'Commission rate updated successfully', updated);
    } catch (error: any) {
      return handleError(res, error, 'Failed to update commission rate');
    }
  }

  // Payout oversight
  static async getAllPayouts(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status as PayoutStatus | undefined;
      const payouts = await AdminService.getAllPayouts(status);
      return sendSuccess(res, 200, 'Payout requests retrieved successfully', payouts);
    } catch (error: any) {
      return handleError(res, error, 'Failed to retrieve payouts');
    }
  }

  static async processPayout(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const adminId = req.user!.userId;
      const { status, notes } = req.body;
      const updated = await AdminService.processPayout(id, adminId, status, notes);
      return sendSuccess(res, 200, `Payout updated to ${status}`, updated);
    } catch (error: any) {
      return handleError(res, error, 'Failed to process payout');
    }
  }
}
