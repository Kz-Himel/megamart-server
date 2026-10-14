import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import {
  applySellerSchema,
  updateStoreProfileSchema,
  createSellerProductSchema,
  updateSellerProductSchema,
  requestPayoutSchema,
} from './seller.validation';
import { StoreStatus, UserRole, OrderStatus, PayoutStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { NotificationService } from '../notification/notification.service';

export class SellerService {
  // ==========================================
  // 1. Seller Registration & Application
  // ==========================================
  static async apply(userId: string, data: z.infer<typeof applySellerSchema>) {
    const validated = applySellerSchema.parse(data);

    // Check existing store application for this user
    const existingStore = await prisma.store.findUnique({
      where: { userId },
    });

    if (existingStore) {
      if (existingStore.status === StoreStatus.APPROVED) {
        throw new AppError(400, 'Your account is already an approved seller.');
      }
      if (
        existingStore.status === StoreStatus.PENDING ||
        existingStore.status === StoreStatus.UNDER_REVIEW
      ) {
        throw new AppError(
          400,
          'Your seller application is already submitted and awaiting administrative review.'
        );
      }
      if (existingStore.status === StoreStatus.SUSPENDED) {
        throw new AppError(
          403,
          'Your seller account has been suspended. Please contact platform administrators.'
        );
      }
    }

    // Check slug uniqueness across other stores
    const slugConflict = await prisma.store.findFirst({
      where: {
        slug: validated.slug,
        ...(existingStore ? { id: { not: existingStore.id } } : {}),
      },
    });

    if (slugConflict) {
      throw new AppError(400, 'Store handle/slug is already taken. Please choose another unique handle.');
    }

    return await prisma.$transaction(async (tx) => {
      let store;

      if (existingStore) {
        // Re-submit application after rejection or change request
        store = await tx.store.update({
          where: { id: existingStore.id },
          data: {
            name: validated.name,
            slug: validated.slug,
            description: validated.description,
            category: validated.category,
            phone: validated.phone,
            email: validated.email,
            address: validated.address,
            city: validated.city,
            country: validated.country,
            taxId: validated.taxId,
            verificationDoc: validated.verificationDoc,
            status: StoreStatus.PENDING,
            adminFeedback: null,
            reviewedAt: null,
            reviewedBy: null,
          },
        });

        await tx.storeAuditLog.create({
          data: {
            storeId: store.id,
            fromStatus: existingStore.status,
            toStatus: StoreStatus.PENDING,
            reason: 'Applicant resubmitted store registration with updated details.',
            reviewedBy: userId,
          },
        });
      } else {
        store = await tx.store.create({
          data: {
            name: validated.name,
            slug: validated.slug,
            description: validated.description,
            category: validated.category,
            phone: validated.phone,
            email: validated.email,
            address: validated.address,
            city: validated.city,
            country: validated.country,
            taxId: validated.taxId,
            verificationDoc: validated.verificationDoc,
            status: StoreStatus.PENDING,
            userId,
          },
        });

        await tx.storeAuditLog.create({
          data: {
            storeId: store.id,
            fromStatus: StoreStatus.DRAFT,
            toStatus: StoreStatus.PENDING,
            reason: 'Initial seller registration application submitted.',
            reviewedBy: userId,
          },
        });
      }

      // Notify applicant
      await NotificationService.createNotification(
        userId,
        'Seller Application Received',
        `Your application for "${store.name}" has been received. Our compliance team will review your business credentials within 24-48 hours.`,
        'SELLER_STATUS',
        undefined,
        tx
      );

      return store;
    });
  }

  // ==========================================
  // 2. Get User's Seller Status & Store Profile
  // ==========================================
  static async getMyStore(userId: string) {
    const store = await prisma.store.findUnique({
      where: { userId },
      include: {
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            products: { where: { isDeleted: false } },
            orders: { where: { isDeleted: false } },
          },
        },
      },
    });

    return store;
  }

  static async updateStoreProfile(
    userId: string,
    storeId: string,
    data: z.infer<typeof updateStoreProfileSchema>
  ) {
    const validated = updateStoreProfileSchema.parse(data);

    const store = await prisma.store.findFirst({
      where: { id: storeId, userId, isDeleted: false },
    });

    if (!store) {
      throw new AppError(404, 'Store not found or you are not authorized to manage it.');
    }

    if (store.status !== StoreStatus.APPROVED) {
      throw new AppError(403, 'Store profile can only be modified for active, approved stores.');
    }

    return await prisma.store.update({
      where: { id: storeId },
      data: validated,
    });
  }

  // ==========================================
  // 3. Seller Product Management (Ownership Enforced)
  // ==========================================
  static async getSellerProducts(storeId: string) {
    return await prisma.product.findMany({
      where: {
        storeId,
        isDeleted: false,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        _count: {
          select: { orders: { where: { isDeleted: false } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createSellerProduct(
    storeId: string,
    data: z.infer<typeof createSellerProductSchema>
  ) {
    const validated = createSellerProductSchema.parse(data);

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: { id: validated.categoryId, isDeleted: false },
    });

    if (!category) {
      throw new AppError(404, 'Selected category does not exist or has been removed.');
    }

    return await prisma.product.create({
      data: {
        ...validated,
        storeId,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  static async updateSellerProduct(
    storeId: string,
    productId: string,
    data: z.infer<typeof updateSellerProductSchema>
  ) {
    const validated = updateSellerProductSchema.parse(data);

    // Verify product exists and belongs to this seller
    const product = await prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
    });

    if (!product) {
      throw new AppError(404, 'Product not found.');
    }

    if (product.storeId !== storeId) {
      throw new AppError(403, 'Forbidden: You do not own this product listing.');
    }

    if (validated.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: validated.categoryId, isDeleted: false },
      });
      if (!category) {
        throw new AppError(404, 'Selected category does not exist.');
      }
    }

    return await prisma.product.update({
      where: { id: productId },
      data: validated,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });
  }

  static async deleteSellerProduct(storeId: string, productId: string) {
    const product = await prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
    });

    if (!product) {
      throw new AppError(404, 'Product not found.');
    }

    if (product.storeId !== storeId) {
      throw new AppError(403, 'Forbidden: You do not own this product listing.');
    }

    return await prisma.product.update({
      where: { id: productId },
      data: { isDeleted: true },
    });
  }

  // ==========================================
  // 4. Seller Order & Fulfillment Management
  // ==========================================
  static async getSellerOrders(storeId: string, status?: OrderStatus) {
    return await prisma.order.findMany({
      where: {
        storeId,
        isDeleted: false,
        ...(status ? { status } : {}),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateSellerOrderStatus(
    storeId: string,
    orderId: string,
    newStatus: OrderStatus
  ) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
      include: { product: true, store: true },
    });

    if (!order) {
      throw new AppError(404, 'Order not found.');
    }

    if (order.storeId !== storeId) {
      throw new AppError(403, 'Forbidden: You cannot modify orders for another store.');
    }

    // Validate permitted transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      SHIPPED: [OrderStatus.DELIVERED],
      DELIVERED: [], // Delivered orders cannot be changed by seller
      CANCELLED: [], // Cancelled orders cannot be un-cancelled
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new AppError(
        400,
        `Cannot transition order status from ${order.status} to ${newStatus}.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      // 1. If delivering order, credit seller earnings to store balance
      if (newStatus === OrderStatus.DELIVERED && order.payoutStatus !== PayoutStatus.PAID) {
        await tx.store.update({
          where: { id: storeId },
          data: {
            balance: { increment: order.sellerEarnings },
            totalEarnings: { increment: order.sellerEarnings },
          },
        });

        await tx.order.update({
          where: { id: orderId },
          data: { payoutStatus: PayoutStatus.PAID },
        });
      }

      // 2. If cancelling order, restore product stock
      if (newStatus === OrderStatus.CANCELLED) {
        await tx.product.update({
          where: { id: order.productId },
          data: {
            stock: { increment: order.quantity },
            status: 'ACTIVE',
          },
        });
      }

      // 3. Update order status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: {
          product: { select: { id: true, name: true, price: true, image: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // 4. Notify customer
      await NotificationService.createNotification(
        order.userId,
        `Order Update: ${newStatus}`,
        `Your order for "${order.product.name}" has been updated to ${newStatus}.`,
        'ORDER_UPDATE',
        `/orders/${order.id}`,
        tx
      );

      return updatedOrder;
    });
  }

  // ==========================================
  // 5. Seller Analytics & Performance
  // ==========================================
  static async getSellerAnalytics(storeId: string) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new AppError(404, 'Store not found.');
    }

    const orders = await prisma.order.findMany({
      where: { storeId, isDeleted: false },
      include: { product: true },
    });

    const activeOrders = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    const deliveredOrders = orders.filter((o) => o.status === OrderStatus.DELIVERED);

    const grossSales = activeOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const netEarnings = activeOrders.reduce((sum, o) => sum + o.sellerEarnings, 0);

    // Sales by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlySales = months.map((m) => ({ month: m, sales: 0, orders: 0 }));

    for (const o of activeOrders) {
      const monthIdx = new Date(o.createdAt).getMonth();
      monthlySales[monthIdx].sales += o.sellerEarnings;
      monthlySales[monthIdx].orders += 1;
    }

    // Top selling products
    const productStats = new Map<string, { id: string; name: string; units: number; revenue: number }>();
    for (const o of activeOrders) {
      const existing = productStats.get(o.productId) || {
        id: o.productId,
        name: o.product.name,
        units: 0,
        revenue: 0,
      };
      existing.units += o.quantity;
      existing.revenue += o.totalPrice;
      productStats.set(o.productId, existing);
    }

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const totalProducts = await prisma.product.count({
      where: { storeId, isDeleted: false },
    });

    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        commissionRate: store.commissionRate,
        balance: Math.round(store.balance * 100) / 100,
        totalEarnings: Math.round(store.totalEarnings * 100) / 100,
      },
      metrics: {
        grossSales: Math.round(grossSales * 100) / 100,
        netEarnings: Math.round(netEarnings * 100) / 100,
        availableBalance: Math.round(store.balance * 100) / 100,
        totalOrders: orders.length,
        activeOrdersCount: activeOrders.length,
        deliveredCount: deliveredOrders.length,
        totalProducts,
      },
      monthlySales: monthlySales.slice(0, new Date().getMonth() + 1),
      topProducts,
    };
  }

  // ==========================================
  // 6. Seller Payout Requests
  // ==========================================
  static async requestPayout(
    storeId: string,
    data: z.infer<typeof requestPayoutSchema>
  ) {
    const validated = requestPayoutSchema.parse(data);

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new AppError(404, 'Store not found.');
    }

    if (store.status !== StoreStatus.APPROVED) {
      throw new AppError(403, 'Only approved stores can request payouts.');
    }

    if (store.balance < validated.amount) {
      throw new AppError(
        400,
        `Insufficient balance. Available: $${store.balance.toFixed(2)}, requested: $${validated.amount.toFixed(2)}.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      // Deduct balance from store
      await tx.store.update({
        where: { id: storeId },
        data: { balance: { decrement: validated.amount } },
      });

      // Create Payout record
      const payout = await tx.payout.create({
        data: {
          storeId,
          amount: validated.amount,
          paymentMethod: validated.paymentMethod,
          accountInfo: validated.accountInfo,
          notes: validated.notes,
          status: PayoutStatus.PENDING,
        },
      });

      // Notify seller
      await NotificationService.createNotification(
        store.userId,
        'Payout Requested',
        `Your payout request for $${validated.amount.toFixed(2)} has been submitted and is processing.`,
        'PAYOUT',
        undefined,
        tx
      );

      return payout;
    });
  }

  static async getMyPayouts(storeId: string) {
    return await prisma.payout.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 7. Public Store Showcase (Safe Public View)
  // ==========================================
  static async getPublicStore(slug: string) {
    const store = await prisma.store.findFirst({
      where: { slug, isDeleted: false, status: StoreStatus.APPROVED },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        logo: true,
        banner: true,
        city: true,
        country: true,
        createdAt: true,
        products: {
          where: { isDeleted: false, status: 'ACTIVE' },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });

    if (!store) {
      throw new AppError(404, 'Store not found or is currently unavailable.');
    }

    return store;
  }
}
