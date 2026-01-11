import * as OneSignal from 'onesignal-node';
import config from '../config';
import logger from '../utils/logger';

/**
 * Notification payload interface
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  url?: string;
  imageUrl?: string;
}

/**
 * OneSignal Push Notification Service
 */
class OneSignalService {
  private static instance: OneSignalService;
  private client: OneSignal.Client | null = null;
  private isConfigured = false;

  private constructor() {
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  /**
   * Initialize OneSignal client
   */
  private initialize(): void {
    const { appId, apiKey } = config.onesignal;

    if (!appId || !apiKey) {
      logger.warn(
        'OneSignal not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY environment variables.'
      );
      return;
    }

    this.client = new OneSignal.Client(appId, apiKey);
    this.isConfigured = true;
    logger.info('OneSignal service initialized');
  }

  /**
   * Check if OneSignal is configured
   */
  public isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Send push notification to specific player IDs (device tokens)
   */
  public async sendToDevices(
    playerIds: string[],
    notification: NotificationPayload
  ): Promise<{ id: string; recipients: number } | null> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OneSignal not configured, skipping push notification');
      return null;
    }

    if (playerIds.length === 0) {
      logger.debug('No player IDs provided, skipping push notification');
      return null;
    }

    try {
      const response = await this.client.createNotification({
        include_player_ids: playerIds,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        url: notification.url,
        big_picture: notification.imageUrl,
      });

      logger.debug(`Push notification sent to ${playerIds.length} devices`);
      return response as unknown as { id: string; recipients: number };
    } catch (error) {
      logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a single device
   */
  public async sendToDevice(
    playerId: string,
    notification: NotificationPayload
  ): Promise<{ id: string; recipients: number } | null> {
    return this.sendToDevices([playerId], notification);
  }

  /**
   * Send push notification to user segment
   */
  public async sendToSegment(
    segment: string,
    notification: NotificationPayload
  ): Promise<{ id: string; recipients: number } | null> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OneSignal not configured, skipping push notification');
      return null;
    }

    try {
      const response = await this.client.createNotification({
        included_segments: [segment],
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        url: notification.url,
        big_picture: notification.imageUrl,
      });

      logger.debug(`Push notification sent to segment: ${segment}`);
      return response as unknown as { id: string; recipients: number };
    } catch (error) {
      logger.error('Failed to send push notification to segment:', error);
      throw error;
    }
  }

  /**
   * Send push notification to all subscribed users
   */
  public async sendToAll(
    notification: NotificationPayload
  ): Promise<{ id: string; recipients: number } | null> {
    return this.sendToSegment('Subscribed Users', notification);
  }

  /**
   * Send push notification with filters
   */
  public async sendWithFilters(
    filters: Array<{ field: string; key?: string; relation: string; value: string }>,
    notification: NotificationPayload
  ): Promise<{ id: string; recipients: number } | null> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OneSignal not configured, skipping push notification');
      return null;
    }

    try {
      const response = await this.client.createNotification({
        filters,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data,
        url: notification.url,
        big_picture: notification.imageUrl,
      });

      logger.debug(`Push notification sent with ${filters.length} filters`);
      return response as unknown as { id: string; recipients: number };
    } catch (error) {
      logger.error('Failed to send push notification with filters:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  public async cancelNotification(notificationId: string): Promise<boolean> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OneSignal not configured');
      return false;
    }

    try {
      await this.client.cancelNotification(notificationId);
      logger.debug(`Notification cancelled: ${notificationId}`);
      return true;
    } catch (error) {
      logger.error('Failed to cancel notification:', error);
      return false;
    }
  }

  /**
   * View a notification by ID
   */
  public async viewNotification(notificationId: string): Promise<unknown | null> {
    if (!this.isAvailable() || !this.client) {
      logger.warn('OneSignal not configured');
      return null;
    }

    try {
      return await this.client.viewNotification(notificationId);
    } catch (error) {
      logger.error('Failed to view notification:', error);
      return null;
    }
  }
}

export const onesignalService = OneSignalService.getInstance();
export default onesignalService;
