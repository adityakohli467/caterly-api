import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StoreNewsletterService implements OnModuleInit {
  private readonly logger = new Logger(StoreNewsletterService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
          subscription_id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          status VARCHAR(50) DEFAULT 'active',
          source VARCHAR(100),
          ip_address VARCHAR(100),
          user_agent TEXT,
          subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          unsubscribed_at TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.logger.log('Table newsletter_subscriptions ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure newsletter_subscriptions table:', error);
    }
  }

  /**
   * Subscribe to newsletter
   */
  async subscribe(data: { email: string }, ipAddress?: string, userAgent?: string) {
    const { email } = data;

    // Validation
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Check if email already exists
    const checkQuery = `
      SELECT subscription_id, status 
      FROM newsletter_subscriptions 
      WHERE email = $1
    `;
    const checkResult = await this.dataSource.query(checkQuery, [email.toLowerCase().trim()]);

    if (checkResult.length > 0) {
      const existing = checkResult[0];

      // If already subscribed and active, return success
      if (existing.status === 'active') {
        return {
          message: 'You are already subscribed to our newsletter',
          subscribed: true,
        };
      }

      // If unsubscribed, reactivate
      if (existing.status === 'unsubscribed') {
        const updateQuery = `
          UPDATE newsletter_subscriptions
          SET status = 'active',
              subscribed_at = CURRENT_TIMESTAMP,
              unsubscribed_at = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE subscription_id = $1
          RETURNING *
        `;
        await this.dataSource.query(updateQuery, [existing.subscription_id]);

        // Send welcome back email
        await this.sendWelcomeEmail(email);

        return {
          message: 'Successfully resubscribed to our newsletter',
          subscribed: true,
        };
      }
    }

    // Insert new subscription
    const insertQuery = `
      INSERT INTO newsletter_subscriptions (
        email,
        status,
        source,
        ip_address,
        user_agent
      ) VALUES ($1, 'active', 'website', $2, $3)
      RETURNING *
    `;

    try {
      const result = await this.dataSource.query(insertQuery, [
        email.toLowerCase().trim(),
        ipAddress || null,
        userAgent || null,
      ]);

      // Send welcome email
      await this.sendWelcomeEmail(email);

      // Send notification email to admin
      await this.sendAdminNotification(email);

      return {
        message: 'Successfully subscribed to our newsletter',
        subscribed: true,
      };
    } catch (error: any) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        return {
          message: 'You are already subscribed to our newsletter',
          subscribed: true,
        };
      }
      throw error;
    }
  }

  /**
   * Send welcome email to subscriber
   */
  private async sendWelcomeEmail(email: string): Promise<void> {
    try {
      const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
      const frontendUrl = this.configService.get<string>('STORE_PORTAL_URL') ||
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3006';

      const logoAttachment = this.emailService.getLogoAttachment();

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .logo { max-width: 200px; height: auto; }
    .content { padding: 20px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .cta-button { display: inline-block; padding: 12px 24px; background-color: #E03A3E; color: white !important; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">Welcome to ${companyName} Newsletter! Thank you for subscribing.</div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Welcome to ${companyName}, and thank you for subscribing.</p>
      <p>We're excited to have you join our community where food meets experience. At ${companyName}, we believe every gathering deserves to feel special, whether it's a corporate meeting, a celebration, or a simple morning catch-up.</p>
      <p>As a subscriber, you'll be the first to discover our latest catering menus, seasonal creations, exclusive offers, and event inspiration designed to make hosting effortless and memorable.</p>
      <p>From beautifully curated All day packages to premium breakfast, lunch, and canapé selections, everything we create is crafted with fresh ingredients and attention to detail, ensuring excellence every time.</p>
      <p>If you're planning an upcoming event or simply exploring options, we'd love to be part of your experience.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${frontendUrl}" class="cta-button">Explore Our Menus</a>
      </div>
      <p>Stay inspired,<br><strong>The ${companyName} Team</strong></p>
    </div>
    <div class="footer">
      <p>${companyName}</p>
      <p>If you did not subscribe to this newsletter, please ignore this email.</p>
      <p><a href="${frontendUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #666;">Unsubscribe</a></p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;

      await this.emailService.sendEmail({
        to: email,
        subject: `Welcome to ${companyName} Newsletter!`,
        html: emailHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (error) {
      this.logger.error('Failed to send welcome email:', error);
      // Don't throw - subscription should still succeed even if email fails
    }
  }

  /**
   * Send notification email to admin
   */
  private async sendAdminNotification(email: string): Promise<void> {
    try {
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
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .logo { max-width: 200px; height: auto; }
    .content { padding: 20px; }
    .order-details { background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .order-info { margin: 10px 0; }
    .order-info strong { display: inline-block; width: 150px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">New Newsletter Subscription: ${email}</div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h2>${companyName}</h2>`}
      <h2>New Newsletter Subscription</h2>
    </div>
    <div class="content">
      <p>A new subscriber has joined the ${companyName} newsletter:</p>
      <div class="order-details">
        <div class="order-info"><strong>Email:</strong> ${email}</div>
        <div class="order-info"><strong>Subscribed At:</strong> ${new Date().toLocaleString()}</div>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;

      await this.emailService.sendEmail({
        to: adminEmail,
        subject: `New Newsletter Subscription: ${email}`,
        html: emailHtml,
        attachments: logoAttachment ? [logoAttachment] : [],
      });
    } catch (error) {
      this.logger.error('Failed to send admin notification:', error);
      // Don't throw - subscription should still succeed even if notification fails
    }
  }

  /**
   * Get all subscriptions (for admin)
   */
  async findAll(query: { limit?: number; offset?: number; status?: string; search?: string } = {}) {
    const { limit = 20, offset = 0, status, search } = query;

    const params: any[] = [];
    let paramIndex = 1;

    let sql = `
      SELECT 
        subscription_id as id,
        email,
        status,
        source,
        subscribed_at as "subscribedAt",
        unsubscribed_at as "unsubscribedAt"
      FROM newsletter_subscriptions
      WHERE 1=1
    `;

    if (status) {
      if (status !== 'all') {
        sql += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
    }

    if (search) {
      sql += ` AND email ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM (${sql}) as count_query`;
    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0].count);

    sql += ` ORDER BY subscribed_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit.toString()), parseInt(offset.toString()));

    const results = await this.dataSource.query(sql, params);

    return {
      data: results,
      total,
      limit,
      offset,
    };
  }

  /**
   * Unsubscribe by ID
   */
  async unsubscribe(id: number) {
    const sql = `
      UPDATE newsletter_subscriptions
      SET status = 'unsubscribed',
          unsubscribed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(sql, [id]);

    if (result.length === 0) {
      throw new BadRequestException('Subscription not found');
    }

    return {
      message: 'Unsubscribed successfully',
      data: result[0],
    };
  }

  /**
   * Delete subscription
   */
  async delete(id: number) {
    const sql = `DELETE FROM newsletter_subscriptions WHERE subscription_id = $1 RETURNING *`;
    const result = await this.dataSource.query(sql, [id]);

    if (result.length === 0) {
      throw new BadRequestException('Subscription not found');
    }

    return {
      message: 'Subscription deleted successfully',
    };
  }

  /**
   * Get subscription statistics
   */
  async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed
      FROM newsletter_subscriptions
    `;
    const result = await this.dataSource.query(sql);
    return result[0];
  }
}

