import { Worker, Job, type Processor } from 'bullmq';
import { redisService } from '../../services/redis.service';
import { emailService } from '../../services/email.service';
import logger from '../../utils/logger';
import { Queues } from '../queue.constants';
import type { JobResult } from '../queue.types';
import type {
  SendEmailDto,
  SendBulkEmailDto,
  SendWelcomeEmailDto,
  SendPasswordResetDto,
  SendEmailVerificationDto,
  SendOtpEmailDto,
  SendTransactionalEmailDto,
} from '../dto';

// Type for all email job data
type EmailJobData =
  | SendEmailDto
  | SendBulkEmailDto
  | SendWelcomeEmailDto
  | SendPasswordResetDto
  | SendEmailVerificationDto
  | SendOtpEmailDto
  | SendTransactionalEmailDto;

/**
 * Email Queue Processor
 * Handles all email-related jobs
 */
const emailProcessor: Processor<EmailJobData, JobResult> = async (job: Job<EmailJobData>) => {
  const startTime = Date.now();
  logger.info(`Processing email job: ${job.name} (ID: ${job.id})`);

  try {
    switch (job.name) {
      case 'send:email':
        return await handleSendEmail(job as Job<SendEmailDto>);

      case 'send:bulk-email':
        return await handleSendBulkEmail(job as Job<SendBulkEmailDto>);

      case 'send:welcome-email':
        return await handleSendWelcomeEmail(job as Job<SendWelcomeEmailDto>);

      case 'send:password-reset':
        return await handleSendPasswordReset(job as Job<SendPasswordResetDto>);

      case 'send:email-verification':
        return await handleSendEmailVerification(job as Job<SendEmailVerificationDto>);

      case 'send:otp-email':
        return await handleSendOtpEmail(job as Job<SendOtpEmailDto>);

      case 'send:transactional-email':
        return await handleSendTransactionalEmail(job as Job<SendTransactionalEmailDto>);

      default:
        throw new Error(`Unknown email job type: ${job.name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Email job ${job.name} failed:`, error);

    return {
      success: false,
      error: errorMessage,
      timestamp: new Date(),
      data: {
        jobId: job.id,
        duration: Date.now() - startTime,
      },
    };
  }
};

/**
 * Handle standard email sending
 */
async function handleSendEmail(job: Job<SendEmailDto>): Promise<JobResult> {
  const {
    to,
    subject,
    text,
    html,
    template,
    templateData,
    templateId,
    dynamicTemplateData,
    attachments,
  } = job.data;

  await job.updateProgress(10);

  const success = await emailService.sendEmail({
    to,
    subject,
    text,
    html,
    template,
    templateData,
    templateId,
    dynamicTemplateData,
    attachments,
  });

  await job.updateProgress(100);

  return {
    success,
    message: success
      ? `Email sent to ${Array.isArray(to) ? to.join(', ') : to}`
      : 'Failed to send email',
    timestamp: new Date(),
    data: { recipients: Array.isArray(to) ? to.length : 1 },
  };
}

/**
 * Handle bulk email sending
 */
async function handleSendBulkEmail(job: Job<SendBulkEmailDto>): Promise<JobResult> {
  const { recipients, subject, html, text, template, templateData, templateId } = job.data;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const email = recipients[i];

    try {
      const success = await emailService.sendEmail({
        to: email,
        subject,
        html,
        text,
        template,
        templateData,
        templateId,
        dynamicTemplateData: templateData,
      });

      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      logger.error(`Failed to send bulk email to ${email}:`, error);
    }

    // Update progress
    await job.updateProgress(Math.round(((i + 1) / recipients.length) * 100));
  }

  return {
    success: failCount === 0,
    message: `Sent ${successCount}/${recipients.length} emails`,
    timestamp: new Date(),
    data: { successCount, failCount, total: recipients.length },
  };
}

/**
 * Handle welcome email
 */
async function handleSendWelcomeEmail(job: Job<SendWelcomeEmailDto>): Promise<JobResult> {
  const { to, userName, customMessage, dashboardUrl, gettingStartedUrl } = job.data;

  await job.updateProgress(10);

  // Use EJS template or SendGrid template
  const success = await emailService.sendEmail({
    to,
    subject: `Welcome to our platform, ${userName}!`,
    template: 'welcome.ejs',
    templateData: {
      userName,
      customMessage,
      dashboardUrl,
      gettingStartedUrl,
    },
  });

  await job.updateProgress(100);

  return {
    success,
    message: success ? `Welcome email sent to ${to}` : 'Failed to send welcome email',
    timestamp: new Date(),
  };
}

/**
 * Handle password reset email
 */
async function handleSendPasswordReset(job: Job<SendPasswordResetDto>): Promise<JobResult> {
  const { to, userName, resetUrl, expiresInMinutes, requestedFromIp, requestedFromDevice } =
    job.data;

  await job.updateProgress(10);

  const success = await emailService.sendEmail({
    to,
    subject: 'Password Reset Request',
    template: 'password-reset.ejs',
    templateData: {
      userName,
      resetUrl,
      expiresInMinutes,
      requestedFromIp,
      requestedFromDevice,
    },
  });

  await job.updateProgress(100);

  return {
    success,
    message: success ? `Password reset email sent to ${to}` : 'Failed to send password reset email',
    timestamp: new Date(),
  };
}

/**
 * Handle email verification
 */
async function handleSendEmailVerification(job: Job<SendEmailVerificationDto>): Promise<JobResult> {
  const { to, userName, verificationUrl, expiresInHours } = job.data;

  await job.updateProgress(10);

  const success = await emailService.sendEmail({
    to,
    subject: 'Verify Your Email Address',
    template: 'email-verification.ejs',
    templateData: {
      userName,
      verificationUrl,
      expiresInHours,
    },
  });

  await job.updateProgress(100);

  return {
    success,
    message: success ? `Verification email sent to ${to}` : 'Failed to send verification email',
    timestamp: new Date(),
  };
}

/**
 * Handle OTP email
 */
async function handleSendOtpEmail(job: Job<SendOtpEmailDto>): Promise<JobResult> {
  const { to, userName, otp, expiresInMinutes, purpose, context } = job.data;

  await job.updateProgress(10);

  const purposeMap: Record<string, string> = {
    login: 'Login Verification',
    password_reset: 'Password Reset',
    email_verification: 'Email Verification',
    transaction: 'Transaction Verification',
    other: 'Verification',
  };

  const success = await emailService.sendEmail({
    to,
    subject: `Your ${purposeMap[purpose]} Code`,
    template: 'otp.ejs',
    templateData: {
      userName: userName || 'User',
      otp,
      expiresInMinutes,
      purpose: purposeMap[purpose],
      context,
    },
  });

  await job.updateProgress(100);

  return {
    success,
    message: success ? `OTP email sent to ${to}` : 'Failed to send OTP email',
    timestamp: new Date(),
  };
}

/**
 * Handle transactional email with SendGrid template
 */
async function handleSendTransactionalEmail(
  job: Job<SendTransactionalEmailDto>
): Promise<JobResult> {
  const { to, templateId, dynamicTemplateData } = job.data;

  await job.updateProgress(10);

  const success = await emailService.sendEmail({
    to,
    templateId,
    dynamicTemplateData,
  });

  await job.updateProgress(100);

  return {
    success,
    message: success ? `Transactional email sent to ${to}` : 'Failed to send transactional email',
    timestamp: new Date(),
  };
}

/**
 * Create and start the email worker
 */
export function createEmailWorker(concurrency = 5): Worker<EmailJobData, JobResult> {
  const worker = new Worker<EmailJobData, JobResult>(Queues.QUEUE__EMAIL.name, emailProcessor, {
    connection: redisService.getClient().duplicate(),
    concurrency,
    limiter: {
      max: 100,
      duration: 60000, // 100 emails per minute
    },
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info(`Email job completed: ${job.name} (ID: ${job.id})`, {
      success: result.success,
      message: result.message,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Email job failed: ${job?.name} (ID: ${job?.id})`, {
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (error) => {
    logger.error('Email worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`Email job stalled: ${jobId}`);
  });

  logger.info(`Email worker started with concurrency: ${concurrency}`);

  return worker;
}

export default createEmailWorker;
