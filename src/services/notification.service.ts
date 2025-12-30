import mongoose from 'mongoose';
import Session from '../models/Session';
import Notification, { INotification, NotificationType } from '../models/Notification';
import { onesignalService, NotificationPayload } from './onesignal.service';
import { socketService } from './socket.service';
import logger from '../utils/logger';

/**
 * Notification options interface
 */
export interface SendNotificationOptions {
  title: string;
  body: string;
  type?: NotificationType;
  data?: Record<string, unknown>;
  imageUrl?: string;
  actionUrl?: string;
  saveToDb?: boolean;
  sendPush?: boolean;
  sendSocket?: boolean;
  expiresIn?: number; // seconds
}

/**
 * High-level notification orchestration service
 */
class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Send notification to a user (all their devices)
   */
  public async notifyUser(
    userId: string | mongoose.Types.ObjectId,
    options: SendNotificationOptions
  ): Promise<INotification | null> {
    const {
      title,
      body,
      type = NotificationType.SYSTEM,
      data,
      imageUrl,
      actionUrl,
      saveToDb = true,
      sendPush = true,
      sendSocket = true,
      expiresIn,
    } = options;

    let notification: INotification | null = null;

    // Save notification to database
    if (saveToDb) {
      notification = await Notification.create({
        userId,
        title,
        body,
        type,
        data,
        imageUrl,
        actionUrl,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      });
    }

    // Send push notification to all devices
    if (sendPush) {
      try {
        const sessions = await Session.find({
          userId,
          isRevoked: false,
          pushToken: { $exists: true, $ne: null },
        }).select('pushToken');

        const pushTokens = sessions
          .map((s) => s.pushToken)
          .filter((token): token is string => !!token);

        if (pushTokens.length > 0) {
          const pushPayload: NotificationPayload = {
            title,
            body,
            data: {
              ...data,
              notificationId: notification?._id?.toString(),
            },
            url: actionUrl,
            imageUrl,
          };

          await onesignalService.sendToDevices(pushTokens, pushPayload);
          logger.debug(`Push notification sent to ${pushTokens.length} devices for user ${userId}`);
        }
      } catch (error) {
        console.log("🚀 ~ NotificationService ~ notifyUser ~ error:", error)
        logger.error('Failed to send push notification:', error);
      }
    }

    // Send real-time socket event
    if (sendSocket) {
      try {
        socketService.emitToUser(userId.toString(), 'notification', {
          id: notification?._id,
          title,
          body,
          type,
          data,
          imageUrl,
          actionUrl,
          createdAt: notification?.createdAt || new Date(),
        });
        logger.debug(`Socket notification sent to user ${userId}`);
      } catch (error) {
        logger.error('Failed to send socket notification:', error);
      }
    }

    return notification;
  }

  /**
   * Get user's notifications with pagination
   */
  public async getNotifications(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount };
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string, userId: string): Promise<INotification | null> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  public async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return result.modifiedCount;
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Register push token for a session
   */
  public async registerPushToken(sessionId: string, pushToken: string): Promise<boolean> {
    try {
      await Session.findByIdAndUpdate(sessionId, { pushToken });
      logger.debug(`Push token registered for session ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to register push token:', error);
      return false;
    }
  }

  /**
   * Unregister push token for a session
   */
  public async unregisterPushToken(sessionId: string): Promise<boolean> {
    try {
      await Session.findByIdAndUpdate(sessionId, { $unset: { pushToken: 1 } });
      logger.debug(`Push token unregistered for session ${sessionId}`);
      return true;
    } catch (error) {
      logger.error('Failed to unregister push token:', error);
      return false;
    }
  }

  /**
   * Get push tokens for a user's active sessions
   */
  public async getUserPushTokens(userId: string): Promise<string[]> {
    const sessions = await Session.find({
      userId,
      isRevoked: false,
      pushToken: { $exists: true, $ne: null },
    }).select('pushToken');

    return sessions.map((s) => s.pushToken).filter((token): token is string => !!token);
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;
