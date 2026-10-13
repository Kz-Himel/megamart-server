import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import {
  createOrderSchema,
  updateOrderSchema,
  checkoutSchema,
  CheckoutInput,
} from './order.validation';
import { UserRole, OrderStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';

export class OrderService {
  // In-memory idempotency cache for checkout operations to prevent duplicate double-clicks
  private static recentCheckouts = new Map<
    string,
    { timestamp: number; result: any }
  >();

  // ==========================================
  // Full E-commerce Checkout Workflow
  // ==========================================
  static async checkout(userId: string, data: CheckoutInput) {
    const validated = checkoutSchema.parse(data);

    // 1. Payment Integration Boundary Check
    if (validated.paymentMethod === 'CARD') {
      throw new AppError(
        400,
        'Online card payment gateway is currently not configured with live credentials. Please select Cash on Delivery (COD) to complete your order.'
      );
    }

    // 2. Idempotency & Duplicate Protection
    const now = Date.now();
    // Prune stale cache entries (> 10 minutes)
    for (const [key, val] of OrderService.recentCheckouts.entries()) {
      if (now - val.timestamp > 10 * 60 * 1000) {
        OrderService.recentCheckouts.delete(key);
      }
    }

    if (validated.idempotencyKey) {
      const cacheKey = `${userId}:${validated.idempotencyKey}`;
      const cached = OrderService.recentCheckouts.get(cacheKey);
      if (cached) {
        return cached.result;
      }
    }

    // 3. Server-Authoritative Price & Stock Recalculation
    const productIds = Array.from(new Set(validated.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isDeleted: false },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of validated.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(404, `Product not found or unavailable: ${item.productId}`);
      }
      if (product.status === 'INACTIVE' || product.status === 'OUT_OF_STOCK' || product.stock <= 0) {
        throw new AppError(400, `"${product.name}" is currently out of stock.`);
      }
      if (product.stock < item.quantity) {
        throw new AppError(
          400,
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`
        );
      }
      subtotal += product.price * item.quantity;
    }

    // Recalculate discount server-side (Do NOT trust client values)
    let discount = 0;
    const promo = validated.promoCode?.toUpperCase();
    if (promo === 'SAVE10' || promo === 'MEGAMART10') {
      discount = Math.round(subtotal * 0.1 * 100) / 100;
    } else if (promo === 'MEGAMART20') {
      discount = Math.round(subtotal * 0.2 * 100) / 100;
    }

    // Recalculate shipping fee server-side
    let shippingFee = 0;
    if (validated.shippingMethod === 'express') {
      shippingFee = 15.0;
    } else {
      // Free shipping for orders $50+
      shippingFee = subtotal >= 50 ? 0 : 5.0;
    }

    // Recalculate 5% tax
    const taxableSubtotal = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableSubtotal * 0.05 * 100) / 100;
    const grandTotal = Math.round((taxableSubtotal + shippingFee + tax) * 100) / 100;

    // 4. Atomic Execution: Inventory Deduction & Order Creation
    const createdOrders = await prisma.$transaction(async (tx) => {
      const orders = [];

      for (const item of validated.items) {
        // Query inside transaction to lock and re-verify stock
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!currentProduct || currentProduct.stock < item.quantity) {
          throw new AppError(
            400,
            `Stock changed during checkout for "${currentProduct?.name || item.productId}". Available: ${currentProduct?.stock ?? 0}.`
          );
        }

        const newStock = currentProduct.stock - item.quantity;
        await tx.product.update({
          where: { id: currentProduct.id },
          data: {
            stock: newStock,
            status: newStock === 0 ? 'OUT_OF_STOCK' : currentProduct.status,
          },
        });

        const linePrice = Math.round(currentProduct.price * item.quantity * 100) / 100;

        const order = await tx.order.create({
          data: {
            quantity: item.quantity,
            totalPrice: linePrice,
            status: OrderStatus.PENDING,
            userId,
            productId: item.productId,
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
        });

        orders.push(order);
      }

      return orders;
    });

    // 5. Build Authoritative Order Confirmation
    const orderReference = `MM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const result = {
      orderReference,
      orders: createdOrders,
      summary: {
        itemCount: validated.items.reduce((acc, i) => acc + i.quantity, 0),
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        shippingFee,
        tax,
        grandTotal,
      },
      shippingAddress: validated.shippingAddress,
      shippingMethod: validated.shippingMethod,
      paymentMethod: validated.paymentMethod,
      paymentStatus: 'PENDING_ON_DELIVERY',
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
    };

    if (validated.idempotencyKey) {
      OrderService.recentCheckouts.set(`${userId}:${validated.idempotencyKey}`, {
        timestamp: now,
        result,
      });
    }

    return result;
  }

  // ==========================================
  // Direct Single Product Order Creation
  // ==========================================
  static async createOrder(userId: string, data: z.infer<typeof createOrderSchema>) {
    const validated = createOrderSchema.parse(data);

    // Fetch product to calculate total price & check stock
    const product = await prisma.product.findFirst({
      where: { id: validated.productId, isDeleted: false },
    });

    if (!product) {
      throw new AppError(404, 'Product not found or unavailable');
    }

    if (product.status === 'OUT_OF_STOCK' || product.stock < validated.quantity) {
      throw new AppError(400, `Insufficient stock. Only ${product.stock} items left.`);
    }

    const totalPrice = Math.round(product.price * validated.quantity * 100) / 100;

    // Execute order creation and stock reduction in a transaction
    return await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: product.id },
      });

      if (!current || current.stock < validated.quantity) {
        throw new AppError(400, `Insufficient stock. Only ${current?.stock ?? 0} items left.`);
      }

      const newStock = current.stock - validated.quantity;

      // Deduct product stock
      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: newStock,
          status: newStock === 0 ? 'OUT_OF_STOCK' : current.status,
        },
      });

      // Create order record
      return await tx.order.create({
        data: {
          quantity: validated.quantity,
          totalPrice,
          status: OrderStatus.PENDING,
          userId,
          productId: validated.productId,
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
      });
    });
  }

  // ==========================================
  // Get All Orders (Role-based filtering)
  // ==========================================
  static async getAllOrders(userId: string, userRole: UserRole) {
    // Admins can view all orders, standard users view only their own
    const whereCondition: any = { isDeleted: false };
    if (userRole !== UserRole.ADMIN) {
      whereCondition.userId = userId;
    }

    return await prisma.order.findMany({
      where: whereCondition,
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

  // ==========================================
  // Get Order By ID
  // ==========================================
  static async getOrderById(id: string, userId: string, userRole: UserRole) {
    const order = await prisma.order.findFirst({
      where: { id, isDeleted: false },
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
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    if (order.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new AppError(403, 'Forbidden: You cannot access this order');
    }

    return order;
  }

  // ==========================================
  // Update Order (With Stock Restoration on Cancel)
  // ==========================================
  static async updateOrder(
    id: string,
    userId: string,
    userRole: UserRole,
    data: z.infer<typeof updateOrderSchema>
  ) {
    const validated = updateOrderSchema.parse(data);
    const existingOrder = await OrderService.getOrderById(id, userId, userRole);

    // Non-admin users can only cancel their own PENDING orders
    if (userRole !== UserRole.ADMIN) {
      if (existingOrder.userId !== userId) {
        throw new AppError(403, 'Forbidden: Cannot update this order');
      }

      if (validated.status && validated.status !== OrderStatus.CANCELLED) {
        throw new AppError(400, 'Users can only cancel pending orders');
      }

      if (existingOrder.status !== OrderStatus.PENDING) {
        throw new AppError(400, 'Only pending orders can be cancelled');
      }
    }

    // Atomic transaction for order update and inventory adjustment
    return await prisma.$transaction(async (tx) => {
      // Restore inventory when cancelling an active order
      if (
        validated.status === OrderStatus.CANCELLED &&
        existingOrder.status !== OrderStatus.CANCELLED
      ) {
        const product = await tx.product.findUnique({
          where: { id: existingOrder.productId },
        });

        if (product) {
          const restoredStock = product.stock + existingOrder.quantity;
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: restoredStock,
              status: product.status === 'OUT_OF_STOCK' && restoredStock > 0 ? 'ACTIVE' : product.status,
            },
          });
        }
      }

      // Re-deduct inventory if admin reactivates a cancelled order
      if (
        existingOrder.status === OrderStatus.CANCELLED &&
        validated.status &&
        validated.status !== OrderStatus.CANCELLED
      ) {
        const product = await tx.product.findUnique({
          where: { id: existingOrder.productId },
        });

        if (!product || product.stock < existingOrder.quantity) {
          throw new AppError(
            400,
            `Cannot reactivate order: Insufficient stock for "${product?.name || 'product'}"`
          );
        }

        const newStock = product.stock - existingOrder.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: newStock,
            status: newStock === 0 ? 'OUT_OF_STOCK' : product.status,
          },
        });
      }

      return await tx.order.update({
        where: { id },
        data: validated,
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
      });
    });
  }

  // ==========================================
  // Delete Order (Soft Delete with Stock Restoration)
  // ==========================================
  static async deleteOrder(id: string) {
    const order = await prisma.order.findFirst({
      where: { id, isDeleted: false },
    });

    if (!order) {
      throw new AppError(404, 'Order not found');
    }

    return await prisma.$transaction(async (tx) => {
      // Restore stock if the deleted order wasn't already cancelled
      if (order.status !== OrderStatus.CANCELLED) {
        const product = await tx.product.findUnique({
          where: { id: order.productId },
        });
        if (product) {
          const restoredStock = product.stock + order.quantity;
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: restoredStock,
              status: product.status === 'OUT_OF_STOCK' && restoredStock > 0 ? 'ACTIVE' : product.status,
            },
          });
        }
      }

      return await tx.order.update({
        where: { id },
        data: { isDeleted: true, status: OrderStatus.CANCELLED },
      });
    });
  }
}