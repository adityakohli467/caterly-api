import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../../common/services/notification.service';

@Injectable()
export class AdminEmailConfigService {
  private readonly logger = new Logger(AdminEmailConfigService.name);

  constructor(
    private dataSource: DataSource,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get all email configurations
   */
  async getConfigurations(): Promise<any[]> {
    const configs = await this.dataSource.query(
      `SELECT config_id, config_key, config_value, description, is_active, created_at, updated_at 
       FROM email_config 
       ORDER BY config_key`,
    );
    return configs;
  }

  /**
   * Update email configuration
   */
  async updateConfiguration(configKey: string, configValue: string, description?: string): Promise<any> {
    if (!configKey) {
      throw new BadRequestException('Config key is required');
    }

    const existing = await this.dataSource.query(
      `SELECT config_id FROM email_config WHERE config_key = $1`,
      [configKey],
    );

    if (existing.length === 0) {
      throw new NotFoundException(`Configuration ${configKey} not found`);
    }

    await this.dataSource.query(
      `UPDATE email_config 
       SET config_value = $1, description = COALESCE($2, description), updated_at = CURRENT_TIMESTAMP 
       WHERE config_key = $3`,
      [configValue, description, configKey],
    );

    // Clear cache to reload configuration
    this.notificationService.clearConfigCache();

    return { success: true, message: 'Configuration updated successfully' };
  }

  /**
   * Get all email templates
   */
  async getTemplates(): Promise<any[]> {
    const templates = await this.dataSource.query(
      `SELECT template_id, template_key, template_name, subject, body_html, body_text, variables, is_active, created_at, updated_at 
       FROM email_templates 
       ORDER BY template_name`,
    );
    return templates;
  }

  /**
   * Get single template
   */
  async getTemplate(templateKey: string): Promise<any> {
    const templates = await this.dataSource.query(
      `SELECT * FROM email_templates WHERE template_key = $1 LIMIT 1`,
      [templateKey],
    );

    if (templates.length === 0) {
      throw new NotFoundException(`Template ${templateKey} not found`);
    }

    return templates[0];
  }

  /**
   * Update email template
   */
  async updateTemplate(
    templateKey: string,
    updates: {
      template_name?: string;
      subject?: string;
      body_html?: string;
      body_text?: string;
      variables?: any;
      is_active?: boolean;
    },
  ): Promise<any> {
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (updates.template_name !== undefined) {
      updateFields.push(`template_name = $${paramIndex++}`);
      updateParams.push(updates.template_name);
    }
    if (updates.subject !== undefined) {
      updateFields.push(`subject = $${paramIndex++}`);
      updateParams.push(updates.subject);
    }
    if (updates.body_html !== undefined) {
      updateFields.push(`body_html = $${paramIndex++}`);
      updateParams.push(updates.body_html);
    }
    if (updates.body_text !== undefined) {
      updateFields.push(`body_text = $${paramIndex++}`);
      updateParams.push(updates.body_text);
    }
    if (updates.variables !== undefined) {
      updateFields.push(`variables = $${paramIndex++}`);
      updateParams.push(JSON.stringify(updates.variables));
    }
    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateParams.push(updates.is_active);
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateParams.push(templateKey);

    await this.dataSource.query(
      `UPDATE email_templates 
       SET ${updateFields.join(', ')} 
       WHERE template_key = $${paramIndex}`,
      updateParams,
    );

    // Clear template cache
    this.notificationService.clearTemplateCache(templateKey);

    return { success: true, message: 'Template updated successfully' };
  }

  /**
   * Get email logs
   */
  async getEmailLogs(limit: number = 50, offset: number = 0, filters?: { templateKey?: string; status?: string; recipientEmail?: string }): Promise<any> {
    let query = `SELECT log_id, template_key, recipient_email, recipient_name, subject, status, error_message, sent_at, created_at, metadata 
                 FROM email_logs WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.templateKey) {
      query += ` AND template_key = $${paramIndex++}`;
      params.push(filters.templateKey);
    }
    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.recipientEmail) {
      query += ` AND recipient_email ILIKE $${paramIndex++}`;
      params.push(`%${filters.recipientEmail}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const logs = await this.dataSource.query(query, params);

    const countQuery = `SELECT COUNT(*) as count FROM email_logs WHERE 1=1${filters?.templateKey ? ` AND template_key = '${filters.templateKey}'` : ''}${filters?.status ? ` AND status = '${filters.status}'` : ''}${filters?.recipientEmail ? ` AND recipient_email ILIKE '%${filters.recipientEmail}%'` : ''}`;
    const countResult = await this.dataSource.query(countQuery);

    return {
      logs,
      total: parseInt(countResult[0]?.count || '0'),
      limit,
      offset,
    };
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(recipientEmail: string): Promise<any> {
    try {
      const result = await this.notificationService.sendNotification({
        templateKey: 'customer_registration',
        recipientEmail,
        recipientName: 'Test User',
        variables: {
          customer_name: 'Test User',
          email: recipientEmail,
        },
      });

      return {
        success: result.success,
        message: result.success ? 'Test email sent successfully' : `Failed to send test email: ${result.error}`,
        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
        error: error.message,
      };
    }
  }
}

