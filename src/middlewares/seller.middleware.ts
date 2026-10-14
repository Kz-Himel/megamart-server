import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { prisma } from '../lib/prisma';
import { sendError } from '../utils/response';
import { StoreStatus } from '@prisma/client';

export const requireApprovedSeller = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return sendError(res, 401, 'Authentication token required');
    }

    // Look up store for this user
    const store = await prisma.store.findUnique({
      where: { userId: req.user.userId, isDeleted: false },
    });

    if (!store) {
      return sendError(
        res,
        403,
        'No seller store registered for this account. Please submit an application.'
      );
    }

    // Admin can bypass approval checks for supervision
    if (req.user.role === 'ADMIN') {
      req.store = store;
      return next();
    }

    // Strict state verification
    switch (store.status) {
      case StoreStatus.PENDING:
      case StoreStatus.UNDER_REVIEW:
        return sendError(
          res,
          403,
          'Your seller account application is currently pending administrative review.'
        );
      case StoreStatus.CHANGES_REQUESTED:
        return sendError(
          res,
          403,
          `Changes required before store approval: ${store.adminFeedback || 'Please review your application.'}`
        );
      case StoreStatus.REJECTED:
        return sendError(
          res,
          403,
          `Your seller application was not approved: ${store.adminFeedback || 'Contact support for details.'}`
        );
      case StoreStatus.SUSPENDED:
        return sendError(
          res,
          403,
          'Your seller privileges and store have been suspended. Please contact marketplace compliance.'
        );
      case StoreStatus.APPROVED:
        req.store = store;
        return next();
      default:
        return sendError(res, 403, 'Unauthorized seller state');
    }
  } catch (error: any) {
    return sendError(res, 500, error.message || 'Internal authorization error');
  }
};
