import rateLimit from 'express-rate-limit';
import config from '../config';
import { ApiError } from '../utils/ApiError';

/**
 * Default rate limiter for API endpoints
 */
export const defaultRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests());
  },
});

/**
 * Strict rate limiter for sensitive endpoints (e.g., auth)
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Too many attempts, please try again later'));
  },
});
