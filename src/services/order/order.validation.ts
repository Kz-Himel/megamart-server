import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const createOrderSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
  productId: z.string().min(1, 'Product ID is required'),
});

export const updateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  quantity: z.number().int().positive('Quantity must be at least 1').optional(),
});

export const checkoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 characters'),
  streetAddress: z.string().trim().min(5, 'Street address must be at least 5 characters'),
  city: z.string().trim().min(2, 'City is required'),
  postalCode: z.string().trim().min(3, 'Postal code is required'),
  country: z.string().trim().default('Bangladesh'),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'At least one item is required in the order'),
  shippingAddress: shippingAddressSchema,
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
  paymentMethod: z.enum(['COD', 'CARD']).default('COD'),
  promoCode: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;