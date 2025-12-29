import crypto from 'crypto';
import { User, Session, IUser, IDeviceInfo } from '../models';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiration,
} from './token.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { MESSAGES } from '../constants/messages';

/**
 * Authentication result interface
 */
export interface AuthResult {
  user: Partial<IUser>;
  accessToken: string;
  refreshToken: string;
  session: {
    id: string;
    deviceInfo: IDeviceInfo;
    expiresAt: Date;
  };
}

/**
 * Register input interface
 */
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Login input interface
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Hash refresh token for secure storage
 */
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Register a new user
 */
export const register = async (
  input: RegisterInput,
  deviceInfo: IDeviceInfo
): Promise<AuthResult> => {
  // Check if user already exists
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict(MESSAGES.AUTH.EMAIL_EXISTS);
  }

  // Create user
  const user = await User.create({
    email: input.email.toLowerCase(),
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
  });

  // Generate tokens
  const accessToken = await generateAccessToken(user._id.toString(), user.role);
  const refreshToken = await generateRefreshToken(user._id.toString(), '');

  // Create session
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    deviceInfo,
    expiresAt: getRefreshTokenExpiration(),
  });

  // Update refresh token with session ID
  const finalRefreshToken = await generateRefreshToken(
    user._id.toString(),
    session._id.toString()
  );

  // Update session with correct token hash
  session.refreshTokenHash = hashToken(finalRefreshToken);
  await session.save();

  logger.info(`User registered: ${user.email}`);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken: finalRefreshToken,
    session: {
      id: session._id.toString(),
      deviceInfo: session.deviceInfo,
      expiresAt: session.expiresAt,
    },
  };
};

/**
 * Login user
 */
export const login = async (
  input: LoginInput,
  deviceInfo: IDeviceInfo
): Promise<AuthResult> => {
 
    const user = await User.findOne({ email: input.email.toLowerCase() }).select(
      '+password'
    );
  
    if (!user) {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
  
    if (!user.isActive) {
      throw ApiError.forbidden(MESSAGES.AUTH.ACCOUNT_DEACTIVATED);
    }
  
    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_CREDENTIALS);
    }
  
    const accessToken = await generateAccessToken(user._id.toString(), user.role);
  
    const session = await Session.create({
      userId: user._id,
      refreshTokenHash: "",
      deviceInfo,
      expiresAt: getRefreshTokenExpiration(),
    });
  
    const refreshToken = await generateRefreshToken(
      user._id.toString(),
      session._id.toString()
    );
  
    session.refreshTokenHash = hashToken(refreshToken);
    await session.save();
  
    user.lastLoginAt = new Date();
    await user.save();
  
    logger.info(`User logged in: ${user.email} from ${deviceInfo.deviceName}`);
  
    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
      session: {
        id: session._id.toString(),
        deviceInfo: session.deviceInfo,
        expiresAt: session.expiresAt,
      },
    };
 
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> => {
  // Verify refresh token
  const payload = await verifyRefreshToken(refreshToken);
  const { userId, sessionId } = payload;

  // Find session
  const session = await Session.findById(sessionId);
  if (!session || session.isRevoked) {
    throw ApiError.unauthorized(MESSAGES.AUTH.INVALID_SESSION);
  }

  // Verify token hash
  const tokenHash = hashToken(refreshToken);
  if (session.refreshTokenHash !== tokenHash) {
    // Token reuse detected - revoke all sessions for security
    await Session.updateMany({ userId }, { isRevoked: true });
    logger.warn(`Token reuse detected for user: ${userId}`);
    throw ApiError.unauthorized(MESSAGES.AUTH.TOKEN_REUSE);
  }

  // Check if session expired
  if (session.expiresAt < new Date()) {
    session.isRevoked = true;
    await session.save();
    throw ApiError.unauthorized(MESSAGES.AUTH.SESSION_EXPIRED);
  }

  // Get user
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized(MESSAGES.AUTH.USER_INACTIVE);
  }

  // Generate new tokens (token rotation)
  const newAccessToken = await generateAccessToken(user._id.toString(), user.role);
  const newRefreshToken = await generateRefreshToken(
    user._id.toString(),
    session._id.toString()
  );

  // Update session with new token hash
  session.refreshTokenHash = hashToken(newRefreshToken);
  session.lastActivityAt = new Date();
  await session.save();

  logger.debug(`Token refreshed for user: ${user.email}`);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logout current session
 */
export const logout = async (sessionId: string): Promise<void> => {
  const session = await Session.findById(sessionId);
  if (session) {
    session.isRevoked = true;
    await session.save();
    logger.info(`Session logged out: ${sessionId}`);
  }
};

/**
 * Logout all sessions for user
 */
export const logoutAllDevices = async (
  userId: string,
  exceptSessionId?: string
): Promise<number> => {
  const query: Record<string, unknown> = { userId, isRevoked: false };

  if (exceptSessionId) {
    query._id = { $ne: exceptSessionId };
  }

  const result = await Session.updateMany(query, { isRevoked: true });
  logger.info(`All sessions logged out for user: ${userId}`);

  return result.modifiedCount;
};

/**
 * Get all active sessions for user
 */
export const getActiveSessions = async (userId: string) => {
  const sessions = await Session.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActivityAt: -1 });

  return sessions.map((session) => ({
    id: session._id.toString(),
    deviceInfo: session.deviceInfo,
    lastActivityAt: session.lastActivityAt,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }));
};

/**
 * Revoke specific session
 */
export const revokeSession = async (
  userId: string,
  sessionId: string
): Promise<boolean> => {
  const result = await Session.updateOne(
    { _id: sessionId, userId },
    { isRevoked: true }
  );

  return result.modifiedCount > 0;
};
