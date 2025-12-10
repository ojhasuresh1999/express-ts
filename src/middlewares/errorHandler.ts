import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { sendError } from '../utils/response';
import logger from '../utils/logger';
import config from '../config';

/**
 * Convert non-ApiError errors to ApiError
 */
const normalizeError = (err: Error): ApiError => {
  if (err instanceof ApiError) {
    return err;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return ApiError.badRequest(err.message);
  }

  if (err.name === 'CastError') {
    return ApiError.badRequest('Invalid ID format');
  }

  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired');
  }

  // Default to internal server error
  return ApiError.internal(config.env === 'production' ? 'Internal server error' : err.message);
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  const apiError = normalizeError(err);

  // Log error
  if (!apiError.isOperational) {
    logger.error('Unhandled error:', err);
  } else {
    logger.warn(`${apiError.statusCode} - ${apiError.message}`);
  }

  return sendError(
    res,
    apiError.message,
    apiError.statusCode,
    apiError.details,
    config.env === 'development' ? err.stack : undefined
  );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: Error): void => {
  logger.error('Unhandled Promise Rejection:', reason);
  throw reason;
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error): void => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
};
