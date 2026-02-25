import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

export interface NotificationOptions {
  templateKey: string;
  recipientEmail: string | string[];
  recipientName?: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  customSubject?: string;
  customBody?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private emailConfigCache: Map<string, string> = new Map();
  private templateCache: Map<string, any> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  /**
   * Load email configuration from database
   */
  private async loadEmailConfig(): Promise<Map<string, string>> {
    const now = Date.now();
    if (this.emailConfigCache.size > 0 && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.emailConfigCache;
    }

    try {
      const configs = await this.dataSource.query(
        `SELECT config_key, config_value FROM email_config WHERE is_active = TRUE`,
      );

      this.emailConfigCache.clear();
      configs.forEach((config: any) => {
        this.emailConfigCache.set(config.config_key, config.config_value || '');
      });

      this.lastCacheUpdate = now;
      this.logger.log(`Loaded ${this.emailConfigCache.size} email configurations`);
    } catch (error) {
      this.logger.error('Failed to load email config from database:', error);
      // Fallback to environment variables
      this.emailConfigCache.set('smtp_host', this.configService.get<string>('SMTP_HOST') || '');
      this.emailConfigCache.set('smtp_port', this.configService.get<string>('SMTP_PORT') || '587');
      this.emailConfigCache.set('smtp_user', this.configService.get<string>('SMTP_USER') || '');
      this.emailConfigCache.set('smtp_password', this.configService.get<string>('SMTP_PASSWORD') || '');
      this.emailConfigCache.set('from_email', this.configService.get<string>('FROM_EMAIL') || '');
      this.emailConfigCache.set('from_name', this.configService.get<string>('COMPANY_NAME') || 'Caterly');
    }

    return this.emailConfigCache;
  }

  /**
   * Get email template from database
   */
  private async getTemplate(templateKey: string): Promise<any> {
    // Check cache first
    if (this.templateCache.has(templateKey)) {
      return this.templateCache.get(templateKey);
    }

    try {
      const templates = await this.dataSource.query(
        `SELECT * FROM email_templates WHERE template_key = $1 AND is_active = TRUE LIMIT 1`,
        [templateKey],
      );

      if (templates.length === 0) {
        this.logger.warn(`Template not found: ${templateKey}`);
        return null;
      }

      const template = templates[0];
      this.templateCache.set(templateKey, template);
      return template;
    } catch (error) {
      this.logger.error(`Failed to load template ${templateKey}:`, error);
      return null;
    }
  }

  /**
   * Simple template variable replacement
   * Replaces {{variable}} with actual values
   */
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace {{variable}} patterns
    Object.keys(variables).forEach((key) => {
      const value = variables[key];
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    });

    // Handle conditional blocks {{#if condition}}...{{/if}}
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    result = result.replace(ifRegex, (match, condition, content) => {
      if (variables[condition]) {
        return content;
      }
      return '';
    });

    return result;
  }

  /**
   * Log email to database
   */
  private async logEmail(
    templateKey: string,
    recipientEmail: string,
    recipientName: string | undefined,
    subject: string,
    status: 'sent' | 'failed' | 'pending',
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO email_logs (
          template_key, recipient_email, recipient_name, subject, status, error_message, sent_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          templateKey,
          recipientEmail,
          recipientName || null,
          subject,
          status,
          errorMessage || null,
          status === 'sent' ? new Date() : null,
          metadata ? JSON.stringify(metadata) : null,
        ],
      );
    } catch (error) {
      this.logger.error('Failed to log email:', error);
    }
  }

  /**
   * Send notification using template
   */
  async sendNotification(options: NotificationOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const { templateKey, recipientEmail, recipientName, variables = {}, attachments, cc, bcc, customSubject, customBody } = options;

    try {
      // Load template
      const template = await this.getTemplate(templateKey);
      if (!template && !customBody) {
        throw new Error(`Template ${templateKey} not found and no custom body provided`);
      }

      // Prepare subject and body
      const subject = customSubject || (template ? this.replaceTemplateVariables(template.subject, variables) : 'Notification');
      const htmlBody = customBody || (template ? this.replaceTemplateVariables(template.body_html, variables) : '');
      const textBody = template?.body_text ? this.replaceTemplateVariables(template.body_text, variables) : undefined;

      // Get email configuration
      const emailConfig = await this.loadEmailConfig();
      const fromEmail = emailConfig.get('from_email') || this.configService.get<string>('FROM_EMAIL') || 'noreply@caterly.com.au';
      const fromName = emailConfig.get('from_name') || this.configService.get<string>('COMPANY_NAME') || 'Caterly';
      const replyTo = emailConfig.get('reply_to') || fromEmail;

      // Log email as pending
      const recipientEmails = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
      for (const email of recipientEmails) {
        await this.logEmail(templateKey, email, recipientName, subject, 'pending', undefined, variables);
      }

      // Send email
      const result = await this.emailService.sendEmail({
        to: recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
        attachments,
        cc,
        bcc,
        replyTo,
      });

      // Update log status
      if (result.success) {
        for (const email of recipientEmails) {
          await this.dataSource.query(
            `UPDATE email_logs SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE template_key = $1 AND recipient_email = $2 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
            [templateKey, email],
          );
        }
      } else {
        for (const email of recipientEmails) {
          await this.dataSource.query(
            `UPDATE email_logs SET status = 'failed', error_message = $1 WHERE template_key = $2 AND recipient_email = $3 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
            [result.error || 'Unknown error', templateKey, email],
          );
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send notification ${templateKey}:`, error);
      const recipientEmails = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
      for (const email of recipientEmails) {
        await this.logEmail(templateKey, email, recipientName, customSubject || 'Notification', 'failed', error.message, variables);
      }
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Clear template cache (useful after template updates)
   */
  clearTemplateCache(templateKey?: string): void {
    if (templateKey) {
      this.templateCache.delete(templateKey);
    } else {
      this.templateCache.clear();
    }
    this.logger.log(`Template cache cleared${templateKey ? ` for ${templateKey}` : ''}`);
  }

  /**
   * Clear email config cache
   */
  clearConfigCache(): void {
    this.emailConfigCache.clear();
    this.lastCacheUpdate = 0;
    this.logger.log('Email config cache cleared');
  }
}

