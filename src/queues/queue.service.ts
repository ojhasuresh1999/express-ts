import { Queue, type ConnectionOptions, type Job } from 'bullmq';
import { redisService } from '../services/redis.service';
import logger from '../utils/logger';
import {
  Queues,
  QueueKey,
  getAllQueueKeys,
  getQueueName,
  getJobName,
  getDefaultJobOptions,
} from './queue.constants';
import type {
  JobPayloadMap,
  AddJobParams,
  QueueStats,
  AllQueueStats,
  JobInfo,
} from './queue.types';

/**
 * Production-level Queue Service
 * Manages BullMQ queues with type-safe job handling
 */
class QueueService {
  private static instance: QueueService;
  private queues: Map<string, Queue> = new Map();
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Get Redis connection options for BullMQ
   */
  private getConnectionOptions(): ConnectionOptions {
    return redisService.getClient();
  }

  /**
   * Initialize all queues
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Queue service already initialized');
      return;
    }

    try {
      const connection = this.getConnectionOptions();

      // Create queue instances for each defined queue
      for (const queueKey of getAllQueueKeys()) {
        const queueConfig = Queues[queueKey];
        const queue = new Queue(queueConfig.name, {
          connection,
          defaultJobOptions: queueConfig.options?.defaultJobOptions,
        });

        this.queues.set(queueKey, queue);
        logger.info(`Queue initialized: ${queueConfig.name} (${queueKey})`);
      }

      this.initialized = true;
      logger.info('Queue service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      throw error;
    }
  }

  /**
   * Type-safe job addition
   * @template Q - Queue key
   * @template J - Job key
   */
  public async addJob<Q extends keyof JobPayloadMap, J extends keyof JobPayloadMap[Q]>(
    params: AddJobParams<Q, J>
  ): Promise<Job<JobPayloadMap[Q][J]>> {
    const { queue: queueKey, job: jobKey, data, options } = params;

    const queue = this.getQueue(queueKey);
    const jobName = getJobName(queueKey, jobKey as Parameters<typeof getJobName>[1]);
    const defaultOptions = getDefaultJobOptions(queueKey);

    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };

    const job = await queue.add(jobName, data, mergedOptions);

    logger.debug(`Job added: ${jobName} (ID: ${job.id}) to queue ${queueKey}`);

    return job as Job<JobPayloadMap[Q][J]>;
  }

  /**
   * Add multiple jobs in bulk (more efficient than individual adds)
   */
  public async addBulkJobs<Q extends keyof JobPayloadMap, J extends keyof JobPayloadMap[Q]>(
    queueKey: Q,
    jobs: Array<{ job: J; data: JobPayloadMap[Q][J]; options?: AddJobParams<Q, J>['options'] }>
  ): Promise<Job<JobPayloadMap[Q][J]>[]> {
    const queue = this.getQueue(queueKey);
    const defaultOptions = getDefaultJobOptions(queueKey);

    const bulkJobs = jobs.map(({ job: jobKey, data, options }) => ({
      name: getJobName(queueKey, jobKey as Parameters<typeof getJobName>[1]),
      data,
      opts: {
        ...defaultOptions,
        ...options,
      },
    }));

    const addedJobs = await queue.addBulk(bulkJobs);

    logger.debug(`${addedJobs.length} jobs added in bulk to queue ${queueKey}`);

    return addedJobs as Job<JobPayloadMap[Q][J]>[];
  }

  /**
   * Get a specific queue instance
   */
  public getQueue<Q extends QueueKey>(queueKey: Q): Queue {
    const queue = this.queues.get(queueKey);
    if (!queue) {
      throw new Error(`Queue not found: ${queueKey}. Ensure queue service is initialized.`);
    }
    return queue;
  }

  /**
   * Get all queue instances
   */
  public getAllQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  /**
   * Get statistics for a specific queue
   */
  public async getQueueStats(queueKey: QueueKey): Promise<QueueStats> {
    const queue = this.getQueue(queueKey);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: getQueueName(queueKey),
      key: queueKey,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: 0,
    };
  }

  /**
   * Get statistics for all queues
   */
  public async getAllQueueStats(): Promise<AllQueueStats> {
    const queueKeys = getAllQueueKeys();
    const statsPromises = queueKeys.map((key) => this.getQueueStats(key));
    const queuesStats = await Promise.all(statsPromises);

    const totals = queuesStats.reduce(
      (acc, stats) => ({
        waiting: acc.waiting + stats.waiting,
        active: acc.active + stats.active,
        completed: acc.completed + stats.completed,
        failed: acc.failed + stats.failed,
        delayed: acc.delayed + stats.delayed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    );

    return {
      queues: queuesStats,
      totals,
      timestamp: new Date(),
    };
  }

  /**
   * Get job information by ID
   */
  public async getJob(queueKey: QueueKey, jobId: string): Promise<JobInfo | null> {
    const queue = this.getQueue(queueKey);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress:
        typeof job.progress === 'number'
          ? job.progress
          : typeof job.progress === 'object'
            ? job.progress
            : 0,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      state,
      priority: job.opts?.priority,
      delay: job.opts?.delay,
    };
  }

  /**
   * Get failed jobs for a queue
   */
  public async getFailedJobs(queueKey: QueueKey, start = 0, end = 10): Promise<JobInfo[]> {
    const queue = this.getQueue(queueKey);
    const jobs = await queue.getFailed(start, end);

    return jobs.map((job) => {
      const progress =
        typeof job.progress === 'number'
          ? job.progress
          : typeof job.progress === 'object'
            ? job.progress
            : 0;
      return {
        id: job.id,
        name: job.name,
        data: job.data,
        progress,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
        state: 'failed' as const,
      };
    });
  }

  /**
   * Retry a failed job
   */
  public async retryJob(queueKey: QueueKey, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueKey);
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.retry();
    logger.info(`Job ${jobId} retried in queue ${queueKey}`);
    return true;
  }

  /**
   * Remove a job
   */
  public async removeJob(queueKey: QueueKey, jobId: string): Promise<boolean> {
    const queue = this.getQueue(queueKey);
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    await job.remove();
    logger.info(`Job ${jobId} removed from queue ${queueKey}`);
    return true;
  }

  /**
   * Pause a queue
   */
  public async pauseQueue(queueKey: QueueKey): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.pause();
    logger.info(`Queue ${queueKey} paused`);
  }

  /**
   * Resume a queue
   */
  public async resumeQueue(queueKey: QueueKey): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.resume();
    logger.info(`Queue ${queueKey} resumed`);
  }

  /**
   * Clean old jobs from a queue
   */
  public async cleanQueue(
    queueKey: QueueKey,
    options: {
      grace?: number;
      status?: 'completed' | 'failed' | 'delayed' | 'wait' | 'active';
      limit?: number;
    } = {}
  ): Promise<string[]> {
    const queue = this.getQueue(queueKey);
    const { grace = 3600000, status = 'completed', limit = 100 } = options;

    const removed = await queue.clean(grace, limit, status);
    logger.info(`Cleaned ${removed.length} ${status} jobs from queue ${queueKey}`);
    return removed;
  }

  /**
   * Obliterate a queue (remove all data) - use with caution!
   */
  public async obliterateQueue(queueKey: QueueKey): Promise<void> {
    const queue = this.getQueue(queueKey);
    await queue.obliterate();
    logger.warn(`Queue ${queueKey} obliterated`);
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gracefully close all queue connections
   */
  public async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) => queue.close());

    await Promise.all(closePromises);
    this.queues.clear();
    this.initialized = false;
    logger.info('Queue service closed');
  }
}

export const queueService = QueueService.getInstance();
export default queueService;
