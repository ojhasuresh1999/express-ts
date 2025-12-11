import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config from './config';
import routes from './routes';
import { morganStream } from './utils/logger';
import { errorHandler, notFoundHandler, defaultRateLimiter } from './middlewares';
import { connectDB } from './config/database';

connectDB();

/**
 * Create and configure Express application
 */
const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Rate limiting
  app.use(defaultRateLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // HTTP request logging
  if (config.env !== 'test') {
    app.use(
      morgan(config.logging.format, {
        stream: morganStream,
      })
    );
  }

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // API routes
  app.use(config.api.prefix, routes);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};

export default createApp;
