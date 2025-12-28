import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import config from '../config';

/**
 * Token payload interfaces
 */
export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  role: string;
  type: 'access';
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  sessionId: string;
  type: 'refresh';
}

/**
 * Parse duration string to milliseconds
 * Supports: 15m, 1h, 7d, etc.
 */
const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
};

/**
 * Get expiration date from duration string
 */
export const getExpirationDate = (duration: string): Date => {
  return new Date(Date.now() + parseDuration(duration));
};

/**
 * Generate access token
 */
export const generateAccessToken = async (
  userId: string,
  role: string
): Promise<string> => {
  const secret = new TextEncoder().encode(config.jwt.accessSecret);

  const token = await new SignJWT({
    userId,
    role,
    type: 'access',
  } as AccessTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.accessExpiresIn)
    .setSubject(userId)
    .sign(secret);

  return token;
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = async (
  userId: string,
  sessionId: string
): Promise<string> => {
  const secret = new TextEncoder().encode(config.jwt.refreshSecret);

  const token = await new SignJWT({
    userId,
    sessionId,
    type: 'refresh',
  } as RefreshTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.refreshExpiresIn)
    .setSubject(userId)
    .sign(secret);

  return token;
};

/**
 * Verify access token
 */
export const verifyAccessToken = async (
  token: string
): Promise<AccessTokenPayload> => {
  const secret = new TextEncoder().encode(config.jwt.accessSecret);

  const { payload } = await jwtVerify(token, secret);

  if ((payload as AccessTokenPayload).type !== 'access') {
    throw new Error('Invalid token type');
  }

  return payload as AccessTokenPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = async (
  token: string
): Promise<RefreshTokenPayload> => {
  const secret = new TextEncoder().encode(config.jwt.refreshSecret);

  const { payload } = await jwtVerify(token, secret);

  if ((payload as RefreshTokenPayload).type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload as RefreshTokenPayload;
};

/**
 * Get refresh token expiration date
 */
export const getRefreshTokenExpiration = (): Date => {
  return getExpirationDate(config.jwt.refreshExpiresIn);
};
