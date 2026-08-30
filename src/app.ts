import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sendSuccess } from './utils/response';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { globalErrorHandler } from './middlewares/error.middleware';
import { globalRateLimiter, authRateLimiter } from './middlewares/rateLimiter.middleware';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import reviewRoutes from './routes/review.routes';
import orderRoutes from './routes/order.routes';
import uploadRoutes from './routes/upload.routes';

const app: Application = express();

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Apply Global Rate Limiter
app.use('/api', globalRateLimiter);

// Routes
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/uploads', uploadRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  return sendSuccess(res, 200, 'API is healthy and operational');
});

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;