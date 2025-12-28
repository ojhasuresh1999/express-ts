import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { NotificationType } from '../models/Notification';

/**
 * Register device push token
 * POST /notifications/register-device
 */
export const registerDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pushToken } = req.body;
    const sessionId = req.session?.id;

    if (!sessionId) {
      throw ApiError.unauthorized('Session not found');
    }

    if (!pushToken) {
      throw ApiError.badRequest('Push token is required');
    }

    const success = await notificationService.registerPushToken(sessionId, pushToken);

    if (!success) {
      throw ApiError.internal('Failed to register push token');
    }

    sendSuccess(res, { registered: true }, 'Device registered for push notifications');
  } catch (error) {
    next(error);
  }
};

/**
 * Unregister device push token
 * DELETE /notifications/register-device
 */
export const unregisterDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.session?.id;

    if (!sessionId) {
      throw ApiError.unauthorized('Session not found');
    }

    const success = await notificationService.unregisterPushToken(sessionId);

    if (!success) {
      throw ApiError.internal('Failed to unregister push token');
    }

    sendSuccess(res, { unregistered: true }, 'Device unregistered from push notifications');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's notifications
 * GET /notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationService.getNotifications(req.user.id, {
      page,
      limit,
      unreadOnly,
    });

    sendSuccess(res, {
      notifications: result.notifications,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 * PATCH /notifications/:id/read
 */
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, req.user.id);

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * PATCH /notifications/read-all
 */
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const count = await notificationService.markAllAsRead(req.user.id);

    sendSuccess(res, { markedAsRead: count }, `${count} notifications marked as read`);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 * DELETE /notifications/:id
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { id } = req.params;
    const deleted = await notificationService.deleteNotification(id, req.user.id);

    if (!deleted) {
      throw ApiError.notFound('Notification not found');
    }

    sendSuccess(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

/**
 * Send test notification (development only)
 * POST /notifications/test
 */
export const sendTestNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Not authenticated');
    }

    const { title, body, type } = req.body;

    const notification = await notificationService.notifyUser(req.user.id, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from your server.',
      type: type || NotificationType.SYSTEM,
      data: { test: true, timestamp: Date.now() },
    });

    sendCreated(res, notification, 'Test notification sent');
  } catch (error) {
    next(error);
  }
};
