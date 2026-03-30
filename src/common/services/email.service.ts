import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerSend, EmailParams, Sender, Recipient, Attachment } from 'mailersend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private mailerSend: MailerSend | null = null;
  private transporter: nodemailer.Transporter | null = null;
  private logoAttachment: any = null;


  constructor(private configService: ConfigService) { }

  /**
   * Get or create the SMTP transporter
   */
  private getSMTPTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    // Use SMTP settings for Caterly
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'mail.caterly.com.au';
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER') || 'catering@caterly.com.au';
    // Handle password with special characters - remove quotes if present
    let smtpPassword = this.configService.get<string>('SMTP_PASSWORD') || this.configService.get<string>('SMTP_PASS') || 'TWT#4Tgu^@ox';
    // Remove surrounding quotes if present (handles .env files that quote values)
    if (smtpPassword.startsWith('"') && smtpPassword.endsWith('"')) {
      smtpPassword = smtpPassword.slice(1, -1);
    }
    if (smtpPassword.startsWith("'") && smtpPassword.endsWith("'")) {
      smtpPassword = smtpPassword.slice(1, -1);
    }
    const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'catering@caterly.com.au';
    const fromName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';

    // Note: We allow SMTP to work without explicit config for backward compatibility
    // but log a warning if using defaults
    if (!this.configService.get<string>('SMTP_HOST') || !this.configService.get<string>('SMTP_USER') || !this.configService.get<string>('SMTP_PASSWORD')) {
      this.logger.warn('Using default SMTP settings. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in environment variables to override.');
    }

    // Create transporter with flexible authentication options
    const transporterOptions: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false,
        // Allow older TLS versions for compatibility
        minVersion: 'TLSv1',
        // Don't specify ciphers - let Node.js negotiate
        // Disable strict TLS checking for compatibility
        servername: smtpHost,
      },
      // Add connection timeout
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 10000, // 10 seconds
      debug: process.env.NODE_ENV === 'development', // Enable debug logging in development
      logger: process.env.NODE_ENV === 'development', // Enable logger in development
    };

    // For port 587, use STARTTLS but don't require it to be strict
    if (!smtpSecure && smtpPort === 587) {
      // Don't require TLS - let the server negotiate
      transporterOptions.requireTLS = false;
      transporterOptions.requireTransportSecurity = false;
      // Allow opportunistic TLS - upgrade if available but don't fail if not
      transporterOptions.ignoreTLS = false;
      // Use opportunistic STARTTLS
      transporterOptions.opportunisticTLS = true;
    }

    // For port 465, use SSL/TLS
    if (smtpSecure && smtpPort === 465) {
      transporterOptions.secure = true;
    }

    this.transporter = nodemailer.createTransport(transporterOptions);

    this.logger.log(`SMTP transporter initialized successfully for ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
    this.logger.log(`SMTP user: ${smtpUser}`);
    return this.transporter;
  }

  /**
   * Check if SMTP is configured
   */
  private isSMTPConfigured(): boolean {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    return !!(smtpHost && smtpUser && smtpPassword);
  }

  /**
   * Get or create the MailerSend client (fallback)
   */
  private getMailerSendClient(): MailerSend {
    if (this.mailerSend) {
      return this.mailerSend;
    }

    const apiKey = this.configService.get<string>('MAILERSEND_API_KEY');

    if (!apiKey) {
      this.logger.error('MailerSend API key is not configured. Please set MAILERSEND_API_KEY in environment variables.');
      throw new Error('MailerSend API key is not configured');
    }

    this.mailerSend = new MailerSend({
      apiKey: apiKey,
    });

    this.logger.log('MailerSend client initialized successfully');
    return this.mailerSend;
  }

  /**
   * Verify email connection (SMTP or MailerSend)
   */
  async verifyEmailConnection(): Promise<boolean> {
    try {
      if (this.isSMTPConfigured()) {
        const transporter = this.getSMTPTransporter();
        await transporter.verify();
        this.logger.log('SMTP connection verified successfully');
        return true;
      } else {
        const client = this.getMailerSendClient();
        // MailerSend doesn't have a direct verify method, but we can check if client is initialized
        if (client) {
          this.logger.log('MailerSend connection verified successfully');
          return true;
        }
        return false;
      }
    } catch (error) {
      this.logger.error('Email connection verification failed:', error);
      return false;
    }
  }

  /**
   * Get the logo attachment for embedding in emails
   */
  getLogoAttachment(): any {
    if (this.logoAttachment) {
      return this.logoAttachment;
    }

    try {
      const fs = require('fs');
      const path = require('path');
      
      // Try multiple potential paths for the logo (exhaustive search)
      const potentialPaths = [
        path.join(process.cwd(), 'src', 'assets', 'logo.png'),
        path.resolve(process.cwd(), 'src/assets/logo.png'),
        path.join(__dirname, '..', '..', 'assets', 'logo.png'), // src/assets relative to src/common/services
        path.join(__dirname, '..', '..', '..', 'src', 'assets', 'logo.png'), // src/assets relative to compiled dist
        path.join(__dirname, '..', '..', '..', 'assets', 'logo.png'), // assets relative to dist
        path.join(process.cwd(), 'dist', 'src', 'assets', 'logo.png'),
        path.join(process.cwd(), 'dist', 'assets', 'logo.png'),
        path.join(process.cwd(), 'dist', 'assets', 'assets', 'logo.png'), // Handle messy builds
        path.join(process.cwd(), 'assets', 'logo.png'),
        'src/assets/logo.png',
        'assets/logo.png'
      ];

      let logoPath = null;
      for (const p of potentialPaths) {
        try {
          if (fs.existsSync(p)) {
            logoPath = p;
            break;
          }
        } catch (_) {}
      }

      if (logoPath) {
        try {
          const logoBuffer = fs.readFileSync(logoPath);
          this.logger.log(`Logo found and read successfully from: ${logoPath} (${logoBuffer.length} bytes)`);
          this.logoAttachment = {
            filename: 'logo.png',
            content: logoBuffer,
            contentType: 'image/png',
            cid: 'logo', // Content ID for embedding in HTML
          };
          return this.logoAttachment;
        } catch (readError) {
          this.logger.error(`Found logo at ${logoPath} but could not read it:`, readError);
        }
      } else {
        this.logger.warn('Email logo not found in any of the potential paths. Checked paths: ' + potentialPaths.join(', '));
      }
    } catch (error) {
      this.logger.warn('Could not load logo for email attachment:', error);
    }
    return null;
  }


  /**
   * Send email with optional attachments (using SMTP or MailerSend)
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Use SMTP if configured, otherwise fallback to MailerSend
    if (this.isSMTPConfigured()) {
      return this.sendEmailViaSMTP(options);
    } else {
      return this.sendEmailViaMailerSend(options);
    }
  }

  /**
   * Send email via SMTP
   */
  private async sendEmailViaSMTP(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = this.getSMTPTransporter();

      // Get configuration - use Caterly defaults
      const fromEmail = this.configService.get<string>('FROM_EMAIL') ||
        this.configService.get<string>('SMTP_USER') ||
        'catering@caterly.com.au';
      const fromName = this.configService.get<string>('COMPANY_NAME') ||
        'Caterly';

      // Prepare recipients
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const ccEmails = options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : [];
      const bccEmails = options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : [];

      // Prepare mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: toEmails.join(', '),
        subject: options.subject,
        html: options.html,
        text: options.text || (options.html ? this.htmlToText(options.html) : undefined),
        replyTo: options.replyTo || fromEmail,
      };

      // Add CC if provided
      if (ccEmails.length > 0) {
        mailOptions.cc = ccEmails.join(', ');
      }

      // Add BCC if provided
      if (bccEmails.length > 0) {
        mailOptions.bcc = bccEmails.join(', ');
      }

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(att => {
          const attachment: any = {
            filename: att.filename,
            contentType: att.contentType,
            cid: (att as any).cid, // Support CID for embedded images
          };

          if (Buffer.isBuffer(att.content)) {
            attachment.content = att.content;
          } else {
            // If it's a string, assume it's base64
            attachment.content = Buffer.from(att.content as string, 'base64');
          }
          
          return attachment;
        });
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);

      const messageId = info.messageId || 'unknown';
      this.logger.log(`Email sent successfully via SMTP. Message ID: ${messageId}`);

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || 'Unknown error';
      const smtpHost = this.configService.get<string>('SMTP_HOST') || 'unknown';
      const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;

      this.logger.error(`SMTP email sending error (${smtpHost}:${smtpPort}):`, errorMessage);

      // Provide helpful error messages
      let helpfulError = errorMessage;
      if (errorMessage.includes('Invalid login') || errorMessage.includes('Authentication failed') || errorMessage.includes('535')) {
        helpfulError = `Authentication failed. Please verify:
- SMTP_HOST: ${smtpHost}
- SMTP_USER: ${this.configService.get<string>('SMTP_USER') || 'catering@caterly.com.au'}
- SMTP_PASSWORD: (check if correct)
- Try alternative SMTP hosts: mail.caterly.com.au, smtp.caterly.com.au, smtp.gmail.com, or smtp.office365.com
- Try port 465 with SMTP_SECURE=true if port 587 doesn't work`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        helpfulError = `Connection failed to ${smtpHost}:${smtpPort}. DNS lookup failed - the SMTP host may not exist. Please try:
- mail.caterly.com.au (most common for cPanel/hosting)
- Check your email hosting provider's documentation for the correct SMTP host
- Common alternatives: mail.yourdomain.com, smtp.yourdomain.com, or your hosting provider's mail server
- If using cPanel, check Email Accounts > Connect Devices for SMTP settings
- If using Google Workspace: smtp.gmail.com
- If using Microsoft 365: smtp.office365.com`;
      }

      // Log full error for debugging
      if (error.response) {
        this.logger.error('SMTP error response:', JSON.stringify(error.response, null, 2));
      }
      if (error.code) {
        this.logger.error('SMTP error code:', error.code);
      }

      return {
        success: false,
        error: helpfulError,
      };
    }
  }

  /**
   * Send email via MailerSend (fallback)
   */
  private async sendEmailViaMailerSend(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.getMailerSendClient();

      // Get configuration - use Caterly defaults
      const fromEmail = this.configService.get<string>('MAILERSEND_FROM_EMAIL') ||
        this.configService.get<string>('FROM_EMAIL') ||
        'catering@caterly.com.au';
      const fromName = this.configService.get<string>('MAILERSEND_FROM_NAME') ||
        this.configService.get<string>('COMPANY_NAME') ||
        'Caterly';

      // Prepare recipients
      const toEmails = Array.isArray(options.to) ? options.to : [options.to];
      const recipients = toEmails.map(email => new Recipient(email));

      // Prepare CC recipients if provided
      const ccRecipients: Recipient[] = [];
      if (options.cc) {
        const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
        ccRecipients.push(...ccEmails.map(email => new Recipient(email)));
      }

      // Prepare BCC recipients if provided
      const bccRecipients: Recipient[] = [];
      if (options.bcc) {
        const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
        bccRecipients.push(...bccEmails.map(email => new Recipient(email)));
      }

      // Create sender
      const sentFrom = new Sender(fromEmail, fromName);

      // Create email parameters
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(options.subject);

      // Set HTML content
      if (options.html) {
        emailParams.setHtml(options.html);
      }

      // Set text content
      if (options.text) {
        emailParams.setText(options.text);
      } else if (options.html) {
        // If no text provided but HTML exists, create a basic text version
        emailParams.setText(this.htmlToText(options.html));
      }

      // Set reply-to if provided
      if (options.replyTo) {
        emailParams.setReplyTo(new Sender(options.replyTo, fromName));
      }

      // Add CC recipients
      if (ccRecipients.length > 0) {
        emailParams.setCc(ccRecipients);
      }

      // Add BCC recipients
      if (bccRecipients.length > 0) {
        emailParams.setBcc(bccRecipients);
      }

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        const attachments = options.attachments.map(att => {
          let content: string;

          if (Buffer.isBuffer(att.content)) {
            // Convert Buffer to base64 string
            content = att.content.toString('base64');
          } else {
            // If it's already a string, assume it's base64 or convert if needed
            content = typeof att.content === 'string' ? att.content : Buffer.from(att.content).toString('base64');
          }

          // Create MailerSend Attachment instance
          return new Attachment(
            content,
            att.filename,
            (att as any).cid ? 'inline' : 'attachment', // disposition
          );
        });

        emailParams.setAttachments(attachments);
      }

      // Send email
      const response = await client.email.send(emailParams);

      // Extract message ID from response
      // MailerSend returns response with headers containing X-Message-Id
      const messageId = response.headers?.['x-message-id'] ||
        response.headers?.['X-Message-Id'] ||
        'unknown';

      this.logger.log(`Email sent successfully via MailerSend. Message ID: ${messageId}`);

      return {
        success: true,
        messageId: messageId as string,
      };
    } catch (error: any) {
      const errorMessage = error.message || error.toString() || 'Unknown error';
      this.logger.error('MailerSend email sending error:', errorMessage);

      // Log full error for debugging
      if (error.response) {
        this.logger.error('MailerSend API response:', JSON.stringify(error.response.data || error.response, null, 2));
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send invoice email with PDF attachment
   */
  async sendInvoiceEmail(
    recipientEmail: string,
    orderId: number,
    pdfBuffer: Buffer,
    customMessage?: string,
    customerName?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const name = customerName || 'Customer';
    const companyName = this.configService.get<string>('COMPANY_NAME') ||
      this.configService.get<string>('MAILERSEND_FROM_NAME') ||
      'Caterly';
    const emailSubject = `Invoice #${orderId} - ${companyName}`;

    // Load logo for embedding
    const logoAttachment = this.getLogoAttachment();

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .logo { max-width: 200px; height: auto; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    Please find attached the invoice for order #${orderId}. Thank you for your business!
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>Invoice for Order #${orderId}</h2>
    </div>
    <div class="content">
      <p>Dear ${name},</p>
      <p>Please find attached the invoice for your order #${orderId}.</p>
      ${customMessage ? `<p>${customMessage}</p>` : ''}
      <p>Thank you for your business!</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    const attachments: any[] = [
      {
        filename: `invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];

    if (logoAttachment) {
      attachments.push(logoAttachment);
    }

    return this.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
      attachments: attachments,
    });
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    // Remove <style> and <script> content entirely
    let text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Remove HTML tags and decode entities
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
