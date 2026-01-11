import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config from './config';
import routes from './routes';
import passport from './config/passport';
import { morganStream } from './utils/logger';
import { errorHandler, notFoundHandler, defaultRateLimiter } from './middlewares';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { mountBullBoard } from './queues';

/**
 * Create and configure Express application
 * @param beforeErrorHandlers - Optional callback to register routes before error handlers
 */
const createApp = (beforeErrorHandlers?: (app: Application) => void): Application => {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.onesignal.com',
            'https://onesignal.com',
            'https://api.onesignal.com',
            'https://cdn.jsdelivr.net',
          ],
          connectSrc: [
            "'self'",
            'https://onesignal.com',
            'https://cdn.onesignal.com',
            'https://api.onesignal.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://cdn.onesignal.com',
            'https://onesignal.com',
            'https://res.cloudinary.com',
          ],
          mediaSrc: ["'self'", 'https://res.cloudinary.com'],
          frameSrc: ["'self'", 'https://onesignal.com', 'https://api.onesignal.com'],
        },
      },
    })
  );
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Upload-Length',
        'Upload-Offset',
        'Tus-Resumable',
        'Upload-Metadata',
      ],
      exposedHeaders: [
        'Upload-Offset',
        'Location',
        'Upload-Length',
        'Tus-Version',
        'Tus-Resumable',
        'Tus-Max-Size',
        'Tus-Extension',
        'Upload-Metadata',
      ],
    })
  );

  // Rate limiting
  app.use(defaultRateLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression() as unknown as express.RequestHandler);

  // Static files
  app.use(express.static('public'));

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

  // Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve as unknown as express.RequestHandler[],
    swaggerUi.setup(swaggerSpec) as unknown as express.RequestHandler
  );

  // Bull Board (Queue Dashboard) - mounted before auth middleware
  // Note: Queues are registered lazily in server.ts
  mountBullBoard(app);

  // API routes
  app.use(passport.initialize() as unknown as express.RequestHandler);
  app.use(config.api.prefix, routes);

  // Call the callback to register additional routes before error handlers (e.g., TUS)
  if (beforeErrorHandlers) {
    beforeErrorHandlers(app);
  }

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
};

export default createApp;
