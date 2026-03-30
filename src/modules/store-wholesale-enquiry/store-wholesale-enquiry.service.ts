import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class StoreWholesaleEnquiryService implements OnModuleInit {
  private readonly logger = new Logger(StoreWholesaleEnquiryService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private notificationsService: AdminNotificationsService,
  ) { }

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS wholesale_enquiries (
          id SERIAL PRIMARY KEY,
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          business_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone_number VARCHAR(100),
          business_address TEXT NOT NULL,
          suburb VARCHAR(255) NOT NULL,
          state VARCHAR(100) NOT NULL,
          postcode VARCHAR(20) NOT NULL,
          business_license VARCHAR(255),
          business_website VARCHAR(255),
          weekly_volume TEXT NOT NULL,
          start_month VARCHAR(50) NOT NULL,
          start_year VARCHAR(10) NOT NULL,
          status VARCHAR(50) DEFAULT 'new',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.logger.log('Table wholesale_enquiries ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure wholesale_enquiries table:', error);
    }
  }

  /**
   * Submit wholesale enquiry form
   */
  async submitEnquiry(data: {
    firstName: string;
    lastName: string;
    businessName: string;
    email: string;
    phoneNumber?: string;
    businessAddress: string;
    suburb: string;
    state: string;
    postcode: string;
    businessLicense?: string;
    businessWebsite?: string;
    weeklyVolume: string;
    startMonth: string;
    startYear: string;
  }) {
    const {
      firstName,
      lastName,
      businessName,
      email,
      phoneNumber,
      businessAddress,
      suburb,
      state,
      postcode,
      businessLicense,
      businessWebsite,
      weeklyVolume,
      startMonth,
      startYear,
    } = data;

    // Validation
    if (
      !firstName ||
      !lastName ||
      !businessName ||
      !email ||
      !businessAddress ||
      !suburb ||
      !state ||
      !postcode ||
      !weeklyVolume ||
      !startMonth ||
      !startYear
    ) {
      throw new BadRequestException('All required fields must be provided');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Insert wholesale enquiry
    const insertQuery = `
      INSERT INTO wholesale_enquiries (
        first_name,
        last_name,
        business_name,
        email,
        phone_number,
        business_address,
        suburb,
        state,
        postcode,
        business_license,
        business_website,
        weekly_volume,
        start_month,
        start_year,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'new')
      RETURNING *
    `;

    const result = await this.dataSource.query(insertQuery, [
      firstName,
      lastName,
      businessName,
      email,
      phoneNumber || null,
      businessAddress,
      suburb,
      state,
      postcode,
      businessLicense || null,
      businessWebsite || null,
      weeklyVolume,
      startMonth,
      startYear,
    ]);

    const enquiry = result[0];

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
    .container { max-width: 700px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .content { padding: 20px; }
    .section { margin-bottom: 25px; }
    .section-title { font-weight: bold; color: #E03A3E; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #E03A3E; padding-bottom: 5px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #666; display: inline-block; min-width: 150px; }
    .value { color: #333; }
    .message-box { background-color: #f9f9f9; border-left: 4px solid #E03A3E; padding: 15px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .priority-badge { display: inline-block; background-color: #E03A3E; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    New wholesale enquiry from ${businessName} (${firstName} ${lastName}).
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" style="max-width: 200px; height: auto;">' : `<h1>${companyName}</h1>`}
      <h2>Wholesale Partnership Enquiry</h2>
      <span class="priority-badge">NEW OPPORTUNITY</span>
    </div>
    <div class="content">
      <p>A new wholesale partnership enquiry has been submitted through the storefront:</p>
      
      <div class="section">
        <div class="section-title">1. Contact Information</div>
        <div class="field">
          <span class="label">Name:</span>
          <span class="value">${firstName} ${lastName}</span>
        </div>
        <div class="field">
          <span class="label">Business Name:</span>
          <span class="value">${businessName}</span>
        </div>
        <div class="field">
          <span class="label">Email:</span>
          <span class="value" style="color: #E03A3E;">${email}</span>
        </div>
        ${phoneNumber ? `
        <div class="field">
          <span class="label">Phone:</span>
          <span class="value">${phoneNumber}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">2. Business Details</div>
        <div class="field">
          <span class="label">Address:</span>
          <span class="value">${businessAddress}, ${suburb}, ${state} ${postcode}</span>
        </div>
        ${businessLicense ? `
        <div class="field">
          <span class="label">Business License:</span>
          <span class="value">${businessLicense}</span>
        </div>
        ` : ''}
        ${businessWebsite ? `
        <div class="field">
          <span class="label">Website:</span>
          <span class="value"><a href="${businessWebsite}" target="_blank" style="color: #E03A3E;">${businessWebsite}</a></span>
        </div>
        ` : ''}
      </div>
      
      <div class="section" style="background-color: #fff9f9; padding: 15px; border-radius: 8px; border: 1px solid #fee;">
        <div class="section-title" style="border-bottom-color: #ffcccc;">3. Partnership Details</div>
        <div class="field">
          <span class="label">Weekly Volume:</span>
          <div class="message-box">${weeklyVolume.replaceAll('\n', '<br>')}</div>
        </div>
        <div class="field" style="margin-top: 15px;">
          <span class="label">Expected Start:</span>
          <span class="value" style="font-weight: bold;">${startMonth} ${startYear}</span>
        </div>
      </div>
      
      <p style="margin-top: 30px; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
        <strong>Enquiry ID:</strong> #${enquiry.id}<br>
        <strong>Submitted:</strong> ${new Date(enquiry.created_at).toLocaleString()}
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
        subject: `New Wholesale Enquiry: ${businessName}`,
        html: emailHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (emailError) {
      this.logger.error('Failed to send wholesale enquiry email:', emailError);
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
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    Thank you for your wholesale enquiry! Our team will review your application.
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" style="max-width: 200px; height: auto;">' : `<h1>${companyName}</h1>`}
      <h2>Thank You for Your Interest!</h2>
    </div>
    <div class="content">
      <p>Dear ${firstName},</p>
      <p>Thank you for your interest in becoming a wholesale partner with <strong>${companyName}</strong>. We have received your enquiry and our wholesale team is excited about the possibility of working together.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px dashed #ccc; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #666;">Your enquiry reference:</p>
        <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #E03A3E;">#${enquiry.id}</p>
      </div>

      <p>Our team will review your submission and get back to you within 2-3 business days. We'll contact you at ${email}${phoneNumber ? ` or ${phoneNumber}` : ''}.</p>
      <p>In the meantime, if you have any urgent questions, please feel free to call us at <a href="tel:+61246117229" style="color: #E03A3E; text-decoration: none; font-weight: bold;">+61 246117229</a>.</p>
      <p>We look forward to potentially partnering with <strong>${businessName}</strong>!</p>
      <p style="margin-top: 30px;">Best regards,<br>The <strong>${companyName}</strong> Wholesale Team</p>
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
        subject: `Thank you for your wholesale partnership enquiry - ${companyName}`,
        html: confirmationHtml,
      });
    } catch (emailError) {
      this.logger.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Create notification for admin users
    try {
      await this.notificationsService.createNotification({
        type: 'wholesale_enquiry',
        message: `New wholesale enquiry from ${businessName} (${firstName} ${lastName})`,
        wholesale_enquiry_id: enquiry.id,
        metadata: {
          business_name: businessName,
          contact_name: `${firstName} ${lastName}`,
          email,
          phone: phoneNumber,
        },
      });
    } catch (notifError) {
      this.logger.error('Failed to create wholesale enquiry notification', notifError);
      // Don't fail the request if notification fails
    }

    return {
      message: 'Wholesale enquiry submitted successfully',
      enquiryId: enquiry.id,
    };
  }
}

