import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type NotificationType = 'order' | 'contact_inquiry' | 'wholesale_enquiry' | 'newsletter_subscription' | 'quotation_inquiry';

export interface CreateNotificationData {
  type: NotificationType;
  message: string;
  order_id?: number;
  contact_inquiry_id?: number;
  wholesale_enquiry_id?: number;
  subscription_id?: number;
  quotation_inquiry_id?: number;
  metadata?: any;
}

@Injectable()
export class AdminNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(private dataSource: DataSource) { }

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS notification (
          id SERIAL PRIMARY KEY,
          userid INT NOT NULL,
          description TEXT,
          orderid INT DEFAULT 0,
          date_added DATE DEFAULT CURRENT_DATE,
          time_added TIME DEFAULT CURRENT_TIME,
          read_status BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.logger.log('Table notification ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure notification table:', error);
    }
  }

  /**
   * Create notification for all admin users
   */
  async createNotification(data: CreateNotificationData) {
    try {
      // Get all admin users (users with auth_level > 0 or specific role)
      const adminUsersQuery = `
        SELECT DISTINCT u.user_id 
        FROM "user" u
        WHERE u.status = 1 AND u.auth_level > 0
      `;
      const adminUsers = await this.dataSource.query(adminUsersQuery);

      if (adminUsers.length === 0) {
        this.logger.warn('No admin users found to send notifications to');
        return { created: 0 };
      }

      // Build description from message and type
      const description = data.message || `${data.type} notification`;

      // Use order_id if provided, otherwise use 0 as default (schema requires NOT NULL)
      const orderId = data.order_id || 0;

      const notifications: number[] = [];
      for (const admin of adminUsers) {
        const insertQuery = `
          INSERT INTO notification (
            userid,
            description,
            orderid,
            date_added,
            time_added,
            read_status,
            created_at
          ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIME, false, CURRENT_TIMESTAMP)
          RETURNING id
        `;

        const result = await this.dataSource.query(insertQuery, [
          admin.user_id,
          description,
          orderId,
        ]);

        notifications.push(result[0]?.id);
      }

      this.logger.log(`Created ${notifications.length} notifications for type: ${data.type}`);
      return { created: notifications.length, notificationIds: notifications };
    } catch (error: any) {
      this.logger.error(`Failed to create notification: ${error.message}`, error.stack);
      // Don't throw - notifications are not critical
      return { created: 0, error: error.message };
    }
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    userId: number,
    filters: {
      limit?: number;
      offset?: number;
      read_status?: string;
    },
  ) {
    const { limit = 20, offset = 0, read_status } = filters;

    let query = `
      SELECT 
        n.*,
        o.order_id,
        o.order_total,
        o.order_status,
        o.customer_order_name
      FROM notification n
      LEFT JOIN orders o ON n.orderid = o.order_id
      WHERE n.userid = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (read_status !== undefined) {
      query += ` AND n.read_status = $${paramIndex}`;
      params.push(read_status === 'true');
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const notifications = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM notification n
      WHERE n.userid = $1
    `;
    const countParams: any[] = [userId];
    let countParamIndex = 2;

    if (read_status !== undefined) {
      countQuery += ` AND n.read_status = $${countParamIndex}`;
      countParams.push(read_status === 'true');
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return {
      notifications,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: number, userId: number) {
    // Verify notification belongs to user
    const checkQuery = `
      SELECT id FROM notification 
      WHERE id = $1 AND userid = $2
    `;
    const checkResult = await this.dataSource.query(checkQuery, [id, userId]);

    if (checkResult.length === 0) {
      throw new NotFoundException('Notification not found');
    }

    await this.dataSource.query(
      `UPDATE notification SET read_status = true WHERE id = $1`,
      [id],
    );

    return { message: 'Notification marked as read' };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: number) {
    await this.dataSource.query(
      `UPDATE notification SET read_status = true 
       WHERE userid = $1 AND read_status = false`,
      [userId],
    );

    return { message: 'All notifications marked as read' };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: number) {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count 
       FROM notification 
       WHERE userid = $1 AND read_status = false`,
      [userId],
    );

    return { count: parseInt(result[0].count) };
  }
}
