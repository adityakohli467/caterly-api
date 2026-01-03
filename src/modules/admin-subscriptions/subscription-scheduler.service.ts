import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Generate future orders for all active subscriptions
   * This should be called daily via a cron job or scheduled task
   */
  async generateFutureOrders() {
    this.logger.log('Starting future order generation for subscriptions');

    // Get all active subscriptions
    const activeSubscriptionsQuery = `
      SELECT 
        o.order_id,
        o.customer_id,
        o.standing_order,
        o.delivery_date_time,
        o.order_total,
        o.delivery_fee,
        o.customer_order_name,
        o.order_comments,
        o.customer_company_name,
        o.customer_department_name,
        o.location_id,
        o.delivery_address,
        o.delivery_contact,
        o.delivery_details,
        o.coupon_id,
        o.account_email,
        o.cost_center
      FROM orders o
      WHERE o.standing_order != 0 
        AND o.order_status IN (1, 2, 4, 7) -- active statuses
        AND o.delivery_date_time IS NOT NULL
    `;

    const subscriptions = await this.dataSource.query(activeSubscriptionsQuery);
    let generatedCount = 0;

    for (const subscription of subscriptions) {
      try {
        await this.generateFutureOrdersForSubscription(subscription);
        generatedCount++;
      } catch (error) {
        this.logger.error(`Failed to generate orders for subscription ${subscription.order_id}:`, error);
      }
    }

    this.logger.log(`Generated future orders for ${generatedCount} subscriptions`);
    return { generated: generatedCount };
  }

  /**
   * Generate future orders for a specific subscription
   */
  async generateFutureOrdersForSubscription(subscription: any) {
    const frequencyDays = subscription.standing_order;
    if (!frequencyDays || frequencyDays === 0) return;

    const startDate = new Date(subscription.delivery_date_time);
    const now = new Date();
    
    // Calculate how many future orders we need (up to 6 months ahead)
    const maxDate = new Date(now);
    maxDate.setMonth(maxDate.getMonth() + 6);

    // Get existing future orders for this subscription
    const existingOrdersQuery = `
      SELECT scheduled_delivery_date 
      FROM future_orders 
      WHERE subscription_order_id = $1 AND status = 'pending'
    `;
    const existingOrders = await this.dataSource.query(existingOrdersQuery, [subscription.order_id]);
    const existingDates = new Set(
      existingOrders.map((o: any) => new Date(o.scheduled_delivery_date).toISOString().split('T')[0])
    );

    // Generate future delivery dates
    const futureDates: Date[] = [];
    let currentDate = new Date(startDate);
    
    // Start from next occurrence after today
    while (currentDate <= now) {
      currentDate.setDate(currentDate.getDate() + frequencyDays);
    }

    while (currentDate <= maxDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!existingDates.has(dateKey)) {
        futureDates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + frequencyDays);
    }

    // Create future order records
    for (const deliveryDate of futureDates) {
      await this.createFutureOrder(subscription, deliveryDate);
    }

    // Update subscription schedule
    await this.updateSubscriptionSchedule(subscription.order_id, frequencyDays, futureDates[futureDates.length - 1]);
  }

  /**
   * Create a future order record
   */
  private async createFutureOrder(subscription: any, deliveryDate: Date) {
    const insertQuery = `
      INSERT INTO future_orders (
        subscription_order_id,
        scheduled_delivery_date,
        status
      ) VALUES ($1, $2, 'pending')
      ON CONFLICT DO NOTHING
    `;

    await this.dataSource.query(insertQuery, [subscription.order_id, deliveryDate.toISOString()]);
  }

  /**
   * Update subscription schedule
   */
  private async updateSubscriptionSchedule(
    subscriptionOrderId: number,
    frequencyDays: number,
    nextDeliveryDate: Date
  ) {
    // Check if schedule exists
    const checkQuery = `
      SELECT schedule_id FROM subscription_schedules 
      WHERE subscription_order_id = $1
    `;
    const existing = await this.dataSource.query(checkQuery, [subscriptionOrderId]);

    if (existing.length === 0) {
      // Create new schedule
      const insertQuery = `
        INSERT INTO subscription_schedules (
          subscription_order_id,
          next_delivery_date,
          frequency_days,
          is_active
        ) VALUES ($1, $2, $3, true)
      `;
      await this.dataSource.query(insertQuery, [
        subscriptionOrderId,
        nextDeliveryDate.toISOString(),
        frequencyDays,
      ]);
    } else {
      // Update existing schedule
      const updateQuery = `
        UPDATE subscription_schedules
        SET next_delivery_date = $1,
            frequency_days = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_order_id = $3
      `;
      await this.dataSource.query(updateQuery, [
        nextDeliveryDate.toISOString(),
        frequencyDays,
        subscriptionOrderId,
      ]);
    }
  }

  /**
   * Get future orders for dashboard/future orders page
   */
  async getFutureOrders(filters: {
    limit?: number;
    offset?: number;
    date_from?: Date;
    date_to?: Date;
  }) {
    const { limit = 50, offset = 0, date_from, date_to } = filters;

    let query = `
      SELECT 
        fo.future_order_id,
        fo.subscription_order_id,
        fo.scheduled_delivery_date,
        fo.status,
        fo.created_at,
        o.customer_id,
        o.customer_order_name,
        o.order_total,
        o.delivery_fee,
        c.firstname || ' ' || c.lastname as customer_name,
        co.company_name,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM future_orders fo
      JOIN orders o ON fo.subscription_order_id = o.order_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE fo.status = 'pending'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (date_from) {
      query += ` AND fo.scheduled_delivery_date >= $${paramIndex++}`;
      params.push(date_from.toISOString());
    }

    if (date_to) {
      query += ` AND fo.scheduled_delivery_date <= $${paramIndex++}`;
      params.push(date_to.toISOString());
    }

    query += ` ORDER BY fo.scheduled_delivery_date ASC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM future_orders fo
      WHERE fo.status = 'pending'
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (date_from) {
      countQuery += ` AND fo.scheduled_delivery_date >= $${countParamIndex++}`;
      countParams.push(date_from.toISOString());
    }

    if (date_to) {
      countQuery += ` AND fo.scheduled_delivery_date <= $${countParamIndex++}`;
      countParams.push(date_to.toISOString());
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.count || '0', 10);

    return {
      future_orders: result,
      total,
      limit,
      offset,
    };
  }

  /**
   * Process a future order (convert to actual order)
   * This is called when it's time to process the order
   */
  async processFutureOrder(futureOrderId: number) {
    // Get future order details
    const futureOrderQuery = `
      SELECT 
        fo.*,
        o.*
      FROM future_orders fo
      JOIN orders o ON fo.subscription_order_id = o.order_id
      WHERE fo.future_order_id = $1 AND fo.status = 'pending'
    `;
    const futureOrders = await this.dataSource.query(futureOrderQuery, [futureOrderId]);

    if (futureOrders.length === 0) {
      throw new Error('Future order not found or already processed');
    }

    const futureOrder = futureOrders[0];
    const subscription = futureOrder;

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create new order based on subscription
      const createOrderQuery = `
        INSERT INTO orders (
          customer_id,
          location_id,
          branch_id,
          shipping_method,
          order_status,
          order_total,
          delivery_fee,
          delivery_date_time,
          customer_order_name,
          order_comments,
          delivery_address,
          delivery_method,
          delivery_contact,
          delivery_details,
          coupon_id,
          coupon_discount,
          account_email,
          cost_center,
          standing_order,
          user_id,
          date_added,
          date_modified
        )
        SELECT 
          customer_id,
          location_id,
          COALESCE(branch_id, 1),
          COALESCE(shipping_method, 1),
          1, -- new order status
          order_total,
          delivery_fee,
          $1, -- scheduled delivery date
          customer_order_name,
          order_comments,
          delivery_address,
          delivery_method,
          delivery_contact,
          delivery_details,
          coupon_id,
          coupon_discount,
          account_email,
          cost_center,
          0, -- not a subscription itself
          user_id,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM orders
        WHERE order_id = $2
        RETURNING order_id
      `;

      const newOrderResult = await queryRunner.query(createOrderQuery, [
        futureOrder.scheduled_delivery_date,
        subscription.order_id,
      ]);

      const newOrderId = newOrderResult[0].order_id;

      // Copy order products - use CTE to maintain order and match options correctly
      const copyProductsWithOptionsQuery = `
        WITH old_products AS (
          SELECT 
            order_product_id as old_order_product_id,
            product_id,
            product_name,
            quantity,
            price,
            total,
            order_product_comment,
            sort_order,
            ROW_NUMBER() OVER (ORDER BY order_product_id) as seq
          FROM order_product
          WHERE order_id = $2
        ),
        new_products AS (
          INSERT INTO order_product (
            order_id,
            product_id,
            product_name,
            quantity,
            price,
            total,
            order_product_comment,
            sort_order
          )
          SELECT 
            $1,
            product_id,
            product_name,
            quantity,
            price,
            total,
            order_product_comment,
            sort_order
          FROM old_products
          ORDER BY seq
          RETURNING order_product_id, product_id, quantity, price, ROW_NUMBER() OVER (ORDER BY order_product_id) as seq
        )
        INSERT INTO order_product_option (
          order_product_id,
          product_option_id,
          option_name,
          option_value,
          option_quantity
        )
        SELECT 
          np.order_product_id,
          opo.product_option_id,
          opo.option_name,
          opo.option_value,
          opo.option_quantity
        FROM old_products op
        JOIN order_product_option opo ON op.old_order_product_id = opo.order_product_id
        JOIN new_products np ON np.seq = op.seq
      `;
      await queryRunner.query(copyProductsWithOptionsQuery, [newOrderId, subscription.order_id]);

      // Update future order status
      const updateFutureOrderQuery = `
        UPDATE future_orders
        SET status = 'generated',
            generated_order_id = $1,
            generated_at = CURRENT_TIMESTAMP
        WHERE future_order_id = $2
      `;
      await queryRunner.query(updateFutureOrderQuery, [newOrderId, futureOrderId]);

      // Update subscription schedule
      const nextDeliveryDate = new Date(futureOrder.scheduled_delivery_date);
      nextDeliveryDate.setDate(nextDeliveryDate.getDate() + subscription.standing_order);

      const updateScheduleQuery = `
        UPDATE subscription_schedules
        SET next_delivery_date = $1,
            last_generated_order_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_order_id = $3
      `;
      await queryRunner.query(updateScheduleQuery, [
        nextDeliveryDate.toISOString(),
        newOrderId,
        subscription.order_id,
      ]);

      await queryRunner.commitTransaction();

      return {
        future_order_id: futureOrderId,
        generated_order_id: newOrderId,
        message: 'Future order processed successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel future orders for a subscription (when subscription is cancelled)
   */
  async cancelFutureOrders(subscriptionOrderId: number) {
    const query = `
      UPDATE future_orders
      SET status = 'cancelled'
      WHERE subscription_order_id = $1 AND status = 'pending'
    `;

    await this.dataSource.query(query, [subscriptionOrderId]);

    // Deactivate schedule
    const deactivateQuery = `
      UPDATE subscription_schedules
      SET is_active = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE subscription_order_id = $1
    `;
    await this.dataSource.query(deactivateQuery, [subscriptionOrderId]);

    return { message: 'Future orders cancelled successfully' };
  }

  /**
   * Process all future orders that are due today
   * This should be called daily via a cron job
   */
  async processDueFutureOrders() {
    this.logger.log('Starting processing of due future orders');

    // Get all future orders that are due today (status = 'pending' and scheduled_delivery_date is today or earlier)
    const dueOrdersQuery = `
      SELECT future_order_id
      FROM future_orders
      WHERE status = 'pending'
        AND DATE(scheduled_delivery_date) <= CURRENT_DATE
      ORDER BY scheduled_delivery_date ASC
    `;

    const dueOrders = await this.dataSource.query(dueOrdersQuery);
    let processedCount = 0;
    let errorCount = 0;

    for (const futureOrder of dueOrders) {
      try {
        await this.processFutureOrder(futureOrder.future_order_id);
        processedCount++;
        this.logger.log(`Processed future order ${futureOrder.future_order_id}`);
      } catch (error) {
        errorCount++;
        this.logger.error(`Failed to process future order ${futureOrder.future_order_id}:`, error);
      }
    }

    this.logger.log(`Processed ${processedCount} future orders, ${errorCount} errors`);
    return {
      processed: processedCount,
      errors: errorCount,
      total: dueOrders.length,
    };
  }
}

