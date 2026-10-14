import { Response } from 'express';
import { AuthRequest } from '../../types';
import { NotificationService } from './notification.service';
import { sendSuccess, sendError } from '../../utils/response';

export class NotificationController {
  static async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const notifications = await NotificationService.getUserNotifications(userId);
      return sendSuccess(res, 200, 'Notifications retrieved successfully', notifications);
    } catch (error: any) {
      return sendError(res, error.statusCode || 500, error.message || 'Failed to fetch notifications');
    }
  }

  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      await NotificationService.markAsRead(userId, id);
      return sendSuccess(res, 200, 'Notification marked as read');
    } catch (error: any) {
      return sendError(res, error.statusCode || 500, error.message || 'Failed to update notification');
    }
  }

  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      await NotificationService.markAllAsRead(userId);
      return sendSuccess(res, 200, 'All notifications marked as read');
    } catch (error: any) {
      return sendError(res, error.statusCode || 500, error.message || 'Failed to update notifications');
    }
  }
}
