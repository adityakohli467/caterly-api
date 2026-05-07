import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';

@Injectable()
export class AdminSubscriptionsService {
  private readonly logger = new Logger(AdminSubscriptionsService.name);

  constructor(
    private dataSource: DataSource,
    private schedulerService: SubscriptionSchedulerService,
  ) {}

  /**
   * List subscriptions (standing orders)
   */
  async listSubscriptions(filters: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, search, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT 
        o.order_id,
        o.customer_id,
        o.standing_order,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.customer_order_name,
        o.order_comments,
        o.customer_company_name,
        o.customer_department_name,
        o.sent_to_customer,
        o.sent_to_customer_at,
        o.delivery_frequency,
        o.delivery_start_date,
        c.firstname || ' ' || c.lastname as customer_name,
        co.company_name,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'item_comments', op.order_product_comment,
            'options', (
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            )
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE o.standing_order != 0
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status === 'active') {
      query += ` AND o.order_status IN (1, 2, 4, 7)`;
    } else if (status === 'inactive') {
      query += ` AND o.order_status IN (0, 8)`;
    }

    if (search) {
      query += ` AND (
        c.firstname ILIKE $${paramIndex} OR
        c.lastname ILIKE $${paramIndex} OR
        co.company_name ILIKE $${paramIndex} OR
        o.order_id::text ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY o.date_added DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    const subscriptions = result.map((row: any) => {
      const days = Number(row.standing_order || 0);
      let label: string | null = null;

      if (days > 0) {
        if (days % 30 === 0) {
          const m = Math.floor(days / 30);
          label = `Every ${m} Months`;
        } else if (days % 7 === 0) {
          const w = Math.floor(days / 7);
          label = `Every ${w} Weeks`;
        } else {
          label = `Every ${days} Days`;
        }
      }

      return {
        ...row,
        frequency_days: days,
        frequency_label: label,
        start_date: row.delivery_date_time || null,
      };
    });

    let countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE o.standing_order != 0
    `;

    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status === 'active') {
      countQuery += ` AND o.order_status IN (1, 2, 4, 7)`;
    } else if (status === 'inactive') {
      countQuery += ` AND o.order_status IN (0, 8)`;
    }

    if (search) {
      countQuery += ` AND (
        c.firstname ILIKE $${countParamIndex} OR
        c.lastname ILIKE $${countParamIndex} OR
        co.company_name ILIKE $${countParamIndex} OR
        o.order_id::text ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count, 10);

    return { subscriptions, count };
  }

  /**
   * Get single subscription
   */
  async getSubscription(id: number) {
    const query = `
      SELECT 
        o.*,
        o.delivery_frequency,
        o.delivery_start_date,
        c.firstname || ' ' || c.lastname as customer_name,
        c.email as customer_email,
        c.telephone as customer_phone,
        co.company_name,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'item_comments', op.order_product_comment,
            'options', (
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity,
                'option_price', opo.option_price
              ))
              FROM order_product_option opo
              WHERE opo.order_product_id = op.order_product_id
            )
          ))
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ) as products
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      WHERE o.order_id = $1 AND o.standing_order != 0
    `;

    const result = await this.dataSource.query(query, [Number(id)]);
    const subscription = result[0];

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const days = Number(subscription.standing_order || 0);
    let label: string | null = null;

    if (days > 0) {
      if (days % 30 === 0) {
        const m = Math.floor(days / 30);
        label = `Every ${m} Months`;
      } else if (days % 7 === 0) {
        const w = Math.floor(days / 7);
        label = `Every ${w} Weeks`;
      } else {
        label = `Every ${days} Days`;
      }
    }

    // Calculate totals
    let subtotal = 0;
    if (subscription.products) {
      for (const product of subscription.products) {
        subtotal += parseFloat(product.total || 0);
      }
    }

    const deliveryFee = parseFloat(subscription.delivery_fee || 0);
    const lateFee = parseFloat(subscription.late_fee || 0);

    // Calculate coupon discount
    let couponDiscount = 0;
    if (subscription.coupon_id) {
      if (subscription.coupon_code && subscription.coupon_discount) {
        if (subscription.coupon_type === 'P') {
          couponDiscount = subtotal * (parseFloat(subscription.coupon_discount) / 100);
        } else if (subscription.coupon_type === 'F') {
          couponDiscount = parseFloat(subscription.coupon_discount);
        }
        couponDiscount = Math.min(couponDiscount, subtotal + deliveryFee + lateFee);
      }
    }

    const afterDiscount = Math.max(0, subtotal - couponDiscount);
    const orderTotal = Math.round((subtotal + deliveryFee + lateFee - couponDiscount) * 100) / 100;
    const gst = Math.round((subtotal / 11) * 100) / 100;

    return {
      subscription: {
        ...subscription,
        subtotal,
        coupon_discount: couponDiscount,
        total_discount: couponDiscount,
        after_discount: afterDiscount,
        gst,
        calculated_total: orderTotal,
        order_total: orderTotal,
        frequency_days: days,
        frequency_label: label,
        start_date: subscription.delivery_date_time || null,
      },
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: number, cancelComment?: string) {
    const query = `
      UPDATE orders 
      SET order_status = 0,
          cancel_comment = $1,
          date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $2 AND standing_order != 0
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [
      cancelComment || 'Subscription cancelled',
      Number(id),
    ]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    await this.schedulerService.cancelFutureOrders(Number(id));

    return {
      subscription: result[0],
      message: 'Subscription cancelled successfully',
    };
  }

  async activateSubscription(id: number) {
    const query = `
      UPDATE orders 
      SET order_status = 7,
          cancel_comment = NULL,
          date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1 AND standing_order != 0
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      subscription: result[0],
      message: 'Subscription activated successfully',
    };
  }

  async updateSubscription(
    id: number,
    updateData: {
      standing_order?: number;
      delivery_date_time?: string;
      order_comments?: string;
      customer_order_name?: string;
    },
  ) {
    const query = `
      UPDATE orders 
      SET 
        standing_order = COALESCE($1, standing_order),
        delivery_date_time = COALESCE($2, delivery_date_time),
        order_comments = COALESCE($3, order_comments),
        customer_order_name = COALESCE($4, customer_order_name),
        date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $5 AND standing_order != 0
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [
      updateData.standing_order,
      updateData.delivery_date_time,
      updateData.order_comments,
      updateData.customer_order_name,
      Number(id),
    ]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      subscription: result[0],
      message: 'Subscription updated successfully',
    };
  }

  async sendToCustomer(id: number) {
    const query = `
      UPDATE orders 
      SET 
        sent_to_customer = true,
        sent_to_customer_at = CURRENT_TIMESTAMP,
        date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1 AND standing_order != 0
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      subscription: result[0],
      message: 'Subscription marked as sent to customer',
    };
  }

  async deleteSubscription(id: number) {
    const result = await this.dataSource.query(
      'DELETE FROM orders WHERE order_id = $1 AND standing_order != 0',
      [Number(id)],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Subscription not found');
    }

    return { message: 'Subscription deleted successfully' };
  }
}
