import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Authentication middleware template
 * Implement your authentication logic here (JWT, session, etc.)
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

    // TODO: Implement your token verification logic here
    // Example with JWT:
    // const decoded = jwt.verify(token, config.jwtSecret);
    // req.user = decoded;

    // Placeholder: Token verification would go here
    // For now, just continue to next middleware
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware factory
 * Checks if user has required roles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // TODO: Implement role-based access control
    // Example:
    // if (!req.user || !allowedRoles.includes(req.user.role)) {
    //   return next(ApiError.forbidden('Insufficient permissions'));
    // }

    // Placeholder check
    if (allowedRoles.length === 0) {
      return next();
    }

    next();
  };
};

export default authenticate;
