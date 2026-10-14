import { prisma } from '../../lib/prisma';

export class NotificationService {
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    link?: string,
    client: any = prisma
  ) {
    try {
      return await client.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          link,
        },
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  static async getUserNotifications(userId: string) {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async markAsRead(userId: string, id: string) {
    return await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
