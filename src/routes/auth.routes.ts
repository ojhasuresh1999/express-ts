import { Router, type Router as RouterType } from 'express';
import * as authController from '../controllers/auth.controller';
import { extractDeviceInfo, validate, authenticate } from '../middlewares';
import {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
} from '../validators/auth.validators';

const router: RouterType = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  extractDeviceInfo,
  registerValidator,
  validate,
  authController.register
);

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  extractDeviceInfo,
  loginValidator,
  validate,
  authController.login
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public (with valid refresh token)
 */
router.post(
  '/refresh',
  refreshTokenValidator,
  validate,
  authController.refresh
);

/**
 * @route   POST /auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /auth/logout-all
 * @desc    Logout all devices except current
 * @access  Private
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * @route   GET /auth/sessions
 * @desc    Get all active sessions
 * @access  Private
 */
router.get('/sessions', authenticate, authController.getSessions);

/**
 * @route   DELETE /auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

export default router;
