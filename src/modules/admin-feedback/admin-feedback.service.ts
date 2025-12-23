import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminFeedbackService {
  private readonly logger = new Logger(AdminFeedbackService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  /**
   * List customer feedbacks
   */
  async listFeedbacks(filters: {
    improvement_on?: string;
    limit?: number;
    offset?: number;
  }) {
    const { improvement_on, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT 
        cf.*,
        o.customer_order_name,
        o.delivery_date_time,
        c.firstname || ' ' || c.lastname as customer_name,
        co.company_name
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.order_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (improvement_on) {
      query += ` AND cf.commenttext ILIKE $${paramIndex}`;
      params.push(`%${improvement_on}%`);
      paramIndex++;
    }

    query += ` ORDER BY cf.feedback_id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM customer_feedback cf WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (improvement_on) {
      countQuery += ` AND cf.commenttext ILIKE $${countParamIndex}`;
      countParams.push(`%${improvement_on}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { feedbacks: result, count };
  }

  /**
   * Get single feedback
   */
  async getFeedback(id: number) {
    const query = `
      SELECT 
        cf.*,
        o.customer_order_name,
        o.delivery_date_time,
        c.firstname || ' ' || c.lastname as customer_name,
        co.company_name
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.order_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE cf.feedback_id = $1
    `;

    const result = await this.dataSource.query(query, [Number(id)]);
    const feedback = result[0];

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return { feedback };
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(id: number) {
    const query = 'DELETE FROM customer_feedback WHERE feedback_id = $1';
    await this.dataSource.query(query, [Number(id)]);

    return { message: 'Feedback deleted successfully' };
  }

  /**
   * Send feedback email to customer
   */
  async sendFeedbackEmail(id: number, recipientEmail?: string, customMessage?: string): Promise<any> {
    // Get feedback details with customer info
    const feedbackQuery = `
      SELECT 
        cf.*,
        o.customer_order_name,
        o.customer_order_email,
        o.delivery_email,
        o.email,
        o.delivery_date_time,
        o.order_id,
        c.email as customer_email,
        c.firstname,
        c.lastname,
        c.telephone,
        co.company_name
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.order_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE cf.feedback_id = $1
    `;

    const feedbackResult = await this.dataSource.query(feedbackQuery, [Number(id)]);
    const feedback = feedbackResult[0];

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // Determine recipient email (try multiple sources)
    const recipientEmailFinal = recipientEmail || 
                                feedback.customer_order_email || 
                                feedback.delivery_email ||
                                feedback.email ||
                                feedback.customer_email;

    if (!recipientEmailFinal) {
      throw new BadRequestException('Customer email not found. Please provide recipient email.');
    }

    const customerName = feedback.customer_order_name || 
                        (feedback.firstname && feedback.lastname ? `${feedback.firstname} ${feedback.lastname}` : null) ||
                        feedback.cname || 
                        'Customer';

    const companyName = this.configService.get<string>('COMPANY_NAME') || 'St. Dreux Coffee';

    // Build ratings display
    const ratings: string[] = [];
    if (feedback.food > 0) ratings.push(`Food: ${feedback.food}/5`);
    if (feedback.pricing > 0) ratings.push(`Pricing: ${feedback.pricing}/5`);
    if (feedback.menu > 0) ratings.push(`Menu: ${feedback.menu}/5`);
    if (feedback.experience > 0) ratings.push(`Experience: ${feedback.experience}/5`);
    if (feedback.delivery > 0) ratings.push(`Delivery: ${feedback.delivery}/5`);
    if (feedback.packaging > 0) ratings.push(`Packaging: ${feedback.packaging}/5`);
    if (feedback.service > 0) ratings.push(`Service: ${feedback.service}/5`);

    const emailSubject = `Thank You for Your Feedback - Order #${feedback.order_id}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #0d6efd; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #0d6efd; font-size: 18px; margin-bottom: 10px; border-bottom: 2px solid #0d6efd; padding-bottom: 5px; }
    .field { margin-bottom: 12px; }
    .label { font-weight: bold; color: #666; display: inline-block; min-width: 150px; }
    .value { color: #333; }
    .rating-box { background-color: #f9f9f9; border-left: 4px solid #0d6efd; padding: 15px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Your Feedback!</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Thank you for taking the time to provide feedback on your recent order (#${feedback.order_id}).</p>
      ${customMessage ? `<p>${customMessage}</p>` : ''}
      
      <div class="section">
        <div class="section-title">Your Feedback Summary</div>
        ${feedback.company_name ? `<div class="field"><span class="label">Company:</span><span class="value">${feedback.company_name}</span></div>` : ''}
        ${feedback.delivery_date ? `<div class="field"><span class="label">Delivery Date:</span><span class="value">${new Date(feedback.delivery_date).toLocaleDateString()}</span></div>` : ''}
        ${feedback.deliveredontime ? `<div class="field"><span class="label">Delivered On Time:</span><span class="value">${feedback.deliveredontime}</span></div>` : ''}
        
        ${ratings.length > 0 ? `
        <div class="rating-box">
          <strong>Ratings:</strong><br>
          ${ratings.join('<br>')}
        </div>
        ` : ''}
        
        ${feedback.website_experience ? `
        <div class="field">
          <span class="label">Website Experience:</span><br>
          <span class="value">${feedback.website_experience}</span>
        </div>
        ` : ''}
        
        ${feedback.commenttext ? `
        <div class="field">
          <span class="label">Comments:</span><br>
          <span class="value">${feedback.commenttext}</span>
        </div>
        ` : ''}
        
        ${feedback.suggestions ? `
        <div class="field">
          <span class="label">Suggestions:</span><br>
          <span class="value">${feedback.suggestions}</span>
        </div>
        ` : ''}
      </div>
      
      <p>We value your feedback and will use it to improve our services. If you have any further questions or concerns, please don't hesitate to contact us.</p>
      
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
      const emailResult = await this.emailService.sendEmail({
        to: recipientEmailFinal,
        subject: emailSubject,
        html: emailHtml,
      });

      return {
        success: true,
        email_sent: emailResult.success,
        recipient: recipientEmailFinal,
        message: emailResult.success ? 'Feedback email sent successfully' : 'Email service not configured',
        note: emailResult.error || undefined,
      };
    } catch (error: any) {
      this.logger.error('Failed to send feedback email:', error);
      return {
        success: false,
        email_sent: false,
        recipient: recipientEmailFinal,
        message: 'Failed to send feedback email',
        error: error.message,
      };
    }
  }
}
