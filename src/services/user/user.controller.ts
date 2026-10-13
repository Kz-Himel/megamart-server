import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types';
import { UserService } from './user.service';
import { sendSuccess } from '../../utils/response';
import { UserRole } from '@prisma/client';
import { AppError } from '../../utils/AppError';

export class UserController {
  // ==========================================
  // Create User (Admin Only)
  // ==========================================
  static async createUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await UserService.createUser(req.body);

      return sendSuccess(
        res,
        201,
        'User created successfully',
        user
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get All Users (Admin Only)
  // ==========================================
  static async getAllUsers(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const users = await UserService.getAllUsers();

      return sendSuccess(
        res,
        200,
        'Users retrieved successfully',
        users
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Get User By ID (Owner or Admin)
  // ==========================================
  static async getUserById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const targetUserId = req.params.id as string;
      const currentUser = req.user!;

      // Enforce ownership: non-admin can only access their own user profile
      if (currentUser.role !== UserRole.ADMIN && currentUser.userId !== targetUserId) {
        throw new AppError(403, 'Forbidden: You cannot access this user profile');
      }

      const user = await UserService.getUserById(targetUserId);

      return sendSuccess(
        res,
        200,
        'User retrieved successfully',
        user
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Update User (Owner or Admin)
  // ==========================================
  static async updateUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const targetUserId = req.params.id as string;
      const currentUser = req.user!;

      // Enforce ownership: non-admin can only update their own profile
      if (currentUser.role !== UserRole.ADMIN && currentUser.userId !== targetUserId) {
        throw new AppError(403, 'Forbidden: You cannot modify this user profile');
      }

      // Prevent privilege escalation: non-admin cannot alter roles
      const updatePayload = { ...req.body };
      if (currentUser.role !== UserRole.ADMIN && updatePayload.role) {
        delete updatePayload.role;
      }

      const user = await UserService.updateUser(
        targetUserId,
        updatePayload
      );

      return sendSuccess(
        res,
        200,
        'User updated successfully',
        user
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // Delete User (Admin Only)
  // ==========================================
  static async deleteUser(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = await UserService.deleteUser(req.params.id as string);

      return sendSuccess(
        res,
        200,
        'User deleted successfully (soft delete)',
        user
      );
    } catch (error) {
      next(error);
    }
  }
}