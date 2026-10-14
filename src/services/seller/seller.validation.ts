import { z } from 'zod';
import { StoreStatus, PayoutStatus, ProductStatus } from '@prisma/client';

export const applySellerSchema = z.object({
  name: z
    .string()
    .min(2, 'Store name must be at least 2 characters')
    .max(100, 'Store name cannot exceed 100 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Store slug must be at least 2 characters')
    .max(50, 'Store slug cannot exceed 50 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g., apex-audio-gear)')
    .trim(),
  description: z
    .string()
    .min(10, 'Store description must be at least 10 characters')
    .max(1500, 'Description cannot exceed 1500 characters')
    .trim(),
  category: z.string().min(2, 'Primary category is required').trim(),
  phone: z.string().min(6, 'Valid contact phone number is required').max(30).trim(),
  email: z.string().email('Valid business contact email is required').trim(),
  address: z.string().min(3, 'Business address is required').max(200).trim(),
  city: z.string().min(2, 'City is required').max(100).trim(),
  country: z.string().min(2, 'Country is required').max(100).trim(),
  taxId: z.string().max(100).optional().nullable(),
  verificationDoc: z.string().url('Verification document must be a valid document URL').optional().nullable(),
  termsAccepted: z.literal(true, {
    message: 'You must agree to the MegaMart Seller Terms and Marketplace Policies',
  }),
});

export const updateStoreProfileSchema = z.object({
  description: z.string().max(1500).optional(),
  logo: z.string().url('Logo must be a valid image URL').optional().nullable(),
  banner: z.string().url('Banner must be a valid image URL').optional().nullable(),
  phone: z.string().min(6).max(30).optional(),
  email: z.string().email().optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

export const createSellerProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200).trim(),
  description: z.string().min(10, 'Product description must be at least 10 characters').trim(),
  price: z.number().positive('Price must be greater than zero'),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  image: z.string().url('Image must be a valid URL').optional().nullable(),
  categoryId: z.string().min(1, 'Category ID is required'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK']).default('ACTIVE'),
});

export const updateSellerProductSchema = createSellerProductSchema.partial();

export const requestPayoutSchema = z.object({
  amount: z.number().min(10, 'Minimum payout request amount is $10.00'),
  paymentMethod: z.string().min(2, 'Payment method is required (e.g., Bank Wire, Bkash, PayPal)').trim(),
  accountInfo: z.string().min(4, 'Account recipient information is required').trim(),
  notes: z.string().max(500).optional(),
});

export const adminSellerStatusSchema = z.object({
  status: z.enum([
    StoreStatus.APPROVED,
    StoreStatus.REJECTED,
    StoreStatus.SUSPENDED,
    StoreStatus.UNDER_REVIEW,
    StoreStatus.CHANGES_REQUESTED,
  ]),
  reason: z.string().max(500).optional(),
});

export const adminCommissionSchema = z.object({
  commissionRate: z
    .number()
    .min(0.0, 'Commission cannot be negative')
    .max(0.5, 'Maximum platform commission is 50%'),
});

export const adminPayoutStatusSchema = z.object({
  status: z.enum([PayoutStatus.PAID, PayoutStatus.PROCESSING, PayoutStatus.REJECTED]),
  notes: z.string().max(500).optional(),
});
