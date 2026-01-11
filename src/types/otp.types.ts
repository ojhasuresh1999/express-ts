/**
 * OTP Purpose Enum
 * Defines the different purposes for which OTP can be sent
 */
export enum OtpPurpose {
  REGISTRATION = 'REGISTRATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  LOGIN_VERIFICATION = 'LOGIN_VERIFICATION',
}

/**
 * OTP Configuration Interface
 */
export interface OtpConfig {
  /** Length of the OTP (default: 4) */
  length: number;
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttlSeconds: number;
  /** Maximum attempts before lockout */
  maxAttempts: number;
  /** Cooldown between resends in seconds */
  cooldownSeconds: number;
}

/**
 * Default OTP configuration
 */
export const DEFAULT_OTP_CONFIG: OtpConfig = {
  length: 4,
  ttlSeconds: 300, // 5 minutes
  maxAttempts: 3,
  cooldownSeconds: 60, // 1 minute
};

/**
 * OTP stored data structure in Redis
 */
export interface StoredOtp {
  /** Hashed OTP code */
  hash: string;
  /** Number of verification attempts */
  attempts: number;
  /** Timestamp when OTP was created */
  createdAt: number;
  /** Purpose of the OTP */
  purpose: OtpPurpose;
}

/**
 * Send OTP result
 */
export interface SendOtpResult {
  message: string;
  expiresIn: number;
  /** Only included in development for testing */
  otp?: string;
}

/**
 * Verify OTP result
 */
export interface VerifyOtpResult {
  message: string;
  /** JWT token for verified action (e.g., password reset) */
  verificationToken?: string;
}
