import type { Worker } from 'bullmq';
import { createEmailWorker } from './email.processor';
import { createSmsWorker } from './sms.processor';
import { createNotificationWorker } from './notification.processor';
import logger from '../../utils/logger';
import type { JobResult } from '../queue.types';

// Store worker instances for cleanup - using Worker<any> for flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workers: Worker<any, JobResult>[] = [];

interface WorkerConfig {
  emailConcurrency?: number;
  smsConcurrency?: number;
  notificationConcurrency?: number;
}

/**
 * Initialize all queue workers
 * @param config - Worker concurrency configuration
 */
export function initializeWorkers(config: WorkerConfig = {}): void {
  const { emailConcurrency = 5, smsConcurrency = 3, notificationConcurrency = 5 } = config;

  // Create and store workers
  workers.push(createEmailWorker(emailConcurrency));
  workers.push(createSmsWorker(smsConcurrency));
  workers.push(createNotificationWorker(notificationConcurrency));

  logger.info(`All queue workers initialized (${workers.length} workers)`);
}

/**
 * Get all active workers
 */
export function getWorkers(): Worker<unknown, JobResult>[] {
  return workers;
}

/**
 * Close all workers gracefully
 */
export async function closeWorkers(): Promise<void> {
  logger.info('Closing queue workers...');

  const closePromises = workers.map(async (worker) => {
    try {
      await worker.close();
    } catch (error) {
      logger.error(`Error closing worker ${worker.name}:`, error);
    }
  });

  await Promise.all(closePromises);
  workers.length = 0; // Clear the array

  logger.info('All queue workers closed');
}

// Export individual processor creators for advanced usage
export { createEmailWorker } from './email.processor';
export { createSmsWorker, registerSmsProvider } from './sms.processor';
export { createNotificationWorker } from './notification.processor';
