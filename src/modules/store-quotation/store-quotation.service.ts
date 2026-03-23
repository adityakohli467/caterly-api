import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class StoreQuotationService implements OnModuleInit {
  private readonly logger = new Logger(StoreQuotationService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private notificationsService: AdminNotificationsService,
  ) { }

  async onModuleInit() {
    try {
      await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS quotation_inquiry (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    contact VARCHAR(100) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    delivery_date_time VARCHAR(255),
                    occasion VARCHAR(255),
                    message TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
      this.logger.log('Table quotation_inquiry ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure quotation_inquiry table:', error);
    }
  }

  /**
   * Submit a new quotation inquiry from the store side
   */
  async submitQuotationInquiry(data: {
    name: string;
    contact: string;
    email: string;
    delivery_date_time?: string;
    occasion?: string;
    message?: string;
    captcha?: string;
  }) {
    const { name, contact, email, delivery_date_time, occasion, message, captcha } = data;

    // Basic validation
    if (!name || !contact || !email) {
      throw new BadRequestException('Name, contact numbers, and email are required');
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // In a real scenario, you'd validate the captcha here.
    // For now, we accept it as part of the request.
    if (!captcha && this.configService.get('REQUIRE_CAPTCHA') === 'true') {
      throw new BadRequestException('Captcha is required');
    }

    try {
      // Insert inquiry into database
      const insertQuery = `
        INSERT INTO quotation_inquiry (
          name, 
          contact, 
          email, 
          delivery_date_time, 
          occasion, 
          message, 
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const result = await this.dataSource.query(insertQuery, [
        name,
        contact,
        email,
        delivery_date_time || null,
        occasion || null,
        message || null,
      ]);

      const inquiry = result[0];

      // Send Notification to Admin
      await this.sendAdminNotification(inquiry);

      // Send Confirmation to User
      await this.sendUserConfirmation(inquiry);

      // Create internal notification
      try {
        await this.notificationsService.createNotification({
          type: 'quotation_inquiry',
          message: `New Quotation Request from ${name} (${occasion || 'Post-event'})`,
          metadata: {
            inquiry_id: inquiry.id,
            name: name,
            email: email,
            occasion: occasion
          },
        });
      } catch (error) {
        this.logger.error('Failed to create in-app notification:', error);
      }

      return {
        success: true,
        message: 'Quotation inquiry submitted successfully',
        id: inquiry.id,
      };
    } catch (error) {
      this.logger.error('Error submitting quotation inquiry:', error);
      throw error;
    }
  }

  private async sendAdminNotification(inquiry: any) {
    const adminEmail = this.configService.get('ADMIN_EMAIL') || 'catering@caterly.com.au';
    const companyName = this.configService.get('COMPANY_NAME') || 'Caterly';

    const logoAttachment = this.emailService.getLogoAttachment();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #fff;">
        <div style="background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E;">
          ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" style="max-width: 200px; height: auto;">' : `<h1 style="margin: 0; font-size: 24px;">${companyName}</h1>`}
          <h2 style="margin: 10px 0 0 0; font-size: 20px;">New Quotation Request</h2>
        </div>
        <div style="padding: 30px; color: #333;">
          <p>You have received a new quotation inquiry from the storefront.</p>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold; width: 140px;">Name:</td><td>${inquiry.name}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Contact:</td><td>${inquiry.contact}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td>${inquiry.email}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Delivery info:</td><td>${inquiry.delivery_date_time || 'Not specified'}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Occasion:</td><td>${inquiry.occasion || 'Not specified'}</td></tr>
          </table>
          <div style="margin-top: 20px;">
            <p style="font-weight: bold; margin-bottom: 8px;">Message:</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; border-left: 4px solid #E03A3E;">
              ${(inquiry.message || 'No message provided').replace(/\n/g, '<br>')}
            </div>
          </div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${this.configService.get('ADMIN_URL') || '#'}/quotations/${inquiry.id}" 
               style="background-color: #E03A3E; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View in Admin Panel
            </a>
          </div>
        </div>
        <div style="background-color: #f8f8f8; color: #777; padding: 15px; text-align: center; font-size: 12px;">
          &copy; ${new Date().getFullYear()} ${companyName}. This is an automated notification.
        </div>
      </div>
    `;

    try {
      await this.emailService.sendEmail({
        to: adminEmail,
        subject: `New Quotation Request: ${inquiry.name} - ${inquiry.occasion || 'Inquiry'}`,
        html: html,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (error) {
      this.logger.error('Failed to send admin quotation notification:', error);
    }
  }

  private async sendUserConfirmation(inquiry: any) {
    const companyName = this.configService.get('COMPANY_NAME') || 'Caterly';
    const logoAttachment = this.emailService.getLogoAttachment();


    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #fff;">
        <div style="background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E;">
          ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" style="max-width: 200px; height: auto;">' : `<h1 style="margin: 0; font-size: 24px;">${companyName}</h1>`}
          <h2 style="margin: 10px 0 0 0; font-size: 20px;">Thank You for Your Inquiry</h2>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
          <p>Hi ${inquiry.name},</p>
          <p>We've received your request for a quotation for <strong>${inquiry.occasion || 'your upcoming event'}</strong>.</p>
          <p>Our team is currently reviewing your details and we will get back to you with a personalized quote as soon as possible.</p>
          
          <div style="background-color: #fff9f9; border: 1px dashed #E03A3E; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #E03A3E; font-weight: bold;">Your Inquiry Reference: #${inquiry.id}</p>
          </div>

          <p>If you have any urgent changes or questions, please reply to this email or call us directly.</p>
          <p>Best regards,<br>The ${companyName} Team</p>
        </div>
        <div style="background-color: #f8f8f8; color: #777; padding: 15px; text-align: center; font-size: 12px;">
           &copy; ${new Date().getFullYear()} ${companyName}.
        </div>
      </div>
    `;

    try {
      await this.emailService.sendEmail({
        to: inquiry.email,
        subject: `We've received your quotation request - ${companyName}`,
        html: html,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (error) {
      this.logger.error('Failed to send user quotation confirmation:', error);
    }
  }
}
