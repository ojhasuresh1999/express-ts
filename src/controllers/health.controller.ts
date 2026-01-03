import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import os from 'os';
import { sendSuccess, sendError } from '../utils/response';
import { redisService } from '../services/redis.service';
import config from '../config';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: {
    name: string;
    version: string;
    environment: string;
  };
  system: {
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercentage: string;
    };
    loadAverage: number[];
  };
  process: {
    uptime: number;
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  checks: {
    database: {
      status: string;
      message: string;
    };
    redis: {
      status: string;
      message: string;
    };
  };
}

/**
 * Get MongoDB connection status message
 */
const getMongoStatus = (state: number): { status: string; message: string } => {
  const STATES: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };
  return {
    status: STATES[state] || 'unknown',
    message: state === 1 ? 'Database is healthy' : 'Database connection issue',
  };
};

/**
 * Health check controller
 * GET /health
 */
export const getHealth = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Check Dependencies
    const mongoState = mongoose.connection.readyState;
    const isRedisConnected = redisService.isConnected();

    const mongoStatus = getMongoStatus(mongoState);
    const redisStatus = {
      status: isRedisConnected ? 'connected' : 'disconnected',
      message: isRedisConnected ? 'Redis is healthy' : 'Redis connection issue',
    };

    // System Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(2) + '%';

    // Determine Global Status
    let globalStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (mongoState !== 1 && !isRedisConnected) {
      globalStatus = 'unhealthy';
    } else if (mongoState !== 1 || !isRedisConnected) {
      globalStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: globalStatus,
      timestamp: new Date().toISOString(),
      service: {
        name: process.env.npm_package_name || 'express-ts-api',
        version: process.env.npm_package_version || '1.0.0',
        environment: config.env,
      },
      system: {
        uptime: os.uptime(),
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usagePercentage: memUsage,
        },
        loadAverage: os.loadavg(),
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
      },
      checks: {
        database: mongoStatus,
        redis: redisStatus,                                     
      },
    };

    const statusCode =
      globalStatus === 'unhealthy' ? StatusCodes.SERVICE_UNAVAILABLE : StatusCodes.OK;

    return sendSuccess(res, healthStatus, `Service is ${globalStatus}`, statusCode);
  } catch (error) {
    return sendError(res, 'Health check failed', StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Readiness check (for Kubernetes)
 * GET /health/ready
 */
export const getReady = async (_req: Request, res: Response): Promise<Response> => {
  const mongoState = mongoose.connection.readyState;
  const isRedisConnected = redisService.isConnected();

  const isReady = mongoState === 1 && isRedisConnected;

  if (!isReady) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: 'Service is not ready',
      errors: [
        mongoState !== 1 ? 'Database not connected' : null,
        !isRedisConnected ? 'Redis not connected' : null,
      ].filter(Boolean),
    });
  }

  return sendSuccess(res, { ready: true }, 'Service is ready');
};

/**
 * Liveness check (for Kubernetes)
 * GET /health/live
 */
export const getLive = (_req: Request, res: Response): Response => {
  return sendSuccess(res, { alive: true }, 'Service is alive');
};
