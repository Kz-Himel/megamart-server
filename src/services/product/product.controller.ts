import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { sendSuccess } from '../../utils/response';

export class ProductController {
  // ==========================================
  // Create Product
  // ==========================================
  static async createProduct(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const product = await ProductService.createProduct(req.body);

      return sendSuccess(
        res,
        201,
        'Product created successfully',
        product
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get All Products
  // ==========================================
  static async getAllProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const products = await ProductService.getAllProducts(req.query as any);

      return sendSuccess(
        res,
        200,
        'Products retrieved successfully',
        products
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get Product By ID
  // ==========================================
  static async getProductById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const product = await ProductService.getProductById(
        req.params.id
      );

      return sendSuccess(
        res,
        200,
        'Product retrieved successfully',
        product
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Update Product
  // ==========================================
  static async updateProduct(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const product = await ProductService.updateProduct(
        req.params.id,
        req.body
      );

      return sendSuccess(
        res,
        200,
        'Product updated successfully',
        product
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Delete Product
  // ==========================================
  static async deleteProduct(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const product = await ProductService.deleteProduct(
        req.params.id
      );

      return sendSuccess(
        res,
        200,
        'Product deleted successfully (soft delete)',
        product
      );
    } catch (error) {
      next(error);
    }
  }
}