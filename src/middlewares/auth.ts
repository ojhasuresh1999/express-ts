import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../models';
import { MESSAGES } from '../constants/messages';



/**
 * Passport JWT authentication middleware
 * Uses passport's built-in JWT strategy
 */
export const authenticate = passport.authenticate('jwt', {
  session: false,
  failWithError: true,
});

/**
 * Custom authentication middleware wrapper
 * Handles passport errors and converts them to ApiError
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  passport.authenticate(
    'jwt',
    { session: false },
    async (err: Error | null, user: any, info: any) => {
      try {
        if (err) {
          throw ApiError.internal(err.message);
        }

        if (!user) {
          throw ApiError.unauthorized(info?.message || MESSAGES.AUTH.INVALID_TOKEN);
        }

        // Check if user is active
        if (!user.isActive) {
          throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_DEACTIVATED);
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
    }
  )(req, res, next);
};

/**
 * Authorization middleware factory
 * Checks if user has required roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED));
    }

    const userRole = (req.user as any)?.role;

    if (allowedRoles.length === 0) {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return next(ApiError.forbidden(`Access denied. Required roles: ${allowedRoles.join(', ')}`));
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
  res: Response,
  next: NextFunction
): Promise<void> => {
  passport.authenticate('jwt', { session: false }, async (err: Error | null, user: any) => {
    try {
      // Errors are ignored for optional auth
      if (user && !err) {
        // Check if user is active
        if (user.isActive) {
          req.user = {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          };
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  })(req, res, next);
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
      throw ApiError.badRequest(MESSAGES.AUTH.REFRESH_TOKEN_REQUIRED);
    }

    // Token will be verified in the service layer
    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
