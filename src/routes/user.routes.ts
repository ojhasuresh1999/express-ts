import { Router, type Router as RouterType } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares';
import { UserRole } from '../models';

const router: RouterType = Router();

/**
 * @route   GET /users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, userController.getMe);

/**
 * @route   PATCH /users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.patch('/me', authenticate, userController.updateMe);

/**
 * @route   GET /users
 * @desc    List all users (paginated)
 * @access  Admin only
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.listUsers
);

/**
 * @route   GET /users/:id
 * @desc    Get user by ID
 * @access  Admin only
 */
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.getUserById
);

/**
 * @route   PATCH /users/:id/role
 * @desc    Update user role
 * @access  Admin only
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.updateUserRole
);

/**
 * @route   POST /users/:id/deactivate
 * @desc    Deactivate user account
 * @access  Admin only
 */
router.post(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.deactivateUser
);

/**
 * @route   POST /users/:id/activate
 * @desc    Activate user account
 * @access  Admin only
 */
router.post(
  '/:id/activate',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.activateUser
);

export default router;
