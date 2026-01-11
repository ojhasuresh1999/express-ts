// ============================================================================
// SMS DTOs
// ============================================================================

/**
 * Base SMS options
 */
interface BaseSmsDto {
  /** Priority of the SMS (1 = highest) */
  priority?: number;
}

/**
 * Standard SMS sending
 */
export interface SendSmsDto extends BaseSmsDto {
  /** Recipient phone number (E.164 format recommended, e.g., +1234567890) */
  to: string;
  /** SMS message content */
  message: string;
  /** Sender ID or phone number (if supported by provider) */
  from?: string;
  /** SMS provider to use (for multi-provider setup) */
  provider?: 'twilio' | 'nexmo' | 'messagebird' | 'default';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bulk SMS sending
 */
export interface SendBulkSmsDto extends BaseSmsDto {
  /** Array of recipient phone numbers */
  recipients: string[];
  /** SMS message content */
  message: string;
  /** Sender ID or phone number */
  from?: string;
  /** SMS provider to use */
  provider?: 'twilio' | 'nexmo' | 'messagebird' | 'default';
}

/**
 * OTP via SMS
 */
export interface SendOtpDto extends BaseSmsDto {
  /** Recipient phone number */
  to: string;
  /** The OTP code */
  otp: string;
  /** OTP expiry time in minutes */
  expiresInMinutes: number;
  /** Purpose of the OTP */
  purpose: 'login' | 'password_reset' | 'phone_verification' | 'transaction' | 'other';
  /** Custom message template (use {{otp}} placeholder) */
  customTemplate?: string;
  /** SMS provider to use */
  provider?: 'twilio' | 'nexmo' | 'messagebird' | 'default';
}

/**
 * Transactional SMS with template
 */
export interface SendTemplatedSmsDto extends BaseSmsDto {
  /** Recipient phone number */
  to: string;
  /** Template ID (provider-specific) */
  templateId: string;
  /** Template variables */
  variables: Record<string, string>;
  /** SMS provider to use */
  provider?: 'twilio' | 'nexmo' | 'messagebird' | 'default';
}
