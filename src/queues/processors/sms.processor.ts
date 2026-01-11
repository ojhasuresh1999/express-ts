import { Worker, Job, type Processor } from 'bullmq';
import { redisService } from '../../services/redis.service';
import logger from '../../utils/logger';
import { Queues } from '../queue.constants';
import type { JobResult } from '../queue.types';
import type { SendSmsDto, SendBulkSmsDto, SendOtpDto, SendTemplatedSmsDto } from '../dto';

// Type for all SMS job data
type SmsJobData = SendSmsDto | SendBulkSmsDto | SendOtpDto | SendTemplatedSmsDto;

/**
 * SMS Provider Interface
 * Implement this interface to add SMS providers like Twilio, Nexmo, etc.
 */
export interface SmsProvider {
  name: string;
  sendSms(to: string, message: string, from?: string): Promise<boolean>;
  sendBulkSms?(
    recipients: string[],
    message: string,
    from?: string
  ): Promise<{ success: number; failed: number }>;
}

/**
 * Default SMS Provider (placeholder)
 * Replace with actual provider implementation (e.g., Twilio, Vonage, MessageBird)
 */
class DefaultSmsProvider implements SmsProvider {
  name = 'default';

  async sendSms(to: string, message: string, _from?: string): Promise<boolean> {
    // TODO: Implement actual SMS sending logic
    // Example with Twilio:
    // const client = require('twilio')(accountSid, authToken);
    // const result = await client.messages.create({ body: message, to, from: _from });
    // return !!result.sid;

    logger.info(`[SMS Placeholder] Would send to ${to}: ${message.substring(0, 50)}...`);

    // Return true in development for testing
    return process.env.NODE_ENV === 'development';
  }

  async sendBulkSms(
    recipients: string[],
    message: string,
    from?: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const result = await this.sendSms(recipient, message, from);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }
}

// SMS provider registry
const smsProviders: Map<string, SmsProvider> = new Map([['default', new DefaultSmsProvider()]]);

/**
 * Register an SMS provider
 */
export function registerSmsProvider(provider: SmsProvider): void {
  smsProviders.set(provider.name, provider);
  logger.info(`SMS provider registered: ${provider.name}`);
}

/**
 * Get SMS provider by name
 */
function getSmsProvider(name: string = 'default'): SmsProvider {
  const provider = smsProviders.get(name);
  if (!provider) {
    logger.warn(`SMS provider ${name} not found, using default`);
    return smsProviders.get('default')!;
  }
  return provider;
}

/**
 * SMS Queue Processor
 * Handles all SMS-related jobs
 */
const smsProcessor: Processor<SmsJobData, JobResult> = async (job: Job<SmsJobData>) => {
  const startTime = Date.now();
  logger.info(`Processing SMS job: ${job.name} (ID: ${job.id})`);

  try {
    switch (job.name) {
      case 'send:sms':
        return await handleSendSms(job as Job<SendSmsDto>);

      case 'send:bulk-sms':
        return await handleSendBulkSms(job as Job<SendBulkSmsDto>);

      case 'send:otp':
        return await handleSendOtp(job as Job<SendOtpDto>);

      case 'send:templated-sms':
        return await handleSendTemplatedSms(job as Job<SendTemplatedSmsDto>);

      default:
        throw new Error(`Unknown SMS job type: ${job.name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`SMS job ${job.name} failed:`, error);

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
 * Handle standard SMS sending
 */
async function handleSendSms(job: Job<SendSmsDto>): Promise<JobResult> {
  const { to, message, from, provider: providerName } = job.data;

  await job.updateProgress(10);

  const provider = getSmsProvider(providerName);
  const success = await provider.sendSms(to, message, from);

  await job.updateProgress(100);

  return {
    success,
    message: success ? `SMS sent to ${to}` : 'Failed to send SMS',
    timestamp: new Date(),
    data: { provider: provider.name },
  };
}

/**
 * Handle bulk SMS sending
 */
async function handleSendBulkSms(job: Job<SendBulkSmsDto>): Promise<JobResult> {
  const { recipients, message, from, provider: providerName } = job.data;

  const provider = getSmsProvider(providerName);

  if (provider.sendBulkSms) {
    await job.updateProgress(10);
    const result = await provider.sendBulkSms(recipients, message, from);
    await job.updateProgress(100);

    return {
      success: result.failed === 0,
      message: `Sent ${result.success}/${recipients.length} SMS`,
      timestamp: new Date(),
      data: { ...result, total: recipients.length },
    };
  }

  // Fallback to individual sending
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const success = await provider.sendSms(recipients[i], message, from);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    await job.updateProgress(Math.round(((i + 1) / recipients.length) * 100));
  }

  return {
    success: failCount === 0,
    message: `Sent ${successCount}/${recipients.length} SMS`,
    timestamp: new Date(),
    data: { successCount, failCount, total: recipients.length },
  };
}

/**
 * Handle OTP SMS sending
 */
async function handleSendOtp(job: Job<SendOtpDto>): Promise<JobResult> {
  const { to, otp, expiresInMinutes, purpose, customTemplate, provider: providerName } = job.data;

  await job.updateProgress(10);

  const purposeMap: Record<string, string> = {
    login: 'login',
    password_reset: 'password reset',
    phone_verification: 'phone verification',
    transaction: 'transaction',
    other: 'verification',
  };

  let message: string;
  if (customTemplate) {
    message = customTemplate.replace('{{otp}}', otp);
  } else {
    message = `Your ${purposeMap[purpose]} code is: ${otp}. This code expires in ${expiresInMinutes} minute(s). Do not share this code with anyone.`;
  }

  const provider = getSmsProvider(providerName);
  const success = await provider.sendSms(to, message);

  await job.updateProgress(100);

  return {
    success,
    message: success ? `OTP SMS sent to ${to}` : 'Failed to send OTP SMS',
    timestamp: new Date(),
    data: { purpose, expiresInMinutes },
  };
}

/**
 * Handle templated SMS sending
 */
async function handleSendTemplatedSms(job: Job<SendTemplatedSmsDto>): Promise<JobResult> {
  const { to, templateId, variables, provider: providerName } = job.data;

  await job.updateProgress(10);

  // TODO: Implement template fetching and variable substitution
  // Templates could be stored in database or provider-specific
  logger.info(
    `[SMS Template] Would send template ${templateId} to ${to} with variables:`,
    variables
  );

  const provider = getSmsProvider(providerName);

  // Placeholder: In production, fetch template and substitute variables
  const message = `[Template: ${templateId}] Variables: ${JSON.stringify(variables)}`;
  const success = await provider.sendSms(to, message);

  await job.updateProgress(100);

  return {
    success,
    message: success ? `Templated SMS sent to ${to}` : 'Failed to send templated SMS',
    timestamp: new Date(),
    data: { templateId },
  };
}

/**
 * Create and start the SMS worker
 */
export function createSmsWorker(concurrency = 3): Worker<SmsJobData, JobResult> {
  const worker = new Worker<SmsJobData, JobResult>(Queues.QUEUE__SMS.name, smsProcessor, {
    connection: redisService.getClient().duplicate(),
    concurrency,
    limiter: {
      max: 50,
      duration: 60000, // 50 SMS per minute (adjust based on provider limits)
    },
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info(`SMS job completed: ${job.name} (ID: ${job.id})`, {
      success: result.success,
      message: result.message,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error(`SMS job failed: ${job?.name} (ID: ${job?.id})`, {
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (error) => {
    logger.error('SMS worker error:', error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`SMS job stalled: ${jobId}`);
  });

  logger.info(`SMS worker started with concurrency: ${concurrency}`);

  return worker;
}

export default createSmsWorker;
