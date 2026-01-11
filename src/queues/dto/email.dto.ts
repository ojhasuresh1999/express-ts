// ============================================================================
// Email DTOs
// ============================================================================

/**
 * Base email options that all email DTOs share
 */
interface BaseEmailDto {
  /** Priority of the email (1 = highest) */
  priority?: number;
  /** Delay sending by this many milliseconds */
  scheduledAt?: Date;
}

/**
 * Email attachment structure
 */
export interface EmailAttachment {
  /** Base64 encoded content */
  content: string;
  /** Filename with extension */
  filename: string;
  /** MIME type */
  type: string;
  /** Content disposition */
  disposition: 'attachment' | 'inline';
  /** Content ID for inline attachments */
  contentId?: string;
}

/**
 * Standard email sending
 */
export interface SendEmailDto extends BaseEmailDto {
  /** Recipient email(s) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** Plain text content */
  text?: string;
  /** HTML content */
  html?: string;
  /** EJS template name */
  template?: string;
  /** Data for EJS template */
  templateData?: Record<string, unknown>;
  /** SendGrid dynamic template ID */
  templateId?: string;
  /** Data for SendGrid dynamic template */
  dynamicTemplateData?: Record<string, unknown>;
  /** Email attachments */
  attachments?: EmailAttachment[];
  /** Reply-to address */
  replyTo?: string;
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
}

/**
 * Bulk email sending - sends same email to multiple recipients
 */
export interface SendBulkEmailDto extends BaseEmailDto {
  /** Array of recipient emails */
  recipients: string[];
  /** Email subject */
  subject: string;
  /** HTML content */
  html?: string;
  /** Plain text content */
  text?: string;
  /** EJS template name */
  template?: string;
  /** Data for EJS template (same for all recipients) */
  templateData?: Record<string, unknown>;
  /** SendGrid dynamic template ID */
  templateId?: string;
}

/**
 * Welcome email for new users
 */
export interface SendWelcomeEmailDto extends BaseEmailDto {
  /** User's email address */
  to: string;
  /** User's display name */
  userName: string;
  /** Optional custom welcome message */
  customMessage?: string;
  /** Dashboard or app URL */
  dashboardUrl?: string;
  /** Documentation or getting started URL */
  gettingStartedUrl?: string;
}

/**
 * Password reset email
 */
export interface SendPasswordResetDto extends BaseEmailDto {
  /** User's email address */
  to: string;
  /** User's display name */
  userName: string;
  /** Password reset URL with token */
  resetUrl: string;
  /** Token expiry time in minutes */
  expiresInMinutes: number;
  /** IP address that requested the reset */
  requestedFromIp?: string;
  /** User agent that requested the reset */
  requestedFromDevice?: string;
}

/**
 * Email verification
 */
export interface SendEmailVerificationDto extends BaseEmailDto {
  /** User's email address */
  to: string;
  /** User's display name */
  userName: string;
  /** Verification URL with token */
  verificationUrl: string;
  /** Token expiry time in hours */
  expiresInHours: number;
}

/**
 * OTP via email
 */
export interface SendOtpEmailDto extends BaseEmailDto {
  /** User's email address */
  to: string;
  /** User's display name */
  userName?: string;
  /** The OTP code */
  otp: string;
  /** OTP expiry time in minutes */
  expiresInMinutes: number;
  /** Purpose of the OTP */
  purpose: 'login' | 'password_reset' | 'email_verification' | 'transaction' | 'other';
  /** Additional context for the OTP */
  context?: string;
}

/**
 * Generic transactional email
 */
export interface SendTransactionalEmailDto extends BaseEmailDto {
  /** Recipient email */
  to: string;
  /** SendGrid dynamic template ID */
  templateId: string;
  /** Dynamic template data */
  dynamicTemplateData: Record<string, unknown>;
}
