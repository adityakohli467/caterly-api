import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class StoreContactService implements OnModuleInit {
  private readonly logger = new Logger(StoreContactService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private notificationsService: AdminNotificationsService,
  ) { }

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id SERIAL PRIMARY KEY,
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone_number VARCHAR(100),
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'new',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.logger.log('Table contact_inquiries ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure contact_inquiries table:', error);
    }
  }

  /**
   * Submit contact form
   */
  async submitContact(data: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    email: string;
    message: string;
  }) {
    const { firstName, lastName, phoneNumber, email, message } = data;

    // Validation
    if (!firstName || !lastName || !email || !message) {
      throw new BadRequestException('First name, last name, email, and message are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Insert contact inquiry
    const insertQuery = `
      INSERT INTO contact_inquiries (
        first_name,
        last_name,
        email,
        phone_number,
        message,
        status
      ) VALUES ($1, $2, $3, $4, $5, 'new')
      RETURNING *
    `;

    const result = await this.dataSource.query(insertQuery, [
      firstName,
      lastName,
      email,
      phoneNumber || null,
      message,
    ]);

    const inquiry = result[0];

    // Send notification email to admin
    const adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') ||
      this.configService.get<string>('FROM_EMAIL') ||
      'info@caterly.com.au';
    const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';

    const logoAttachment = this.emailService.getLogoAttachment();
    const emailHtml = `
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
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; margin-top: 5px; }
    .message-box { background-color: #f9f9f9; border-left: 4px solid #E03A3E; padding: 15px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    New contact inquiry from ${firstName} ${lastName} (${email}).
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>New Contact Form Submission</h2>
    </div>
    <div class="content">
      <p>You have received a new contact form submission from the storefront:</p>
      
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; margin-top: 20px;">
        <div class="field">
          <div class="label" style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Name</div>
          <div class="value" style="font-size: 16px; font-weight: bold; color: #333;">${firstName} ${lastName}</div>
        </div>
        
        <div class="field" style="margin-top: 15px;">
          <div class="label" style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Email</div>
          <div class="value" style="font-size: 16px; color: #E03A3E; font-weight: 500;">${email}</div>
        </div>
        
        ${phoneNumber ? `
        <div class="field" style="margin-top: 15px;">
          <div class="label" style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Phone</div>
          <div class="value" style="font-size: 16px; color: #333;">${phoneNumber}</div>
        </div>
        ` : ''}
        
        <div class="field" style="margin-top: 20px;">
          <div class="label" style="font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 1px;">Message</div>
          <div class="message-box" style="background-color: #fff; border-left: 4px solid #E03A3E; padding: 15px; margin-top: 10px; font-style: italic; color: #444; border-radius: 0 4px 4px 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">${message.replaceAll('\n', '<br>')}</div>
        </div>
      </div>
      
      <p style="margin-top: 30px; color: #888; font-size: 13px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
        <strong>Inquiry ID:</strong> #${inquiry.id || inquiry.contact_inquiry_id || 'N/A'}<br>
        <strong>Submitted:</strong> ${inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : new Date().toLocaleString()}
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email notification
    try {
      await this.emailService.sendEmail({
        to: adminEmail,
        subject: `New Contact Form Submission: ${firstName} ${lastName}`,
        html: emailHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (emailError) {
      this.logger.error('Failed to send contact form email:', emailError);
    }

    // Send confirmation email to user
    const confirmationHtml = `
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
    Thank you for reaching out to ${companyName}! We have received your message.
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>Thank You for Contacting Us!</h2>
    </div>
    <div class="content">
      <p>Dear ${firstName},</p>
      <p>Thank you for reaching out to <strong>${companyName}</strong>. We have received your inquiry and our team will get back to you as soon as possible.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px dashed #ccc; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #666;">Your inquiry reference:</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #E03A3E;">#${inquiry.id || inquiry.contact_inquiry_id || 'N/A'}</p>
      </div>

      <p>We typically respond within 24-48 hours during business days.</p>
      <p>If your matter is urgent, please feel free to call our support team at <a href="tel:+61246117229" style="color: #E03A3E; text-decoration: none; font-weight: bold;">+61 246117229</a>.</p>
      <p style="margin-top: 30px;">Best regards,<br>The <strong>${companyName}</strong> Team</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await this.emailService.sendEmail({
        to: email,
        subject: `Thank you for contacting ${companyName}`,
        html: confirmationHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (emailError) {
      this.logger.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Create notification for admin users
    try {
      await this.notificationsService.createNotification({
        type: 'contact_inquiry',
        message: `New contact inquiry from ${firstName} ${lastName} (${email})`,
        contact_inquiry_id: inquiry.id || inquiry.contact_inquiry_id,
        metadata: {
          name: `${firstName} ${lastName}`,
          email,
          phone: phoneNumber,
        },
      });
    } catch (notifError) {
      this.logger.error('Failed to create contact inquiry notification', notifError);
      // Don't fail the request if notification fails
    }

    return {
      message: 'Contact form submitted successfully',
      inquiryId: inquiry.id || inquiry.contact_inquiry_id,
    };
  }
}

