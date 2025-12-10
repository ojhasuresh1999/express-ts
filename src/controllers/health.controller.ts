import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../utils/response';
import config from '../config';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    server: 'up' | 'down';
    database?: 'connected' | 'disconnected';
  };
}

/**
 * Health check controller
 */
export const getHealth = (_req: Request, res: Response): Response => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      server: 'up',
      // database: 'connected', // Uncomment when database is configured
    },
  };

  return sendSuccess(res, healthStatus, 'Service is healthy', StatusCodes.OK);
};

/**
 * Readiness check (for Kubernetes)
 */
export const getReady = (_req: Request, res: Response): Response => {
  // Add checks for dependencies (database, cache, etc.)
  const isReady = true;

  if (!isReady) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: 'Service is not ready',
    });
  }

  return sendSuccess(res, { ready: true }, 'Service is ready');
};

/**
 * Liveness check (for Kubernetes)
 */
export const getLive = (_req: Request, res: Response): Response => {
  return sendSuccess(res, { alive: true }, 'Service is alive');
};
