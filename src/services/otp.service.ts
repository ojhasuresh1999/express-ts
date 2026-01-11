import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { redisService } from './redis.service';
import { emailService } from './email.service';
import { queueService } from '../queues';
import config from '../config';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import {
  OtpPurpose,
  DEFAULT_OTP_CONFIG,
  type StoredOtp,
  type SendOtpResult,
  type VerifyOtpResult,
} from '../types/otp.types';

/**
 * OTP Service
 * Handles OTP generation, storage, verification, and email sending
 */
class OtpService {
  private static instance: OtpService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): OtpService {
    if (!OtpService.instance) {
      OtpService.instance = new OtpService();
    }
    return OtpService.instance;
  }

  /**
   * Generate a numeric OTP
   */
  private generateOtp(length: number = DEFAULT_OTP_CONFIG.length): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Hash OTP for secure storage
   */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Get Redis key for OTP storage
   */
  private getRedisKey(identifier: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${identifier.toLowerCase()}`;
  }

  /**
   * Get Redis key for cooldown tracking
   */
  private getCooldownKey(identifier: string, purpose: OtpPurpose): string {
    return `otp:cooldown:${purpose}:${identifier.toLowerCase()}`;
  }

  /**
   * Mask email for display (e.g., j***n@example.com)
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
  }

  /**
   * Check if cooldown period is active
   */
  private async checkCooldown(identifier: string, purpose: OtpPurpose): Promise<void> {
    const cooldownKey = this.getCooldownKey(identifier, purpose);
    const cooldownActive = await redisService.get(cooldownKey);

    if (cooldownActive) {
      throw ApiError.conflict('Please wait before requesting a new OTP');
    }
  }

  /**
   * Set cooldown after sending OTP
   */
  private async setCooldown(identifier: string, purpose: OtpPurpose): Promise<void> {
    const cooldownKey = this.getCooldownKey(identifier, purpose);
    const cooldownSeconds = config.otp?.cooldownSeconds || DEFAULT_OTP_CONFIG.cooldownSeconds;
    await redisService.set(cooldownKey, '1', cooldownSeconds);
  }

  /**
   * Send OTP to email
   */
  public async sendOtp(
    email: string,
    purpose: OtpPurpose,
    userName?: string
  ): Promise<SendOtpResult> {
    // Check cooldown
    await this.checkCooldown(email, purpose);

    // Generate OTP
    const otpLength = config.otp?.length || DEFAULT_OTP_CONFIG.length;
    const otp = this.generateOtp(otpLength);
    const hashedOtp = this.hashOtp(otp);

    // Store OTP in Redis
    const redisKey = this.getRedisKey(email, purpose);
    const ttlSeconds = config.otp?.ttlSeconds || DEFAULT_OTP_CONFIG.ttlSeconds;

    const storedOtp: StoredOtp = {
      hash: hashedOtp,
      attempts: 0,
      createdAt: Date.now(),
      purpose,
    };

    await redisService.set(redisKey, JSON.stringify(storedOtp), ttlSeconds);

    // Set cooldown
    await this.setCooldown(email, purpose);

    // Get purpose-specific subject
    const purposeSubjects: Record<OtpPurpose, string> = {
      [OtpPurpose.REGISTRATION]: 'Verify Your Email',
      [OtpPurpose.PASSWORD_RESET]: 'Password Reset Code',
      [OtpPurpose.EMAIL_VERIFICATION]: 'Email Verification Code',
      [OtpPurpose.LOGIN_VERIFICATION]: 'Login Verification Code',
    };

    // Map OtpPurpose to DTO-compatible purpose
    const purposeMapping: Record<
      OtpPurpose,
      'login' | 'password_reset' | 'email_verification' | 'transaction' | 'other'
    > = {
      [OtpPurpose.REGISTRATION]: 'other',
      [OtpPurpose.PASSWORD_RESET]: 'password_reset',
      [OtpPurpose.EMAIL_VERIFICATION]: 'email_verification',
      [OtpPurpose.LOGIN_VERIFICATION]: 'login',
    };

    // Send email via queue for better reliability
    try {
      await queueService.addJob({
        queue: 'QUEUE__EMAIL',
        job: 'SEND_OTP_EMAIL',
        data: {
          to: email,
          otp,
          expiresInMinutes: Math.floor(ttlSeconds / 60),
          purpose: purposeMapping[purpose],
          userName: userName || 'User',
        },
      });
    } catch (queueError) {
      // Fallback to direct email if queue fails
      logger.warn('Queue unavailable, sending email directly:', queueError);
      await emailService.sendEmail({
        to: email,
        subject: purposeSubjects[purpose],
        template: 'otp.ejs',
        templateData: {
          otp,
          userName: userName || 'User',
          expiresInMinutes: Math.floor(ttlSeconds / 60),
          purpose: purposeSubjects[purpose],
        },
      });
    }

    logger.info(`OTP sent to ${this.maskEmail(email)} for ${purpose}`);

    const result: SendOtpResult = {
      message: `OTP sent successfully to ${this.maskEmail(email)}`,
      expiresIn: ttlSeconds,
    };

    // Include OTP in development for testing
    if (config.env === 'development') {
      result.otp = otp;
    }

    return result;
  }

  /**
   * Verify OTP
   */
  public async verifyOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose
  ): Promise<VerifyOtpResult> {
    const redisKey = this.getRedisKey(email, purpose);
    const storedData = await redisService.get(redisKey);

    if (!storedData) {
      throw ApiError.badRequest('OTP expired or not found');
    }

    const storedOtp: StoredOtp = JSON.parse(storedData);
    const maxAttempts = config.otp?.maxAttempts || DEFAULT_OTP_CONFIG.maxAttempts;

    // Check max attempts
    if (storedOtp.attempts >= maxAttempts) {
      await redisService.del(redisKey);
      throw ApiError.forbidden('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    // Verify OTP
    const hashedInput = this.hashOtp(otp);
    if (hashedInput !== storedOtp.hash) {
      // Increment attempts
      storedOtp.attempts += 1;
      const remainingTtl = Math.max(
        0,
        (config.otp?.ttlSeconds || DEFAULT_OTP_CONFIG.ttlSeconds) -
          Math.floor((Date.now() - storedOtp.createdAt) / 1000)
      );
      await redisService.set(redisKey, JSON.stringify(storedOtp), remainingTtl);

      const remainingAttempts = maxAttempts - storedOtp.attempts;
      throw ApiError.badRequest(
        `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
      );
    }

    // OTP verified - delete from Redis
    await redisService.del(redisKey);

    // Generate verification token for password reset flow
    let verificationToken: string | undefined;
    if (purpose === OtpPurpose.PASSWORD_RESET || purpose === OtpPurpose.EMAIL_VERIFICATION) {
      verificationToken = jwt.sign(
        { email: email.toLowerCase(), purpose, verified: true },
        config.jwt.accessSecret,
        { expiresIn: '5m' }
      );
    }

    logger.info(`OTP verified for ${this.maskEmail(email)} (${purpose})`);

    return {
      message: 'OTP verified successfully',
      verificationToken,
    };
  }

  /**
   * Resend OTP (alias for sendOtp with cooldown check)
   */
  public async resendOtp(
    email: string,
    purpose: OtpPurpose,
    userName?: string
  ): Promise<SendOtpResult> {
    return this.sendOtp(email, purpose, userName);
  }
}

export const otpService = OtpService.getInstance();
export default otpService;
