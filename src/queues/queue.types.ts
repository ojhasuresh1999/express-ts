import type { JobsOptions } from 'bullmq';
import type {
  SendEmailDto,
  SendBulkEmailDto,
  SendWelcomeEmailDto,
  SendPasswordResetDto,
  SendEmailVerificationDto,
  SendOtpEmailDto,
  SendTransactionalEmailDto,
  SendSmsDto,
  SendBulkSmsDto,
  SendOtpDto,
  SendTemplatedSmsDto,
  SendPushDto,
  SendBulkPushDto,
  SendInAppDto,
  SendBroadcastDto,
  SendTopicNotificationDto,
} from './dto';

// ============================================================================
// Job Payload Type Mapping
// ============================================================================

/**
 * Maps each queue's jobs to their expected payload types
 * This provides compile-time type safety when adding jobs to queues
 */
export type JobPayloadMap = {
  QUEUE__EMAIL: {
    SEND_EMAIL: SendEmailDto;
    SEND_BULK_EMAIL: SendBulkEmailDto;
    SEND_WELCOME_EMAIL: SendWelcomeEmailDto;
    SEND_PASSWORD_RESET: SendPasswordResetDto;
    SEND_EMAIL_VERIFICATION: SendEmailVerificationDto;
    SEND_OTP_EMAIL: SendOtpEmailDto;
    SEND_TRANSACTIONAL_EMAIL: SendTransactionalEmailDto;
  };
  QUEUE__SMS: {
    SEND_SMS: SendSmsDto;
    SEND_BULK_SMS: SendBulkSmsDto;
    SEND_OTP: SendOtpDto;
    SEND_TEMPLATED_SMS: SendTemplatedSmsDto;
  };
  QUEUE__NOTIFICATION: {
    SEND_PUSH: SendPushDto;
    SEND_BULK_PUSH: SendBulkPushDto;
    SEND_IN_APP: SendInAppDto;
    SEND_BROADCAST: SendBroadcastDto;
    SEND_TOPIC_NOTIFICATION: SendTopicNotificationDto;
  };
};

// ============================================================================
// Job Operation Types
// ============================================================================

/**
 * Options that can be passed when adding a job
 */
export type JobOptionsType = Pick<
  JobsOptions,
  | 'delay'
  | 'priority'
  | 'attempts'
  | 'jobId'
  | 'repeat'
  | 'backoff'
  | 'lifo'
  | 'removeDependencyOnFailure'
>;

/**
 * Type-safe parameters for adding a job to a queue
 * @template Q - Queue key (e.g., 'QUEUE__EMAIL')
 * @template J - Job key within the queue (e.g., 'SEND_EMAIL')
 */
export type AddJobParams<Q extends keyof JobPayloadMap, J extends keyof JobPayloadMap[Q]> = {
  /** Queue key (e.g., 'QUEUE__EMAIL') */
  queue: Q;
  /** Job key within the queue (e.g., 'SEND_EMAIL') */
  job: J;
  /** Job payload data - type is inferred from queue and job */
  data: JobPayloadMap[Q][J];
  /** Optional job options (delay, priority, etc.) */
  options?: JobOptionsType;
};

/**
 * Result returned by job processors
 */
export interface JobResult {
  /** Whether the job completed successfully */
  success: boolean;
  /** Human-readable result message */
  message?: string;
  /** Error message if job failed */
  error?: string;
  /** When the job completed */
  timestamp: Date;
  /** Additional result data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Queue Statistics Types
// ============================================================================

/**
 * Statistics for a single queue
 */
export interface QueueStats {
  /** Queue name */
  name: string;
  /** Queue key */
  key: string;
  /** Number of jobs waiting to be processed */
  waiting: number;
  /** Number of currently active jobs */
  active: number;
  /** Number of completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of delayed jobs */
  delayed: number;
  /** Number of paused jobs */
  paused: number;
}

/**
 * Job information
 */
export interface JobInfo {
  /** Job ID */
  id: string | undefined;
  /** Job name (e.g., 'send:email') */
  name: string;
  /** Job payload data */
  data: unknown;
  /** Job progress (0-100 or custom object) */
  progress: number | object;
  /** Number of attempts made */
  attemptsMade: number;
  /** When processing started (timestamp) */
  processedOn?: number;
  /** When job finished (timestamp) */
  finishedOn?: number;
  /** Reason for failure (if failed) */
  failedReason?: string;
  /** Return value from processor */
  returnvalue?: unknown;
  /** Current job state */
  state?: string;
  /** Job priority */
  priority?: number;
  /** Delay in milliseconds */
  delay?: number;
}

/**
 * All queue statistics
 */
export interface AllQueueStats {
  /** Statistics for each queue */
  queues: QueueStats[];
  /** Total jobs across all queues */
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  /** Stats retrieved at this time */
  timestamp: Date;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid queue key
 */
export function isValidQueueKey(key: string): key is keyof JobPayloadMap {
  return ['QUEUE__EMAIL', 'QUEUE__SMS', 'QUEUE__NOTIFICATION'].includes(key);
}

/**
 * Type guard to check if a result indicates success
 */
export function isSuccessResult(result: JobResult): boolean {
  return result.success === true;
}

/**
 * Type guard for email queue jobs
 */
export function isEmailQueueJob(queueKey: string, jobKey: string): queueKey is 'QUEUE__EMAIL' {
  return (
    queueKey === 'QUEUE__EMAIL' &&
    [
      'SEND_EMAIL',
      'SEND_BULK_EMAIL',
      'SEND_WELCOME_EMAIL',
      'SEND_PASSWORD_RESET',
      'SEND_EMAIL_VERIFICATION',
      'SEND_OTP_EMAIL',
      'SEND_TRANSACTIONAL_EMAIL',
    ].includes(jobKey)
  );
}

/**
 * Type guard for SMS queue jobs
 */
export function isSmsQueueJob(queueKey: string, jobKey: string): queueKey is 'QUEUE__SMS' {
  return (
    queueKey === 'QUEUE__SMS' &&
    ['SEND_SMS', 'SEND_BULK_SMS', 'SEND_OTP', 'SEND_TEMPLATED_SMS'].includes(jobKey)
  );
}

/**
 * Type guard for notification queue jobs
 */
export function isNotificationQueueJob(
  queueKey: string,
  jobKey: string
): queueKey is 'QUEUE__NOTIFICATION' {
  return (
    queueKey === 'QUEUE__NOTIFICATION' &&
    [
      'SEND_PUSH',
      'SEND_BULK_PUSH',
      'SEND_IN_APP',
      'SEND_BROADCAST',
      'SEND_TOPIC_NOTIFICATION',
    ].includes(jobKey)
  );
}
