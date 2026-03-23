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
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>New Contact Form Submission</h2>
    </div>
    <div class="content">
      <p>You have received a new contact form submission:</p>
      
      <div class="field">
        <div class="label">Name:</div>
        <div class="value">${firstName} ${lastName}</div>
      </div>
      
      <div class="field">
        <div class="label">Email:</div>
        <div class="value">${email}</div>
      </div>
      
      ${phoneNumber ? `
      <div class="field">
        <div class="label">Phone:</div>
        <div class="value">${phoneNumber}</div>
      </div>
      ` : ''}
      
      <div class="field">
        <div class="label">Message:</div>
        <div class="message-box">${message.replaceAll('\n', '<br>')}</div>
      </div>
      
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        Inquiry ID: #${inquiry.id || inquiry.contact_inquiry_id || 'N/A'}<br>
        Submitted: ${inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : new Date().toLocaleString()}
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
        subject: `New Contact Form Submission from ${firstName} ${lastName}`,
        html: emailHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (emailError) {
      this.logger.error('Failed to send contact form email:', emailError);
      // Don't fail the request if email fails
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
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>Thank You for Contacting Us!</h2>
    </div>
    <div class="content">
      <p>Dear ${firstName},</p>
      <p>Thank you for reaching out to ${companyName}. We have received your message and will get back to you as soon as possible.</p>
      <p>Your inquiry reference: <strong>#${inquiry.id || inquiry.contact_inquiry_id || 'N/A'}</strong></p>
      <p>We typically respond within 24-48 hours during business days.</p>
      <p>If you have any urgent questions, please feel free to call us at +61 246117229.</p>
      <p>Best regards,<br>The ${companyName} Team</p>
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

