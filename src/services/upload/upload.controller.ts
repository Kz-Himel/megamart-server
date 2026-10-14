import { Request, Response, NextFunction } from 'express';
import { UploadService } from './upload.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export class UploadController {
  // Upload Product Image (Admin and Sellers)
  static async uploadProductImage(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.file) {
        throw new AppError(400, 'No image file was provided');
      }

      const url = await UploadService.uploadProductImage(req.file.buffer);

      return sendSuccess(res, 201, 'Image uploaded successfully', { url });
    } catch (error) {
      next(error);
    }
  }

  // Upload Seller Verification Document (PDF, PNG, JPG)
  static async uploadVerificationDoc(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.file) {
        throw new AppError(400, 'No document file was provided');
      }

      const url = await UploadService.uploadVerificationDoc(
        req.file.buffer,
        req.file.originalname
      );

      return sendSuccess(res, 201, 'Verification document uploaded successfully', { url });
    } catch (error) {
      next(error);
    }
  }
}