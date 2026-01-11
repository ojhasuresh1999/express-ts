import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import type { Application, RequestHandler } from 'express';
import { queueService } from './queue.service';
import config from '../config';
import logger from '../utils/logger';

/**
 * Bull Board server adapter instance
 */
let serverAdapter: ExpressAdapter | null = null;
let bullBoard: ReturnType<typeof createBullBoard> | null = null;

/**
 * Basic authentication middleware for Bull Board
 * Only enabled when QUEUE_BOARD_USERNAME and QUEUE_BOARD_PASSWORD are set
 */
function createBasicAuthMiddleware(): RequestHandler | null {
  const { username, password } = config.queue.boardAuth;

  if (!username || !password) {
    logger.warn(
      'Bull Board running without authentication - set QUEUE_BOARD_USERNAME and QUEUE_BOARD_PASSWORD for production'
    );
    return null;
  }

  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [providedUsername, providedPassword] = credentials.split(':');

    if (providedUsername === username && providedPassword === password) {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Invalid credentials');
    }
  };
}

/**
 * Mount Bull Board on Express app
 * This should be called before the 404 handler
 */
export function mountBullBoard(app: Application): void {
  if (serverAdapter) {
    logger.warn('Bull Board already mounted');
    return;
  }

  // Create Express adapter
  serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(config.queue.boardPath);

  // Create Bull Board with empty queues initially
  bullBoard = createBullBoard({
    queues: [],
    serverAdapter,
  });

  const authMiddleware = createBasicAuthMiddleware();

  if (authMiddleware) {
    app.use(config.queue.boardPath, authMiddleware, serverAdapter.getRouter());
  } else {
    app.use(config.queue.boardPath, serverAdapter.getRouter());
  }

  logger.info(`Bull Board mounted at ${config.queue.boardPath}`);
}

/**
 * Register queues with Bull Board
 * This should be called after queues are initialized
 */
export function registerBullBoardQueues(): void {
  if (!bullBoard) {
    logger.error('Bull Board not initialized - call mountBullBoard first');
    return;
  }

  // Get all queue instances
  const queues: Queue[] = queueService.getAllQueues();

  // Create adapters for each queue
  const queueAdapters = queues.map((queue) => new BullMQAdapter(queue));

  // Update Bull Board queues
  bullBoard.replaceQueues(queueAdapters);

  logger.info(`Bull Board queues updated: ${queues.length} active queues`);
}

/**
 * Get the Bull Board server adapter
 */
export function getBullBoardAdapter(): ExpressAdapter | null {
  return serverAdapter;
}

// Export types for external use
export type { ExpressAdapter };
