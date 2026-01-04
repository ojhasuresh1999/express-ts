import sgMail from '@sendgrid/mail';
import ejs from 'ejs';
import path from 'path';
import logger from '../utils/logger';

export interface SendEmailOptions {
  to: string | string[];

  // Option 1: Standard HTML/Text
  subject?: string;
  text?: string;
  html?: string;

  // Option 2: EJS Template
  template?: string; // Path to EJS file (relative to templates directory)
  templateData?: Record<string, any>;

  // Option 3: SendGrid Dynamic Template
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;

  attachments?: {
    content: string; // base64
    filename: string;
    type: string;
    disposition: string;
    contentId?: string;
  }[];
}

class EmailService {
  private static instance: EmailService;

  private constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn('SENDGRID_API_KEY not found in environment variables');
    } else {
      sgMail.setApiKey(apiKey);
    }
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Render EJS template to HTML
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    try {
      // Assuming templates are in src/templates
      const templatePath = path.join(__dirname, '../templates', templateName);
      return await ejs.renderFile(templatePath, data);
    } catch (error) {
      logger.error(`Error rendering template ${templateName}:`, error);
      throw error;
    }
  }

  public async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const from = process.env.SENDGRID_FROM_EMAIL;

    if (!from) {
      logger.error('SENDGRID_FROM_EMAIL not found in environment variables');
      return false;
    }

    try {
      const msg: any = {
        to: options.to,
        from,
        attachments: options.attachments,
      };

      // Mode 3: SendGrid Dynamic Template
      if (options.templateId) {
        msg.templateId = options.templateId;
        msg.dynamicTemplateData = options.dynamicTemplateData || {};
      }
      // Mode 2 & 1: EJS or Standard HTML
      else {
        // Handle Subject
        if (!options.subject) {
          // Subject is required for non-templateId emails
          // However, if using EJS, we might want to pass it.
          // Let's enforce subject for these modes.
          logger.error('Subject is required for standard or EJS emails');
          return false;
        }
        msg.subject = options.subject;

        // Mode 2: EJS Template
        if (options.template) {
          const html = await this.renderTemplate(options.template, options.templateData || {});
          msg.html = html;
          // Optional: Generate plain text from HTML or allow passing text
          msg.text = options.text || 'Please view this email in an HTML compatible client.';
        }
        // Mode 1: Standard HTML/Text
        else {
          if (!options.text && !options.html) {
            logger.error('Text or HTML content is required for standard emails');
            return false;
          }
          msg.text = options.text;
          msg.html = options.html || options.text;
        }
      }

      await sgMail.send(msg);

      logger.info(
        `Email sent to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`
      );
      return true;
    } catch (error) {
      logger.error('Error sending email via SendGrid', error);
      return false;
    }
  }
}

export const emailService = EmailService.getInstance();