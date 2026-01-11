import type { DefaultJobOptions } from 'bullmq';

/**
 * Centralized Queue Definitions
 * All queues and their jobs are defined here for type safety and consistency
 */
export const Queues = {
  QUEUE__EMAIL: {
    name: 'email-queue',
    description: 'Queue for email operations',
    jobs: {
      SEND_EMAIL: { name: 'send:email' },
      SEND_BULK_EMAIL: { name: 'send:bulk-email' },
      SEND_WELCOME_EMAIL: { name: 'send:welcome-email' },
      SEND_PASSWORD_RESET: { name: 'send:password-reset' },
      SEND_EMAIL_VERIFICATION: { name: 'send:email-verification' },
      SEND_OTP_EMAIL: { name: 'send:otp-email' },
      SEND_TRANSACTIONAL_EMAIL: { name: 'send:transactional-email' },
    },
    options: {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      } satisfies DefaultJobOptions,
    },
  },
  QUEUE__SMS: {
    name: 'sms-queue',
    description: 'Queue for SMS operations',
    jobs: {
      SEND_SMS: { name: 'send:sms' },
      SEND_BULK_SMS: { name: 'send:bulk-sms' },
      SEND_OTP: { name: 'send:otp' },
      SEND_TEMPLATED_SMS: { name: 'send:templated-sms' },
    },
    options: {
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 200 },
      } satisfies DefaultJobOptions,
    },
  },
  QUEUE__NOTIFICATION: {
    name: 'notification-queue',
    description: 'Queue for push and in-app notifications',
    jobs: {
      SEND_PUSH: { name: 'send:push' },
      SEND_BULK_PUSH: { name: 'send:bulk-push' },
      SEND_IN_APP: { name: 'send:in-app' },
      SEND_BROADCAST: { name: 'send:broadcast' },
      SEND_TOPIC_NOTIFICATION: { name: 'send:topic' },
    },
    options: {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      } satisfies DefaultJobOptions,
    },
  },
} as const;

// ============================================================================
// Type Utilities
// ============================================================================

/** All queue keys (e.g., 'QUEUE__EMAIL', 'QUEUE__SMS') */
export type QueueKey = keyof typeof Queues;

/** Configuration for a specific queue */
export type QueueConfig<K extends QueueKey> = (typeof Queues)[K];

/** Queue name string for a specific queue key */
export type QueueName<K extends QueueKey> = QueueConfig<K>['name'];

/** All jobs for a specific queue */
export type QueueJobs<K extends QueueKey> = QueueConfig<K>['jobs'];

/** Job keys for a specific queue (e.g., 'SEND_EMAIL', 'SEND_BULK_EMAIL') */
export type JobKey<K extends QueueKey> = keyof QueueJobs<K>;

/** Job configuration type */
type JobConfig = { name: string };

/** Job name string for a specific job in a queue */
export type JobName<K extends QueueKey, J extends JobKey<K>> = QueueJobs<K>[J] extends JobConfig
  ? QueueJobs<K>[J]['name']
  : never;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all queue names for registration
 */
export const getAllQueueNames = (): string[] => Object.values(Queues).map((q) => q.name);

/**
 * Get all queue keys
 */
export const getAllQueueKeys = (): QueueKey[] => Object.keys(Queues) as QueueKey[];

/**
 * Get queue configuration for BullMQ registration
 */
export const getQueueRegistrationConfig = () => {
  return Object.values(Queues).map((q) => ({
    name: q.name,
    ...('options' in q ? q.options : {}),
  }));
};

/**
 * Get job name from queue and job key
 */
export function getJobName<K extends QueueKey, J extends JobKey<K>>(
  queueKey: K,
  jobKey: J
): string {
  const queue = Queues[queueKey];
  const jobs = queue.jobs as Record<string, { name: string }>;
  const job = jobs[jobKey as string];
  return job.name;
}

/**
 * Get queue name from queue key
 */
export function getQueueName<K extends QueueKey>(queueKey: K): string {
  return Queues[queueKey].name;
}

/**
 * Get queue key from queue name
 */
export function getQueueKeyFromName(queueName: string): QueueKey | undefined {
  const entry = Object.entries(Queues).find(([, config]) => config.name === queueName);
  return entry ? (entry[0] as QueueKey) : undefined;
}

/**
 * Get default job options for a queue
 */
export function getDefaultJobOptions<K extends QueueKey>(
  queueKey: K
): DefaultJobOptions | undefined {
  return Queues[queueKey].options?.defaultJobOptions;
}
