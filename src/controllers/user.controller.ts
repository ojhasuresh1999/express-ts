import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

/**
 * Get current user profile
 * GET /users/me
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED);
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * PATCH /users/me
 */
export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED);
    }

    const allowedUpdates = ['firstName', 'lastName'];
    const updates: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest(MESSAGES.USER.NO_UPDATES);
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() }, MESSAGES.USER.PROFILE_UPDATED);
  } catch (error) {
    next(error);
  }
};

/**
 * List all users (Admin only)
 * GET /users
 */
export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);

    sendSuccess(
      res,
      { users },
      undefined,
      200,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (Admin only)
 * GET /users/:id
 */
export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role (Admin only)
 * PATCH /users/:id/role
 */
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role } = req.body;

    if (!role || !Object.values(UserRole).includes(role)) {
      throw ApiError.badRequest(
        MESSAGES.USER.INVALID_ROLE.replace('{roles}', Object.values(UserRole).join(', '))
      );
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() }, MESSAGES.USER.ROLE_UPDATED);
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user (Admin only)
 * POST /users/:id/deactivate
 */
export const deactivateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() }, MESSAGES.USER.DEACTIVATED);
  } catch (error) {
    next(error);
  }
};

/**
 * Activate user (Admin only)
 * POST /users/:id/activate
 */
export const activateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );

    if (!user) {
      throw ApiError.notFound(MESSAGES.USER.NOT_FOUND);
    }

    sendSuccess(res, { user: user.toJSON() }, MESSAGES.USER.ACTIVATED);
  } catch (error) {
    next(error);
  }
};
