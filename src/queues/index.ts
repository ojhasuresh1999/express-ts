/**
 * Queue Module
 * Production-level queue system using BullMQ
 */

// Queue service
export { queueService, default as QueueService } from './queue.service';

// Queue constants and helpers
export {
  Queues,
  QueueKey,
  QueueConfig,
  QueueName,
  QueueJobs,
  JobKey,
  JobName,
  getAllQueueNames,
  getAllQueueKeys,
  getQueueRegistrationConfig,
  getJobName,
  getQueueName,
  getQueueKeyFromName,
  getDefaultJobOptions,
} from './queue.constants';

// Queue types
export type {
  JobPayloadMap,
  JobOptionsType,
  AddJobParams,
  JobResult,
  QueueStats,
  AllQueueStats,
  JobInfo,
} from './queue.types';

export {
  isValidQueueKey,
  isSuccessResult,
  isEmailQueueJob,
  isSmsQueueJob,
  isNotificationQueueJob,
} from './queue.types';

// DTOs
export * from './dto';

// Bull Board
export { mountBullBoard, getBullBoardAdapter, registerBullBoardQueues } from './bullboard';

// Processors
export {
  initializeWorkers,
  closeWorkers,
  getWorkers,
  createEmailWorker,
  createSmsWorker,
  createNotificationWorker,
  registerSmsProvider,
} from './processors';
