import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { sendSuccess, sendCreated } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { IDeviceInfo } from '../models';
import { StatusCodes } from 'http-status-codes';
import { MESSAGES } from '../constants/messages';

/**
 * Register a new user
 * POST /auth/register
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const deviceInfo = req.deviceInfo as IDeviceInfo;

    if (!deviceInfo) {
      throw ApiError.internal(MESSAGES.AUTH.DEVICE_INFO_MISSING);
    }

    const result = await authService.register({ email, password, firstName, lastName }, deviceInfo);

    sendCreated(res, result, MESSAGES.AUTH.REGISTER_SUCCESS);
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /auth/login
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    const deviceInfo = req.deviceInfo as IDeviceInfo;

    if (!deviceInfo) {
      throw ApiError.internal(MESSAGES.AUTH.DEVICE_INFO_MISSING);
    }

    const result = await authService.login({ email, password }, deviceInfo);

    sendSuccess(res, result, MESSAGES.AUTH.LOGIN_SUCCESS);
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /auth/refresh
 */
export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    const result = await authService.refreshAccessToken(refreshToken);

    sendSuccess(res, result, MESSAGES.AUTH.TOKEN_REFRESH_SUCCESS);
  } catch (error) {
    next(error);
  }
};

/**
 * Logout current session
 * POST /auth/logout
 */
export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.session?.id;

    if (sessionId) {
      await authService.logout(sessionId);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: MESSAGES.AUTH.LOGOUT_SUCCESS,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout all devices
 * POST /auth/logout-all
 */
export const logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED);
    }

    const currentSessionId = req.session?.id;
    const userId = req.user && '_id' in req.user ? (req.user as any)._id : (req.user as any)._id;
    const count = await authService.logoutAllDevices(
      userId,
      currentSessionId // Keep current session active
    );

    sendSuccess(res, { sessionsRevoked: count }, `Logged out from ${count} other device(s)`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get active sessions
 * GET /auth/sessions
 */
export const getSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED);
    }

    const userId = req.user && '_id' in req.user ? (req.user as any)._id : (req.user as any)._id;
    const sessions = await authService.getActiveSessions(userId);

    sendSuccess(res, { sessions, count: sessions.length });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke specific session
 * DELETE /auth/sessions/:sessionId
 */
export const revokeSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.NOT_AUTHENTICATED);
    }

    const { sessionId } = req.params;
    const userId = req.user && '_id' in req.user ? (req.user as any)._id : (req.user as any)._id;
    const revoked = await authService.revokeSession(userId, sessionId);

    if (!revoked) {
      throw ApiError.notFound(MESSAGES.AUTH.SESSION_NOT_FOUND);
    }

    sendSuccess(res, null, MESSAGES.AUTH.SESSION_REVOKED);
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP to email
 * POST /auth/send-otp
 */
export const sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, purpose, userName } = req.body;

    // Dynamic import to avoid circular dependency
    const { otpService } = await import('../services/otp.service');
    const result = await otpService.sendOtp(email, purpose, userName);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP
 * POST /auth/verify-otp
 */
export const verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp, purpose } = req.body;

    const { otpService } = await import('../services/otp.service');
    const result = await otpService.verifyOtp(email, otp, purpose);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Resend OTP
 * POST /auth/resend-otp
 */
export const resendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, purpose, userName } = req.body;

    const { otpService } = await import('../services/otp.service');
    const result = await otpService.resendOtp(email, purpose, userName);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password - send reset OTP
 * POST /auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    const { otpService } = await import('../services/otp.service');
    const { OtpPurpose } = await import('../types/otp.types');
    const result = await otpService.sendOtp(email, OtpPurpose.PASSWORD_RESET);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with verification token
 * POST /auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { verificationToken, newPassword } = req.body;

    // Verify the token
    const jwt = await import('jsonwebtoken');
    const config = (await import('../config')).default;

    interface ResetTokenPayload {
      email: string;
      purpose: string;
      verified: boolean;
    }

    let payload: ResetTokenPayload;
    try {
      payload = jwt.verify(verificationToken, config.jwt.accessSecret) as ResetTokenPayload;
    } catch {
      throw ApiError.badRequest('Invalid or expired verification token');
    }

    if (!payload.verified || payload.purpose !== 'PASSWORD_RESET') {
      throw ApiError.badRequest('Invalid verification token');
    }

    // Find user and update password
    const { User } = await import('../models');
    const user = await User.findOne({ email: payload.email.toLowerCase() });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Revoke all sessions for security
    await authService.logoutAllDevices(user._id.toString());

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};
