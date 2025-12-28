import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken, AccessTokenPayload } from '../services/token.service';
import { User, UserRole } from '../models';
import logger from '../utils/logger';

/**
 * Extended request with authenticated user and session
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        isActive: boolean;
      };
      session?: {
        id: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user to request
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('No token provided');
    }

    // Verify token
    let payload: AccessTokenPayload;
    try {
      payload = await verifyAccessToken(token);
    } catch (error) {
      logger.debug(`Token verification failed: ${(error as Error).message}`);
      throw ApiError.unauthorized('Invalid or expired token');
    }

    // Get user from database
    const user = await User.findById(payload.userId);

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware factory
 * Checks if user has required roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated'));
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    try {
      const payload = await verifyAccessToken(token);
      const user = await User.findById(payload.userId);

      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      }
    } catch {
      // Token invalid, but that's ok for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh token authentication middleware
 * Used for the refresh token endpoint
 */
export const authenticateRefreshToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token is required');
    }

    // Token will be verified in the service layer
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
