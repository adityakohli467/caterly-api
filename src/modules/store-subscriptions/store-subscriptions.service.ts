import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreSubscriptionsService {
  private readonly logger = new Logger(StoreSubscriptionsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * List user's subscriptions (standing orders)
   */
  async listSubscriptions(userId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      return { subscriptions: [], count: 0 };
    }

    const customerId = customerResult[0].customer_id;

    const query = `
      SELECT 
        o.order_id,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.customer_order_name,
        o.order_comments,
        o.delivery_address,
        o.standing_order,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'product_image', p.product_image,
            'options', COALESCE((
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            ), '[]'::json)
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      WHERE o.customer_id = $1 AND o.standing_order != 0
      ORDER BY o.date_added DESC
    `;

    const result = await this.dataSource.query(query, [customerId]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM orders o
      WHERE o.customer_id = $1 AND o.standing_order != 0
    `;
    const countResult = await this.dataSource.query(countQuery, [customerId]);
    const count = parseInt(countResult[0].count);

    return { subscriptions: result, count };
  }

  /**
   * Get single subscription
   */
  async getSubscription(userId: number, subscriptionId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const customerId = customerResult[0].customer_id;

    const query = `
      SELECT 
        o.*,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'product_image', p.product_image,
            'options', COALESCE((
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            ), '[]'::json)
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      WHERE o.order_id = $1 AND o.customer_id = $2 AND o.standing_order != 0
    `;

    const result = await this.dataSource.query(query, [Number(subscriptionId), customerId]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return { subscription: result[0] };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: number, subscriptionId: number) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Get customer_id from user_id
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);

    if (customerResult.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const customerId = customerResult[0].customer_id;

    // Verify subscription belongs to customer
    const verifyQuery = `
      SELECT order_id FROM orders 
      WHERE order_id = $1 AND customer_id = $2 AND standing_order != 0
    `;
    const verifyResult = await this.dataSource.query(verifyQuery, [Number(subscriptionId), customerId]);

    if (verifyResult.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    // Cancel subscription (set status to 0 - cancelled)
    const updateQuery = `
      UPDATE orders 
      SET order_status = 0, date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *
    `;
    const result = await this.dataSource.query(updateQuery, [Number(subscriptionId)]);

    // Cancel future orders for this subscription
    try {
      const cancelFutureOrdersQuery = `
        UPDATE future_orders
        SET status = 'cancelled'
        WHERE subscription_order_id = $1 AND status = 'pending'
      `;
      await this.dataSource.query(cancelFutureOrdersQuery, [Number(subscriptionId)]);

      // Deactivate schedule
      const deactivateScheduleQuery = `
        UPDATE subscription_schedules
        SET is_active = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE subscription_order_id = $1
      `;
      await this.dataSource.query(deactivateScheduleQuery, [Number(subscriptionId)]);
    } catch (error) {
      // Log error but don't fail the cancellation if future orders table doesn't exist
      this.logger.warn('Failed to cancel future orders (table may not exist):', error);
    }

    return {
      message: 'Subscription cancelled successfully',
      subscription: result[0],
    };
  }
}
