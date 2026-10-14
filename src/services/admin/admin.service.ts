import { prisma } from '../../lib/prisma';
import { StoreStatus, UserRole, PayoutStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { NotificationService } from '../notification/notification.service';

export interface AdminSellerFilters {
  status?: StoreStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export class AdminService {
  // ==========================================
  // 1. Seller Store Oversight
  // ==========================================
  static async getAllSellers(filters: AdminSellerFilters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search && typeof filters.search === 'string') {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [sellers, total] = await Promise.all([
      prisma.store.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, createdAt: true },
          },
          _count: {
            select: {
              products: { where: { isDeleted: false } },
              orders: { where: { isDeleted: false } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.store.count({ where }),
    ]);

    return {
      sellers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSellerById(id: string) {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            products: { where: { isDeleted: false } },
            orders: { where: { isDeleted: false } },
          },
        },
      },
    });

    if (!store) {
      throw new AppError(404, 'Seller store not found.');
    }

    return store;
  }

  // ==========================================
  // 2. Decision Making & Status Transition
  // ==========================================
  static async updateSellerStatus(
    storeId: string,
    adminId: string,
    newStatus: StoreStatus,
    reason?: string
  ) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { user: true },
    });

    if (!store) {
      throw new AppError(404, 'Seller store not found.');
    }

    if (store.status === newStatus) {
      throw new AppError(400, `Store is already in ${newStatus} state.`);
    }

    // Require reason for destructive actions
    if (
      (newStatus === StoreStatus.REJECTED ||
        newStatus === StoreStatus.SUSPENDED ||
        newStatus === StoreStatus.CHANGES_REQUESTED) &&
      (!reason || !reason.trim())
    ) {
      throw new AppError(400, `A justification reason is required when setting status to ${newStatus}.`);
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update store
      const updatedStore = await tx.store.update({
        where: { id: storeId },
        data: {
          status: newStatus,
          adminFeedback: reason || null,
          reviewedAt: new Date(),
          reviewedBy: adminId,
        },
      });

      // 2. Adjust User Role accordingly
      if (newStatus === StoreStatus.APPROVED) {
        await tx.user.update({
          where: { id: store.userId },
          data: { role: UserRole.SELLER },
        });
      } else if (
        newStatus === StoreStatus.SUSPENDED ||
        newStatus === StoreStatus.REJECTED
      ) {
        // Revert to USER if not an admin
        if (store.user.role !== UserRole.ADMIN) {
          await tx.user.update({
            where: { id: store.userId },
            data: { role: UserRole.USER },
          });
        }
      }

      // 3. Record Audit Log
      await tx.storeAuditLog.create({
        data: {
          storeId,
          fromStatus: store.status,
          toStatus: newStatus,
          reason: reason || `Admin transitioned store status to ${newStatus}.`,
          reviewedBy: adminId,
        },
      });

      // 4. Dispatch notification to store owner
      let title = `Store Status: ${newStatus}`;
      let message = `Your seller store "${store.name}" has been updated to ${newStatus}.`;
      if (newStatus === StoreStatus.APPROVED) {
        title = 'Store Approved! Welcome to MegaMart Sellers';
        message = `Congratulations! Your store "${store.name}" has been approved. You can now access your Seller Dashboard and begin listing products.`;
      } else if (newStatus === StoreStatus.CHANGES_REQUESTED) {
        title = 'Seller Application: Changes Requested';
        message = `Our compliance team reviewed your application and requested the following modifications: ${reason}`;
      } else if (newStatus === StoreStatus.SUSPENDED) {
        title = 'Notice of Seller Store Suspension';
        message = `Your seller store has been suspended: ${reason}. Please contact compliance support.`;
      } else if (newStatus === StoreStatus.REJECTED) {
        title = 'Seller Application Decision';
        message = `Your seller application was not approved: ${reason}.`;
      }

      await NotificationService.createNotification(
        store.userId,
        title,
        message,
        'SELLER_STATUS',
        newStatus === StoreStatus.APPROVED ? '/seller/dashboard' : '/seller/pending',
        tx
      );

      return updatedStore;
    });
  }

  // ==========================================
  // 3. Commission Customization
  // ==========================================
  static async updateSellerCommission(storeId: string, commissionRate: number) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new AppError(404, 'Store not found.');

    return await prisma.store.update({
      where: { id: storeId },
      data: { commissionRate },
    });
  }

  // ==========================================
  // 4. Payout Oversight
  // ==========================================
  static async getAllPayouts(status?: PayoutStatus) {
    return await prisma.payout.findMany({
      where: { ...(status ? { status } : {}) },
      include: {
        store: {
          select: { id: true, name: true, slug: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async processPayout(
    payoutId: string,
    adminId: string,
    newStatus: PayoutStatus,
    notes?: string
  ) {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: { store: true },
    });

    if (!payout) {
      throw new AppError(404, 'Payout record not found.');
    }

    if (payout.status === PayoutStatus.PAID) {
      throw new AppError(400, 'Payout has already been finalized and paid.');
    }

    return await prisma.$transaction(async (tx) => {
      // If rejecting payout, refund amount back to store balance
      if (newStatus === PayoutStatus.REJECTED && payout.status !== PayoutStatus.REJECTED) {
        await tx.store.update({
          where: { id: payout.storeId },
          data: { balance: { increment: payout.amount } },
        });
      }

      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: newStatus,
          notes: notes || payout.notes,
          processedAt: newStatus === PayoutStatus.PAID ? new Date() : payout.processedAt,
        },
      });

      // Notify seller
      await NotificationService.createNotification(
        payout.store.userId,
        `Payout Request ${newStatus}`,
        newStatus === PayoutStatus.PAID
          ? `Your payout for $${payout.amount.toFixed(2)} has been successfully processed and transferred.`
          : `Your payout for $${payout.amount.toFixed(2)} status has been updated to ${newStatus}.${notes ? ` Reason: ${notes}` : ''}`,
        'PAYOUT',
        undefined,
        tx
      );

      return updated;
    });
  }
}
