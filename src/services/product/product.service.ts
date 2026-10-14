import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { createProductSchema, updateProductSchema } from './product.validation';

export interface ProductQueryFilters {
  categoryId?: string;
  search?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  inStock?: string | boolean;
  status?: string;
  sort?: string;
}

export class ProductService {
  static async createProduct(data: z.infer<typeof createProductSchema>) {
    const validated = createProductSchema.parse(data);

    // Verify category exists and is not soft deleted
    const categoryExists = await prisma.category.findFirst({
      where: { id: validated.categoryId, isDeleted: false },
    });

    if (!categoryExists) {
      const error: any = new Error('Category not found or has been deleted');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.product.create({
      data: {
        name: validated.name,
        description: validated.description ?? '',
        price: validated.price,
        stock: validated.stock,
        image: validated.image,
        status: validated.status || 'ACTIVE',
        categoryId: validated.categoryId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  static async getAllProducts(filters?: ProductQueryFilters) {
    const where: any = { isDeleted: false };

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.search && typeof filters.search === 'string') {
      const searchTerm = filters.search.trim();
      if (searchTerm) {
        where.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      where.price = {};
      if (filters.minPrice !== undefined && filters.minPrice !== '') {
        const min = Number(filters.minPrice);
        if (!isNaN(min)) where.price.gte = min;
      }
      if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
        const max = Number(filters.maxPrice);
        if (!isNaN(max)) where.price.lte = max;
      }
    }

    if (filters?.inStock === true || filters?.inStock === 'true') {
      where.stock = { gt: 0 };
      where.status = 'ACTIVE';
    } else if (filters?.status) {
      where.status = filters.status;
    }

    where.AND = [
      {
        OR: [
          { storeId: null },
          { store: { status: 'APPROVED', isDeleted: false } },
        ],
      },
    ];

    let orderBy: any = { createdAt: 'desc' };
    if (filters?.sort === 'price_asc' || filters?.sort === 'price-asc') {
      orderBy = { price: 'asc' };
    } else if (filters?.sort === 'price_desc' || filters?.sort === 'price-desc') {
      orderBy = { price: 'desc' };
    } else if (filters?.sort === 'name_asc' || filters?.sort === 'name-asc') {
      orderBy = { name: 'asc' };
    }

    return await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
      orderBy,
    });
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findFirst({
      where: { id, isDeleted: false },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            city: true,
            country: true,
          },
        },
        reviews: {
          where: { isDeleted: false, status: 'PUBLISHED' },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      const error: any = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    return product;
  }

  static async updateProduct(id: string, data: z.infer<typeof updateProductSchema>) {
    const validated = updateProductSchema.parse(data);

    await ProductService.getProductById(id);

    if (validated.categoryId) {
      const categoryExists = await prisma.category.findFirst({
        where: { id: validated.categoryId, isDeleted: false },
      });

      if (!categoryExists) {
        const error: any = new Error('Category not found or has been deleted');
        error.statusCode = 404;
        throw error;
      }
    }

    return await prisma.product.update({
      where: { id },
      data: validated,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  static async deleteProduct(id: string) {
    await ProductService.getProductById(id);

    return await prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}