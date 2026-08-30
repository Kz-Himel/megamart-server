import { Request, Response, NextFunction } from 'express';
import { UploadService } from './upload.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/AppError';

export class UploadController {
  // ==========================================
  // Upload Product Image
  // ==========================================
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
}