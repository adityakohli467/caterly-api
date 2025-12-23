import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class StoreWholesaleEnquiryService {
  private readonly logger = new Logger(StoreWholesaleEnquiryService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private notificationsService: AdminNotificationsService,
  ) {}

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
      'info@zenn.com.au';
    const companyName = this.configService.get<string>('COMPANY_NAME') || 'St. Dreux Coffee';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 700px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .section { margin-bottom: 25px; }
    .section-title { font-weight: bold; color: #2952E6; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #2952E6; padding-bottom: 5px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #666; display: inline-block; min-width: 150px; }
    .value { color: #333; }
    .message-box { background-color: #f9f9f9; border-left: 4px solid #2952E6; padding: 15px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .priority-badge { display: inline-block; background-color: #2952E6; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Wholesale Partnership Enquiry</h1>
      <span class="priority-badge">HIGH PRIORITY</span>
    </div>
    <div class="content">
      <p>A new wholesale partnership enquiry has been submitted:</p>
      
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
          <span class="value">${email}</span>
        </div>
        ${phoneNumber ? `
        <div class="field">
          <span class="label">Phone:</span>
          <span class="value">${phoneNumber}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">2. Business Address</div>
        <div class="field">
          <span class="label">Address:</span>
          <span class="value">${businessAddress}</span>
        </div>
        <div class="field">
          <span class="label">Suburb:</span>
          <span class="value">${suburb}</span>
        </div>
        <div class="field">
          <span class="label">State:</span>
          <span class="value">${state}</span>
        </div>
        <div class="field">
          <span class="label">Postcode:</span>
          <span class="value">${postcode}</span>
        </div>
        ${businessLicense ? `
        <div class="field">
          <span class="label">Business License:</span>
          <span class="value">${businessLicense}</span>
        </div>
        ` : ''}
      </div>
      
      ${businessWebsite ? `
      <div class="section">
        <div class="section-title">3. Business Website</div>
        <div class="field">
          <span class="label">Website:</span>
          <span class="value"><a href="${businessWebsite}" target="_blank">${businessWebsite}</a></span>
        </div>
      </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">4. Expected Weekly Coffee Volume</div>
        <div class="message-box">${weeklyVolume.replaceAll('\n', '<br>')}</div>
      </div>
      
      <div class="section">
        <div class="section-title">5. Preferred Start Date</div>
        <div class="field">
          <span class="label">Start Date:</span>
          <span class="value">${startMonth} ${startYear}</span>
        </div>
      </div>
      
      <p style="margin-top: 30px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">
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
        subject: `New Wholesale Partnership Enquiry from ${businessName}`,
        html: emailHtml,
      });
    } catch (emailError) {
      this.logger.error('Failed to send wholesale enquiry email:', emailError);
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
    .header { background-color: #2952E6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Your Interest!</h1>
    </div>
    <div class="content">
      <p>Dear ${firstName},</p>
      <p>Thank you for your interest in becoming a wholesale partner with ${companyName}. We have received your enquiry and are excited about the possibility of working together.</p>
      <p><strong>Your enquiry reference:</strong> #${enquiry.id}</p>
      <p>Our team will review your submission and get back to you within 2-3 business days. We'll contact you at ${email}${phoneNumber ? ` or ${phoneNumber}` : ''}.</p>
      <p>In the meantime, if you have any urgent questions, please feel free to call us at +61 246117229.</p>
      <p>We look forward to potentially partnering with ${businessName}!</p>
      <p>Best regards,<br>The ${companyName} Wholesale Team</p>
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

