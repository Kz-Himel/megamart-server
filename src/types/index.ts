import { Request } from 'express';
import { UserRole, Store } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
  store?: Store;
}

export interface SellerRequest extends AuthRequest {
  store: Store;
}