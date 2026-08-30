import cloudinary from '../../lib/cloudinary';
import { AppError } from '../../utils/AppError';

export class UploadService {
  static uploadProductImage(fileBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'ankara/products' },
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
}