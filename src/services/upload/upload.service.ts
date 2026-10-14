import cloudinary from '../../lib/cloudinary';
import { AppError } from '../../utils/AppError';

export class UploadService {
  static uploadProductImage(fileBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'megamart/products' },
        (error, result) => {
          if (error || !result) {
            return reject(new AppError(502, error?.message || 'Image upload failed'));
          }
          resolve(result.secure_url);
        }
      );

      stream.end(fileBuffer);
    });
  }

  static uploadVerificationDoc(fileBuffer: Buffer, originalname?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const isPdf = originalname?.toLowerCase().endsWith('.pdf');
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'megamart/verification_docs',
          resource_type: isPdf ? 'raw' : 'auto',
        },
        (error, result) => {
          if (error || !result) {
            return reject(new AppError(502, error?.message || 'Document upload failed'));
          }
          resolve(result.secure_url);
        }
      );

      stream.end(fileBuffer);
    });
  }
}