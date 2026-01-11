import http from 'http';
import createApp from './app';
import config from './config';
import logger from './utils/logger';
import { handleUncaughtException, handleUnhandledRejection } from './middlewares/errorHandler';
import mongoose from 'mongoose';
import { connectDB } from './config/database';
import { redisService } from './services/redis.service';
import { socketService } from './services/socket.service';
import { tusService } from './services/tus.service';
import { queueService, initializeWorkers, closeWorkers, registerBullBoardQueues } from './queues';

process.on('uncaughtException', handleUncaughtException);

process.on('unhandledRejection', handleUnhandledRejection);

// Initialize app with TUS service registered before error handlers
const app = createApp((expressApp) => {
  tusService.initialize(expressApp);
});

const server = http.createServer(app);

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async (err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Close queue workers first (stop processing jobs)
    await closeWorkers();
    logger.info('Queue workers closed');

    // Close queue service
    await queueService.close();
    logger.info('Queue service closed');

    // Close Socket.IO connections
    await socketService.close();
    logger.info('Socket.IO server closed');

    // Close Redis connections
    await redisService.disconnect();
    logger.info('Redis connections closed');

    // Close database connections
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Initialize services and start the server
 */
const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize Redis
    await redisService.connect();
    logger.info('Redis connected');

    // Initialize Socket.IO with Redis adapter
    await socketService.initialize(server);
    logger.info('Socket.IO initialized');

    // Initialize Queue Service
    await queueService.initialize();
    logger.info('Queue service initialized');

    // Register queues with Bull Board
    registerBullBoardQueues();

    // Initialize Queue Workers (processors)
    initializeWorkers({
      emailConcurrency: config.queue.concurrency,
      smsConcurrency: Math.ceil(config.queue.concurrency / 2),
      notificationConcurrency: config.queue.concurrency,
    });
    logger.info('Queue workers initialized');

    // Start HTTP server
    server.listen(config.port, config.host, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Server is running!                                   ║
║                                                           ║
║   ➤ Environment: ${config.env.padEnd(38)}║
║   ➤ URL: http://${config.host}:${config.port}${' '.repeat(Math.max(0, 34 - `${config.host}:${config.port}`.length))}  ║
║   ➤ API: http://${config.host}:${config.port}${config.api.prefix}${' '.repeat(Math.max(0, 34 - `${config.host}:${config.port}${config.api.prefix}`.length))} ║
║   ➤ Health: http://${config.host}:${config.port}${config.api.prefix}/health${' '.repeat(Math.max(0, 27 - `${config.host}:${config.port}${config.api.prefix}`.length))} ║
║   ➤ Swagger: http://${config.host}:${config.port}/api-docs${' '.repeat(Math.max(0, 30 - `${config.host}:${config.port}/api-docs`.length))} ║
║   ➤ Socket.IO: ws://${config.host}:${config.port}${config.socket.path}${' '.repeat(Math.max(0, 26 - `${config.host}:${config.port}${config.socket.path}`.length))} ║
║   ➤ Bull Board: http://${config.host}:${config.port}${config.queue.boardPath}${' '.repeat(Math.max(0, 26 - `${config.host}:${config.port}${config.queue.boardPath}`.length))} ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          logger.error(`Port ${config.port} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`Port ${config.port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default server;
