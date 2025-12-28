import { Router, type Router as RouterType } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middlewares';

const router: RouterType = Router();

/**
 * @route   POST /notifications/register-device
 * @desc    Register device for push notifications
 * @access  Private
 */
router.post('/register-device', authenticate, notificationController.registerDevice);

/**
 * @route   DELETE /notifications/register-device
 * @desc    Unregister device from push notifications
 * @access  Private
 */
router.delete('/register-device', authenticate, notificationController.unregisterDevice);

/**
 * @route   GET /notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authenticate, notificationController.getNotifications);

/**
 * @route   PATCH /notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

/**
 * @route   PATCH /notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', authenticate, notificationController.markAsRead);

/**
 * @route   DELETE /notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticate, notificationController.deleteNotification);

/**
 * @route   POST /notifications/test
 * @desc    Send a test notification (development only)
 * @access  Private
 */
router.post('/test', authenticate, notificationController.sendTestNotification);

export default router;
