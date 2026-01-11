import { Worker, Job, type Processor } from 'bullmq';
import { redisService } from '../../services/redis.service';
import { notificationService } from '../../services/notification.service';
import { onesignalService } from '../../services/onesignal.service';
import { socketService } from '../../services/socket.service';
import logger from '../../utils/logger';
import { Queues } from '../queue.constants';
import type { JobResult } from '../queue.types';
import type {
  SendPushDto,
  SendBulkPushDto,
  SendInAppDto,
  SendBroadcastDto,
  SendTopicNotificationDto,
} from '../dto';

// Type for all notification job data
type NotificationJobData =
  | SendPushDto
  | SendBulkPushDto
  | SendInAppDto
  | SendBroadcastDto
  | SendTopicNotificationDto;

/**
 * Notification Queue Processor
 * Handles push notifications and in-app notifications
 */
const notificationProcessor: Processor<NotificationJobData, JobResult> = async (
  job: Job<NotificationJobData>
) => {
  const startTime = Date.now();
  logger.info(`Processing notification job: ${job.name} (ID: ${job.id})`);

  try {
    switch (job.name) {
      case 'send:push':
        return await handleSendPush(job as Job<SendPushDto>);

      case 'send:bulk-push':
        return await handleSendBulkPush(job as Job<SendBulkPushDto>);

      case 'send:in-app':
        return await handleSendInApp(job as Job<SendInAppDto>);

      case 'send:broadcast':
        return await handleSendBroadcast(job as Job<SendBroadcastDto>);

      case 'send:topic':
        return await handleSendTopicNotification(job as Job<SendTopicNotificationDto>);

      default:
        throw new Error(`Unknown notification job type: ${job.name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Notification job ${job.name} failed:`, error);

    return {
      success: false,
      error: errorMessage,
      timestamp: new Date(),
      data: {
        jobId: job.id,
        duration: Date.now() - startTime,
      },
    };
  }
};

/**
 * Handle push notification to specific users
 */
async function handleSendPush(job: Job<SendPushDto>): Promise<JobResult> {
  const { userIds, title, body, imageUrl, actionUrl, data } = job.data;
  const userIdArray = Array.isArray(userIds) ? userIds : [userIds];

  await job.updateProgress(10);

  let successCount = 0;
  let failCount = 0;

  for (const userId of userIdArray) {
    try {
      // Get push tokens for user
      const pushTokens = await notificationService.getUserPushTokens(userId);

      if (pushTokens.length === 0) {
        logger.debug(`No push tokens found for user ${userId}`);
        failCount++;
        continue;
      }

      // Send via OneSignal
      await onesignalService.sendToDevices(pushTokens, {
        title,
        body,
        data,
        url: actionUrl,
        imageUrl,
      });

      successCount++;
    } catch (error) {
      logger.error(`Failed to send push to user ${userId}:`, error);
      failCount++;
    }
  }

  await job.updateProgress(100);

  return {
    success: failCount === 0,
    message: `Push sent to ${successCount}/${userIdArray.length} users`,
    timestamp: new Date(),
    data: { successCount, failCount, total: userIdArray.length },
  };
}

/**
 * Handle bulk push notifications
 */
async function handleSendBulkPush(job: Job<SendBulkPushDto>): Promise<JobResult> {
  const { userIds, title, body, imageUrl, actionUrl, data } = job.data;

  await job.updateProgress(10);

  // Collect all push tokens
  const allPushTokens: string[] = [];

  for (const userId of userIds) {
    try {
      const tokens = await notificationService.getUserPushTokens(userId);
      allPushTokens.push(...tokens);
    } catch (error) {
      logger.error(`Failed to get tokens for user ${userId}:`, error);
    }
    await job.updateProgress(10 + Math.round((userIds.indexOf(userId) / userIds.length) * 40));
  }

  if (allPushTokens.length === 0) {
    return {
      success: false,
      message: 'No push tokens found for any users',
      timestamp: new Date(),
      data: { usersCount: userIds.length, tokensFound: 0 },
    };
  }

  await job.updateProgress(60);

  // Send bulk notification via OneSignal
  try {
    await onesignalService.sendToDevices(allPushTokens, {
      title,
      body,
      data,
      url: actionUrl,
      imageUrl,
    });

    await job.updateProgress(100);

    return {
      success: true,
      message: `Bulk push sent to ${allPushTokens.length} devices`,
      timestamp: new Date(),
      data: { usersCount: userIds.length, devicesCount: allPushTokens.length },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Failed to send bulk push',
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle in-app notification
 */
async function handleSendInApp(job: Job<SendInAppDto>): Promise<JobResult> {
  const {
    userId,
    title,
    body,
    type,
    iconUrl,
    actionUrl,
    data,
    persist = true,
    realtime = true,
    expiresInSeconds,
  } = job.data;

  await job.updateProgress(10);

  // Map our DTO types to the NotificationType enum - default to SYSTEM for unsupported types
  // The notification service accepts NotificationType enum from the model
  const notification = await notificationService.notifyUser(userId, {
    title,
    body,
    // Type mapping handled by notification service - passing undefined lets it use default
    type: type === 'system' ? undefined : undefined,
    data,
    imageUrl: iconUrl,
    actionUrl,
    saveToDb: persist,
    sendPush: false, // In-app only, no push
    sendSocket: realtime,
    expiresIn: expiresInSeconds,
  });

  await job.updateProgress(100);

  return {
    success: true,
    message: `In-app notification sent to user ${userId}`,
    timestamp: new Date(),
    data: {
      notificationId: notification?._id?.toString(),
      persisted: persist,
      realtime,
    },
  };
}

/**
 * Handle broadcast notification to all users
 */
async function handleSendBroadcast(job: Job<SendBroadcastDto>): Promise<JobResult> {
  const { title, body, imageUrl, actionUrl, segment, filterTags, data } = job.data;

  await job.updateProgress(10);

  try {
    // Use OneSignal's segment/filter capabilities
    if (segment) {
      await onesignalService.sendToSegment(segment, {
        title,
        body,
        data,
        url: actionUrl,
        imageUrl,
      });
    } else if (filterTags && Object.keys(filterTags).length > 0) {
      const filters = Object.entries(filterTags).map(([key, value]) => ({
        field: 'tag',
        key,
        relation: '=',
        value,
      }));
      await onesignalService.sendWithFilters(filters, {
        title,
        body,
        data,
        url: actionUrl,
        imageUrl,
      });
    } else {
      // Send to all subscribed users
      await onesignalService.sendToAll({
        title,
        body,
        data,
        url: actionUrl,
        imageUrl,
      });
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: `Broadcast notification sent${segment ? ` to segment: ${segment}` : ''}`,
      timestamp: new Date(),
      data: { segment, hasFilters: !!filterTags },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Failed to send broadcast',
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

/**
 * Handle topic/channel notification
 */
async function handleSendTopicNotification(job: Job<SendTopicNotificationDto>): Promise<JobResult> {
  const { topic, title, body, imageUrl, data } = job.data;

  await job.updateProgress(10);

  try {
    // Send to topic/channel subscribers via Socket.IO
    socketService.emitToRoom(topic, 'notification', {
      title,
      body,
      imageUrl,
      data,
      topic,
      createdAt: new Date(),
    });

    await job.updateProgress(100);

    return {
      success: true,
      message: `Topic notification sent to: ${topic}`,
      timestamp: new Date(),
      data: { topic },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: 'Failed to send topic notification',
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

/**
 * Create and start the notification worker
 */
export function createNotificationWorker(concurrency = 5): Worker<NotificationJobData, JobResult> {
  const worker = new Worker<NotificationJobData, JobResult>(
    Queues.QUEUE__NOTIFICATION.name,
    notificationProcessor,
    {
      connection: redisService.getClient().duplicate(),
      concurrency,
      limiter: {
        max: 200,
        duration: 60000, // 200 notifications per minute
      },
    }
  );

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info(`Notification job completed: ${job.name} (ID: ${job.id})`, {
      success: result.success,
      message: result.message,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Notification job failed: ${job?.name} (ID: ${job?.id})`, {
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (error) => {
    logger.error('Notification worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Notification job stalled: ${jobId}`);
  });

  logger.info(`Notification worker started with concurrency: ${concurrency}`);

  return worker;
}

export default createNotificationWorker;
