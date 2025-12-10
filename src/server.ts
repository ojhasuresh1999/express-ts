import http from 'http';
import createApp from './app';
import config from './config';
import logger from './utils/logger';
import { handleUncaughtException, handleUnhandledRejection } from './middlewares/errorHandler';

// Handle uncaught exceptions
process.on('uncaughtException', handleUncaughtException);

// Handle unhandled promise rejections
process.on('unhandledRejection', handleUnhandledRejection);

const app = createApp();
const server = http.createServer(app);

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }

    logger.info('HTTP server closed');

    // Close database connections here
    // await prisma.$disconnect();
    // await mongoose.connection.close();

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
 * Start the server
 */
const startServer = (): void => {
  server.listen(config.port, config.host, () => {
    logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Server is running!                                   ║
║                                                           ║
║   ➤ Environment: ${config.env.padEnd(38)}║
║   ➤ URL: http://${config.host}:${config.port}${' '.repeat(Math.max(0, 34 - `${config.host}:${config.port}`.length))}║
║   ➤ API: http://${config.host}:${config.port}${config.api.prefix}${' '.repeat(Math.max(0, 34 - `${config.host}:${config.port}${config.api.prefix}`.length))}║
║   ➤ Health: http://${config.host}:${config.port}${config.api.prefix}/health${' '.repeat(Math.max(0, 27 - `${config.host}:${config.port}${config.api.prefix}`.length))}║
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
};

startServer();

export default server;
