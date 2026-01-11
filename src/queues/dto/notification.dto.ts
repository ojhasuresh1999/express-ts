// ============================================================================
// Notification DTOs
// ============================================================================

/**
 * Base notification options
 */
interface BaseNotificationDto {
  /** Priority of the notification (1 = highest) */
  priority?: number;
  /** Schedule notification for later */
  scheduledAt?: Date;
}

/**
 * Push notification via OneSignal or similar
 */
export interface SendPushDto extends BaseNotificationDto {
  /** Target user ID(s) */
  userIds: string | string[];
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** Large image URL */
  imageUrl?: string;
  /** Action URL when notification is clicked */
  actionUrl?: string;
  /** Additional custom data */
  data?: Record<string, unknown>;
  /** Notification category/type */
  category?: string;
  /** Time to live in seconds */
  ttl?: number;
  /** Badge count (iOS) */
  badge?: number;
  /** Sound to play */
  sound?: string;
  /** Android notification channel */
  androidChannel?: string;
  /** Collapse key for notification grouping */
  collapseKey?: string;
}

/**
 * Bulk push notification
 */
export interface SendBulkPushDto extends BaseNotificationDto {
  /** Array of target user IDs */
  userIds: string[];
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** Large image URL */
  imageUrl?: string;
  /** Action URL when notification is clicked */
  actionUrl?: string;
  /** Additional custom data */
  data?: Record<string, unknown>;
  /** Notification category/type */
  category?: string;
}

/**
 * In-app notification (stored and shown in notification center)
 */
export interface SendInAppDto extends BaseNotificationDto {
  /** Target user ID */
  userId: string;
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** Notification type for styling/filtering */
  type: 'info' | 'success' | 'warning' | 'error' | 'system' | 'marketing' | 'social';
  /** Icon or avatar URL */
  iconUrl?: string;
  /** Action URL */
  actionUrl?: string;
  /** Additional custom data */
  data?: Record<string, unknown>;
  /** Whether to save to database */
  persist?: boolean;
  /** Whether to send via Socket.IO */
  realtime?: boolean;
  /** Auto-expire after this many seconds */
  expiresInSeconds?: number;
}

/**
 * Broadcast notification to all users
 */
export interface SendBroadcastDto extends BaseNotificationDto {
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** Large image URL */
  imageUrl?: string;
  /** Action URL when notification is clicked */
  actionUrl?: string;
  /** Segment filter (e.g., 'premium_users', 'active_users') */
  segment?: string;
  /** Custom filter tags */
  filterTags?: Record<string, string>;
  /** Additional custom data */
  data?: Record<string, unknown>;
}

/**
 * Topic/Channel notification
 */
export interface SendTopicNotificationDto extends BaseNotificationDto {
  /** Topic/channel name */
  topic: string;
  /** Notification title */
  title: string;
  /** Notification body/message */
  body: string;
  /** Large image URL */
  imageUrl?: string;
  /** Additional custom data */
  data?: Record<string, unknown>;
}
