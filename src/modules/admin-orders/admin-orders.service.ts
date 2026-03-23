import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order } from '../../entities/Order';
import { EmailService } from '../../common/services/email.service';
import { InvoiceService } from '../../common/services/invoice.service';
import * as crypto from 'crypto';

@Injectable()
export class AdminOrdersService implements OnModuleInit {
  private readonly logger = new Logger(AdminOrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private dataSource: DataSource,
    private emailService: EmailService,
    private invoiceService: InvoiceService,
    private configService: ConfigService,
  ) { }

  async onModuleInit() {
    try {
      this.logger.log('Ensuring orders table schema is up to date...');
      // Ensure all supplemental columns exist
      await this.dataSource.query(`
        DO $$ 
        BEGIN 
          -- gst
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='gst') THEN
            ALTER TABLE orders ADD COLUMN gst DECIMAL(10, 2) DEFAULT 0;
          END IF;
          -- is_completed
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_completed') THEN
            ALTER TABLE orders ADD COLUMN is_completed INT DEFAULT 0;
          END IF;
          -- late_fee
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='late_fee') THEN
            ALTER TABLE orders ADD COLUMN late_fee DECIMAL(10, 2) DEFAULT 0;
          END IF;
          -- delivery_address
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_address') THEN
            ALTER TABLE orders ADD COLUMN delivery_address TEXT;
          END IF;
          -- delivery_method
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_method') THEN
            ALTER TABLE orders ADD COLUMN delivery_method VARCHAR(100);
          END IF;
          -- account_email
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='account_email') THEN
            ALTER TABLE orders ADD COLUMN account_email VARCHAR(255);
          END IF;
          -- cost_center
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cost_center') THEN
            ALTER TABLE orders ADD COLUMN cost_center VARCHAR(100);
          END IF;
          -- delivery_contact
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_contact') THEN
            ALTER TABLE orders ADD COLUMN delivery_contact TEXT;
          END IF;
          -- delivery_details
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_details') THEN
            ALTER TABLE orders ADD COLUMN delivery_details TEXT;
          END IF;
          -- postcode
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='postcode') THEN
            ALTER TABLE orders ADD COLUMN postcode INT;
          END IF;
          -- company_id
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='company_id') THEN
            ALTER TABLE orders ADD COLUMN company_id INT;
          END IF;
          -- department_id
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='department_id') THEN
            ALTER TABLE orders ADD COLUMN department_id INT;
          END IF;
          -- delivery_frequency
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_frequency') THEN
            ALTER TABLE orders ADD COLUMN delivery_frequency VARCHAR(255);
          END IF;
          -- delivery_start_date
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_start_date') THEN
            ALTER TABLE orders ADD COLUMN delivery_start_date VARCHAR(255);
          END IF;

          -- order_product columns
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product' AND column_name='order_product_comment') THEN
            ALTER TABLE order_product ADD COLUMN order_product_comment TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product' AND column_name='sort_order') THEN
            ALTER TABLE order_product ADD COLUMN sort_order INT DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product' AND column_name='exclude_gst') THEN
            ALTER TABLE order_product ADD COLUMN exclude_gst INT DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product' AND column_name='is_prepared') THEN
            ALTER TABLE order_product ADD COLUMN is_prepared BOOLEAN DEFAULT FALSE;
          END IF;

          -- order_product_option columns
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product_option' AND column_name='option_price') THEN
            ALTER TABLE order_product_option ADD COLUMN option_price DECIMAL(10, 2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product_option' AND column_name='option_total') THEN
            ALTER TABLE order_product_option ADD COLUMN option_total DECIMAL(10, 2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product_option' AND column_name='order_id') THEN
            ALTER TABLE order_product_option ADD COLUMN order_id INT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_product_option' AND column_name='product_option_id') THEN
            ALTER TABLE order_product_option ADD COLUMN product_option_id INT DEFAULT 0;
          END IF;
        END $$;
      `);
      this.logger.log('Orders database schema verified successfully.');
    } catch (error) {
      this.logger.warn('Failed to verify orders database schema: ' + error.message);
    }
  }

  async findAll(query: any): Promise<any> {
    const {
      limit = 20,
      offset = 0,
      status,
      search,
      from_date,
      to_date,
      location_id,
      min_amount,
      max_amount,
      order_type,
    } = query;

    const params: any[] = [];
    let paramIndex = 1;

    let sqlQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.delivery_address,
        o.delivery_method,
        o.standing_order,
        o.location_id,
        o.date_added,
        o.date_modified,
        o.delivery_fee,
        o.coupon_id,
        o.coupon_discount as stored_coupon_discount,
        o.gst,
        o.is_completed,
        o.user_id,
        COALESCE(o.firstname, c.firstname) as firstname,
        COALESCE(o.lastname, c.lastname) as lastname,
        COALESCE(o.email, c.email) as email,
        COALESCE(o.telephone, c.telephone) as telephone,
        o.customer_order_name,
        o.customer_order_email,
        o.customer_order_telephone,
        o.delivery_frequency,
        o.delivery_start_date,
        c.customer_type,
        COALESCE(o.company_id, c.company_id) as company_id,
        COALESCE(o.department_id, c.department_id) as department_id,
        co.company_name,
        d.department_name,
        l.location_name,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM payment_history ph 
            WHERE ph.order_id = o.order_id 
            AND ph.payment_status = 'succeeded'
          ) THEN true
          ELSE false
        END as has_successful_payment
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE 1=1
      AND o.order_status NOT IN (0, 4, 9) -- Exclude "Cancelled/Quote" (0), "Awaiting Approval" (4), and "Modify" (9)
      -- Exclude quotes (payment_status = 'quote') - quotes should only appear in quotes list
      AND (o.payment_status IS NULL OR o.payment_status != 'quote')
      -- Note: Status 1 (New) orders ARE included in the orders list, but quotes are excluded
      -- Standing orders (subscriptions) are included unless filtered by order_type
      AND o.order_status != 0
    `;

    if (order_type) {
      const now = new Date();
      if (order_type === 'past') {
        sqlQuery += ` AND o.standing_order = 0 AND o.delivery_date_time < $${paramIndex++}`;
        params.push(now.toISOString());
      } else if (order_type === 'future') {
        // Include both regular future orders and subscription-generated future orders
        sqlQuery += ` AND (
            (o.standing_order = 0 AND (o.delivery_date_time >= $${paramIndex} OR o.delivery_date_time IS NULL))
            OR o.order_id IN (
              SELECT generated_order_id FROM future_orders 
              WHERE status = 'generated' AND scheduled_delivery_date >= $${paramIndex}
            )
            OR o.order_id IN (
              SELECT subscription_order_id FROM future_orders 
              WHERE status = 'pending' AND scheduled_delivery_date >= $${paramIndex}
            )
          )`;
        params.push(now.toISOString());
        paramIndex++;
      } else if (order_type === 'reminder') {
        sqlQuery += ` AND o.standing_order = 1`;
      } else if (order_type === 'late') {
        // Late orders: past delivery date, not standing order, not cancelled, not completed
        sqlQuery += ` AND o.standing_order = 0 AND o.delivery_date_time < $${paramIndex++} AND o.delivery_date_time IS NOT NULL AND o.order_status NOT IN (0, 4, 5)`;
        params.push(now.toISOString());
      }
    }

    if (status !== undefined) {
      const statusNum = Number(status);
      // Special handling for status 3 (Paid Orders filter)
      if (statusNum === 3) {
        // Paid orders: order_status = 2 OR payment_status indicates paid OR has successful payment history
        sqlQuery += ` AND (
          o.order_status = 2 
          OR o.payment_status IN ('paid', 'success', 'completed', 'succeeded')
          OR EXISTS (
            SELECT 1 FROM payment_history ph 
            WHERE ph.order_id = o.order_id 
            AND ph.payment_status IN ('succeeded', 'paid', 'completed', 'success')
          )
        )`;
      } else {
        sqlQuery += ` AND o.order_status = $${paramIndex++}`;
        params.push(statusNum);
      }
    }

    if (location_id) {
      sqlQuery += ` AND o.location_id = $${paramIndex++}`;
      params.push(Number(location_id));
    }

    if (min_amount) {
      sqlQuery += ` AND o.order_total >= $${paramIndex++}`;
      params.push(Number(min_amount));
    }

    if (max_amount) {
      sqlQuery += ` AND o.order_total <= $${paramIndex++}`;
      params.push(Number(max_amount));
    }

    if (search) {
      sqlQuery += ` AND (
        CAST(o.order_id AS TEXT) ILIKE $${paramIndex} OR
        c.firstname ILIKE $${paramIndex} OR
        c.lastname ILIKE $${paramIndex} OR
        c.email ILIKE $${paramIndex} OR
        o.firstname ILIKE $${paramIndex} OR
        o.lastname ILIKE $${paramIndex} OR
        o.email ILIKE $${paramIndex} OR
        co.company_name ILIKE $${paramIndex} OR
        d.department_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (from_date) {
      sqlQuery += ` AND o.delivery_date_time >= $${paramIndex++}`;
      params.push(from_date);
    }

    if (to_date) {
      sqlQuery += ` AND o.delivery_date_time <= $${paramIndex++}`;
      params.push(to_date);
    }

    const countQuery = `SELECT COUNT(*) FROM (${sqlQuery}) as count_query`;
    const countResult = await this.dataSource.query(countQuery, params);
    const count = parseInt(countResult[0].count);

    // Sort by date_added DESC first (latest first), then by delivery_date_time DESC
    sqlQuery += ` ORDER BY o.date_added DESC, o.delivery_date_time DESC NULLS LAST`;
    sqlQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    const orderIds = result.map((row: any) => row.order_id);
    let productsMap = new Map();

    if (orderIds.length > 0) {
      const productsQuery = `
        SELECT 
          op.order_id,
          op.order_product_id,
          op.total as product_total,
          COALESCE((
            SELECT SUM(opo.option_price * opo.option_quantity)
            FROM order_product_option opo
            WHERE opo.order_product_id = op.order_product_id
          ), 0) as options_total
        FROM order_product op
        WHERE op.order_id = ANY($1)
      `;
      const productsResult = await this.dataSource.query(productsQuery, [orderIds]);

      productsResult.forEach((row: any) => {
        if (!productsMap.has(row.order_id)) {
          productsMap.set(row.order_id, 0);
        }
        const currentSubtotal = productsMap.get(row.order_id);
        productsMap.set(row.order_id, currentSubtotal + parseFloat(row.product_total || 0) + parseFloat(row.options_total || 0));
      });
    }

    const orders = result.map((row: any) => {
      let subtotal = productsMap.get(row.order_id) || 0;

      // Calculate coupon discount
      let couponDiscount = 0;
      let couponCode: string | null = null;
      // Check if coupon_id exists (even if JOIN returns NULL due to deleted coupon)
      if (row.coupon_id) {
        // First, try to use stored coupon_discount from orders table (for historical accuracy)
        if (row.stored_coupon_discount && parseFloat(row.stored_coupon_discount) > 0) {
          couponDiscount = parseFloat(row.stored_coupon_discount);
          couponCode = row.coupon_code || 'DELETED';
        } else if (row.coupon_code && row.coupon_discount) {
          // Coupon still exists - calculate from coupon table
          couponCode = row.coupon_code;
          if (row.coupon_type === 'P') {
            couponDiscount = subtotal * (parseFloat(row.coupon_discount) / 100);
          } else if (row.coupon_type === 'F') {
            couponDiscount = parseFloat(row.coupon_discount);
          }
          couponDiscount = Math.min(couponDiscount, subtotal);
        } else {
          // Coupon was deleted but coupon_id exists - use stored order_total to calculate discount
          // Calculate what the total should be without coupon (GST is inclusive)
          const tempAfterDiscount = subtotal;
          const tempDeliveryFee = parseFloat(row.delivery_fee || 0);
          const tempTotal = Math.round((tempAfterDiscount + tempDeliveryFee) * 100) / 100; // Total is inclusive of GST
          const tempGst = Math.round((tempTotal * (11 / 111)) * 100) / 100; // Calculate GST as 11% but display as 10%
          // The difference is the coupon discount
          const storedTotal = parseFloat(row.order_total || 0);
          if (storedTotal < tempTotal) {
            couponDiscount = tempTotal - storedTotal;
            couponCode = 'DELETED';
          }
        }
      }

      const afterDiscount = subtotal - couponDiscount;
      const deliveryFee = parseFloat(row.delivery_fee || 0);
      const calculatedTotal = Math.round((afterDiscount + deliveryFee) * 100) / 100;
      // Use stored GST if available, otherwise calculate 10% of subtotal as informational
      const gst = row.gst ? parseFloat(row.gst) : Math.round(afterDiscount * 0.1 * 100) / 100;

      return {
        order_id: row.order_id,
        customer_name: (`${row.firstname || ''} ${row.lastname || ''}`.trim() || row.customer_order_name || 'Guest').trim(),
        customer_firstname: row.firstname,
        customer_lastname: row.lastname,
        email: row.email || row.customer_order_email || null,
        telephone: row.telephone || row.customer_order_telephone || null,
        customer_type: row.customer_type,
        company: row.company_name,
        company_id: row.company_id,
        department: row.department_name,
        department_id: row.department_id,
        location_name: row.location_name,
        location_id: row.location_id,
        delivery_date: row.delivery_date_time ? new Date(row.delivery_date_time).toISOString().split('T')[0] : null,
        delivery_time: row.delivery_date_time ? new Date(row.delivery_date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
        delivery_address: row.delivery_address || null,
        delivery_method: row.delivery_method || null,
        order_total: parseFloat(row.order_total || calculatedTotal),
        order_status: row.order_status,
        standing_order: row.standing_order,
        user_id: row.user_id,
        date_added: row.date_added,
        date_modified: row.date_modified,
        coupon_code: couponCode,
        coupon_discount: couponDiscount,
        gst: gst,
        is_completed: row.is_completed || 0,
      };
    });

    return {
      orders,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  async findOne(id: number): Promise<any> {
    const orderQuery = `
      SELECT 
        o.*,
        o.coupon_id,
        COALESCE(o.firstname, c.firstname) as firstname,
        COALESCE(o.lastname, c.lastname) as lastname,
        COALESCE(o.email, c.email) as email,
        COALESCE(o.telephone, c.telephone) as telephone,
        c.customer_type,
        COALESCE(o.company_id, c.company_id) as company_id,
        COALESCE(o.department_id, d.department_id) as department_id,
        co.company_name,
        co.company_abn,
        d.department_name,
        l.location_name,
        o.coupon_discount as stored_coupon_discount,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'order_product_id', op.order_product_id,
              'product_id', op.product_id,
              'product_name', COALESCE(p.product_name, 'Unknown Product'),
              'product_description', p.product_description,
              'quantity', op.quantity,
              'price', op.price,
              'total', op.total,
              'product_comment', op.order_product_comment,
              'item_comments', op.order_product_comment,
              'is_prepared', COALESCE(op.is_prepared, false),
              'product_desc_1', p.product_desc_1,
              'product_desc_2', p.product_desc_2,
              'options', COALESCE((
                SELECT json_agg(json_build_object(
                  'option_name', opo.option_name,
                  'option_value', opo.option_value,
                  'option_quantity', opo.option_quantity,
                  'option_price', opo.option_price,
                  'option_value_id', po.option_value_id
                ) ORDER BY opo.order_product_option_id)
                FROM order_product_option opo
                LEFT JOIN product_option po ON opo.product_option_id = po.product_option_id
                WHERE opo.order_product_id = op.order_product_id
              ), '[]'::json)
            ) ORDER BY op.order_product_id
          )
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ), '[]'::json) as order_products
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.order_id = $1
    `;
    const orderResult = await this.dataSource.query(orderQuery, [id]);

    if (orderResult.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orderResult[0];

    let orderProducts = order.order_products;
    if (typeof orderProducts === 'string') {
      try {
        orderProducts = JSON.parse(orderProducts);
      } catch (e) {
        this.logger.error('Failed to parse order_products:', e);
        orderProducts = [];
      }
    }
    if (!orderProducts) {
      orderProducts = [];
    }

    // Calculate subtotal
    let subtotal = 0;
    if (Array.isArray(orderProducts) && orderProducts.length > 0) {
      for (const product of orderProducts) {
        subtotal += parseFloat(product.total || 0);
        if (product.options && Array.isArray(product.options)) {
          for (const option of product.options) {
            subtotal += parseFloat(option.option_price || 0) * parseFloat(option.option_quantity || 0);
          }
        }
      }
    }

    // Calculate coupon discount
    let couponDiscount = 0;
    let couponCode: string | null = order.coupon_code || null;
    // Check if coupon_id exists (even if JOIN returns NULL due to deleted coupon)
    if (order.coupon_id) {
      if (order.coupon_code && order.coupon_discount) {
        // Coupon information available from JOIN
        couponCode = order.coupon_code;
        if (order.coupon_type === 'P') {
          couponDiscount = subtotal * (parseFloat(order.coupon_discount) / 100);
        } else if (order.coupon_type === 'F') {
          couponDiscount = parseFloat(order.coupon_discount);
        }
        couponDiscount = Math.min(couponDiscount, subtotal);
      } else {
        // Coupon was deleted but coupon_id exists - calculate discount from stored order_total
        // Calculate what the total should be without coupon (GST is inclusive)
        const tempAfterDiscount = subtotal;
        const tempDeliveryFee = parseFloat(order.delivery_fee || 0);
        const tempTotal = Math.round((tempAfterDiscount + tempDeliveryFee) * 100) / 100; // Total is inclusive of GST
        const tempGst = Math.round((tempTotal * (11 / 111)) * 100) / 100; // Calculate GST as 11% but display as 10%
        // The difference is the coupon discount
        const storedTotal = parseFloat(order.order_total || 0);
        if (storedTotal < tempTotal) {
          couponDiscount = tempTotal - storedTotal;
          couponCode = 'DELETED'; // Indicate coupon was deleted
        }
      }
    }

    const afterDiscount = subtotal - couponDiscount;
    const gst = Math.round((afterDiscount * 0.1) * 100) / 100;
    const deliveryFee = parseFloat(order.delivery_fee || 0);
    const lateFee = parseFloat(order.late_fee || 0);
    // GST is not added to total for Caterly
    const orderTotal = Math.round((afterDiscount + deliveryFee + lateFee) * 100) / 100;

    // Check payment status from payment_history
    const paymentStatusQuery = `
      SELECT payment_status 
      FROM payment_history 
      WHERE order_id = $1 
      AND payment_status = 'succeeded' 
      LIMIT 1
    `;
    const paymentStatusResult = await this.dataSource.query(paymentStatusQuery, [id]);
    const hasSuccessfulPayment = paymentStatusResult.length > 0;

    // Determine payment status
    let paymentStatus = 'Not Paid';
    if (hasSuccessfulPayment || order.order_status === 2) {
      paymentStatus = 'Paid';
    } else if (order.order_status === 7 || order.is_completed === 1) {
      paymentStatus = 'Completed';
    }

    const { order_products: _, ...orderWithoutProducts } = order;

    return {
      order: {
        ...orderWithoutProducts,
        frequency_days: Number(order.standing_order || 0),
        frequency_label: (() => {
          const days = Number(order.standing_order || 0);
          if (!days || days <= 0) return null;
          if (days % 30 === 0) return `Every ${Math.floor(days / 30)} Months`;
          if (days % 7 === 0) return `Every ${Math.floor(days / 7)} Weeks`;
          return `Every ${days} Days`;
        })(),
        start_date: order.delivery_date_time || null,
        // Explicitly ensure delivery fields are included
        delivery_date_time: order.delivery_date_time || null,
        delivery_address: order.delivery_address || null,
        delivery_method: order.delivery_method || null,
        delivery_contact: order.delivery_contact || null,
        delivery_details: order.delivery_details || null,
        account_email: order.account_email || null,
        cost_center: order.cost_center || null,
        order_products: orderProducts,
        products: orderProducts, // Also include as 'products' for consistency with quotes
        customer_order_name: `${order.firstname || ''} ${order.lastname || ''}`.trim() || order.customer_order_name || 'Guest',
        customer_order_email: order.email || order.customer_order_email || order.delivery_email || null,
        customer_order_telephone: order.telephone || order.customer_order_telephone || order.delivery_phone || null,
        firstname: order.firstname || order.account_firstname || null,
        lastname: order.lastname || order.account_lastname || null,
        email: order.email || order.account_email || order.delivery_email || null,
        telephone: order.telephone || order.account_telephone || order.delivery_phone || null,
        subtotal: subtotal,
        coupon_discount: couponDiscount,
        coupon_code: couponCode,
        coupon_id: order.coupon_id || null, // Ensure coupon_id is included
        total_discount: couponDiscount,
        after_discount: afterDiscount,
        gst: gst,
        late_fee: lateFee,
        calculated_total: orderTotal,
        payment_status: paymentStatus,
        order_total: orderTotal,
      },
    };
  }

  async create(createOrderDto: any, userId?: number): Promise<any> {
    // Validate required fields BEFORE starting transaction
    if (!createOrderDto) {
      throw new BadRequestException('Order data is required');
    }

    if (!createOrderDto.location_id) {
      throw new BadRequestException('Location ID is required');
    }

    if (!createOrderDto.products || !Array.isArray(createOrderDto.products) || createOrderDto.products.length === 0) {
      throw new BadRequestException('At least one product is required');
    }

    // Validate delivery address is required when delivery method is "delivery"
    if (createOrderDto.delivery_method === 'delivery' && (!createOrderDto.delivery_address || createOrderDto.delivery_address.trim().length === 0)) {
      throw new BadRequestException('Delivery Address is required when delivery method is selected');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        customer_id,
        firstname,
        lastname,
        email,
        telephone,
        location_id,
        company_id,
        department_id,
        delivery_date, // New: separate date field
        delivery_date_time, // Optional - for backward compatibility
        delivery_time, // New: separate time field for Caterly
        delivery_fee = 0,
        order_comments,
        coupon_code,
        delivery_address,
        delivery_method,
        account_email,
        cost_center,
        delivery_contact,
        delivery_details,
        standing_order = 0,
        products = [],
      } = createOrderDto;

      // Get customer details
      // Calculate totals
      let subtotal = 0;
      for (const product of products) {
        const productTotal = (product.price || 0) * (product.quantity || 0);
        subtotal += productTotal;
      }

      let couponDiscount = 0;
      let couponId = null;
      if (coupon_code) {
        // Trim whitespace and make case-insensitive lookup
        const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
        const couponResult = await queryRunner.query(
          `SELECT coupon_id, coupon_code, type, coupon_discount, status
           FROM coupon 
           WHERE UPPER(TRIM(coupon_code)) = $1 AND status = 1`,
          [normalizedCouponCode],
        );

        if (couponResult.length > 0) {
          const coupon = couponResult[0];
          couponId = coupon.coupon_id;

          // Apply coupon discount
          if (coupon.type === 'P') {
            couponDiscount = subtotal * (parseFloat(coupon.coupon_discount) / 100);
          } else if (coupon.type === 'F') {
            couponDiscount = parseFloat(coupon.coupon_discount);
          }

          couponDiscount = Math.min(couponDiscount, subtotal);
        } else {
          // Log warning if coupon not found (for debugging)
          this.logger.warn(`Coupon not found or inactive: ${coupon_code} (normalized: ${normalizedCouponCode})`);
        }
      }

      const totalDiscount = couponDiscount;
      const afterDiscount = subtotal - couponDiscount;
      const deliveryFeeAmount = parseFloat(delivery_fee || 0);
      // GST is not added to total for Caterly
      const orderTotal = Math.round((afterDiscount + deliveryFeeAmount) * 100) / 100;
      const gst = Math.round((afterDiscount * 0.1) * 100) / 100;

      // Build delivery_date_time: prioritize delivery_date_time if provided, otherwise build from date/time
      // Allow setting just date (with default time 00:00:00) or both date and time
      let finalDeliveryDateTime: string | null = null;

      if (delivery_date_time && typeof delivery_date_time === 'string' && delivery_date_time.trim()) {
        // Use provided delivery_date_time if available (could be ISO format or "YYYY-MM-DD HH:MM:SS")
        const trimmedDateTime = delivery_date_time.trim();
        // If it's an ISO format, convert to "YYYY-MM-DD HH:MM:SS" format
        if (trimmedDateTime.includes('T')) {
          try {
            const dateObj = new Date(trimmedDateTime);
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear();
              const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
              const day = dateObj.getDate().toString().padStart(2, '0');
              const hours = dateObj.getHours().toString().padStart(2, '0');
              const minutes = dateObj.getMinutes().toString().padStart(2, '0');
              const seconds = dateObj.getSeconds().toString().padStart(2, '0');
              finalDeliveryDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            } else {
              finalDeliveryDateTime = trimmedDateTime;
            }
          } catch (error) {
            // If parsing fails, use as-is
            finalDeliveryDateTime = trimmedDateTime;
          }
        } else {
          // Already in "YYYY-MM-DD HH:MM:SS" format
          finalDeliveryDateTime = trimmedDateTime;
        }
      } else if (delivery_date && typeof delivery_date === 'string' && delivery_date.trim()) {
        // Build from delivery_date and delivery_time
        const normalizedDate = delivery_date.trim();
        if (delivery_time && typeof delivery_time === 'string' && delivery_time.trim()) {
          // Both date and time provided
          const timeParts = delivery_time.trim().replace(/:/g, '').match(/.{1,2}/g) || [];
          if (timeParts.length >= 2 && timeParts[0] && timeParts[1]) {
            const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
            finalDeliveryDateTime = `${normalizedDate} ${formattedTime}`;
          } else {
            // Invalid time format, use default time
            finalDeliveryDateTime = `${normalizedDate} 00:00:00`;
          }
        } else {
          // Only date provided, use default time (start of day)
          finalDeliveryDateTime = `${normalizedDate} 00:00:00`;
        }
      }
      // If no date provided, keep as null for future orders/quotes

      // Create order
      // Set branch_id to location_id if provided, otherwise default to 1
      const branch_id = location_id || 1;
      // Set shipping_method: 1 = delivery, 2 = pickup (or based on delivery_method)
      // Default to 1 (delivery) if not specified
      const shipping_method = delivery_method === 'pickup' ? 2 : 1;
      // Set user_id from authenticated user, default to 1 if not provided
      const user_id = userId || 1;

      const orderResult = await queryRunner.query(
        `INSERT INTO orders (
          customer_id, location_id, branch_id, shipping_method, delivery_date_time, delivery_fee, order_total,
          order_status, order_comments, coupon_id, coupon_discount, delivery_address, delivery_method,
          account_email, cost_center, delivery_contact, delivery_details, standing_order, user_id, payment_status,
          firstname, lastname, email, telephone, gst, company_id, department_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING *`,
        [
          customer_id || null,
          location_id,
          branch_id,
          shipping_method,
          finalDeliveryDateTime,
          deliveryFeeAmount,
          orderTotal,
          1, // New order status (1 = New, 2 = Paid)
          order_comments,
          couponId,
          couponDiscount, // Store coupon discount amount for historical accuracy
          delivery_address,
          delivery_method,
          account_email,
          cost_center,
          delivery_contact,
          delivery_details,
          standing_order,
          user_id,
          'order', // Mark as 'order' to distinguish from quotes (quotes will have NULL or 'pending')
          firstname || null,
          lastname || null,
          email || null,
          telephone || null,
          gst,
          company_id || null,
          department_id || null,
        ],
      );

      const order = orderResult[0];

      // Create order products
      for (let index = 0; index < products.length; index++) {
        const product = products[index];
        const productTotal = (product.price || 0) * (product.quantity || 0);
        const sortOrder = product.sort_order !== undefined ? product.sort_order : index + 1; // Use provided sort_order or index + 1
        const excludeGst = product.exclude_gst !== undefined ? product.exclude_gst : 0; // Default to 0 (include GST)

        const orderProductResult = await queryRunner.query(
          `INSERT INTO order_product (order_id, product_id, quantity, price, total, order_product_comment, sort_order, exclude_gst)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING order_product_id`,
          [
            order.order_id,
            product.product_id,
            product.quantity || 1,
            product.price || 0,
            productTotal,
            product.comment?.trim() || null,
            sortOrder,
            excludeGst
          ],
        );

        const orderProductId = orderProductResult[0].order_product_id;

        // Create order product options
        if (product.add_ons && Array.isArray(product.add_ons)) {
          for (const addon of product.add_ons) {
            const optionQuantity = addon.option_quantity || 1;
            const optionPrice = parseFloat(addon.option_price || 0);
            const optionTotal = optionQuantity * optionPrice;

            await queryRunner.query(
              `INSERT INTO order_product_option (
                order_id, order_product_id, product_option_id, option_name, option_value,
                option_quantity, option_price, option_total
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                order.order_id, // Add order_id
                orderProductId,
                addon.product_option_id || 0, // product_option_id is NOT NULL, use 0 as default
                addon.option_name || '',
                addon.option_value || '',
                optionQuantity,
                optionPrice,
                optionTotal, // Add option_total
              ],
            );
          }
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(order.order_id);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error('Create order error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, updateOrderDto: any, userId?: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current order data to preserve fields if not provided in partial update
      const currentOrderCheck = await queryRunner.query(
        `SELECT * FROM orders WHERE order_id = $1`,
        [id],
      );

      if (currentOrderCheck.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const currentOrder = currentOrderCheck[0];
      const currentPaymentStatus = currentOrder.payment_status;

      // Ensure payment_status is set to 'order' if it's NULL or 'quote'
      const preservedPaymentStatus = currentPaymentStatus && currentPaymentStatus !== 'quote'
        ? currentPaymentStatus
        : 'order';

      const {
        customer_id = currentOrder.customer_id,
        firstname = currentOrder.firstname,
        lastname = currentOrder.lastname,
        email = currentOrder.email,
        telephone = currentOrder.telephone,
        location_id,
        company_id,
        department_id,
        delivery_date,
        delivery_date_time,
        delivery_time,
        delivery_fee,
        order_comments,
        coupon_code,
        delivery_address,
        delivery_method,
        account_email,
        cost_center,
        delivery_contact,
        delivery_details,
        standing_order,
        order_status,
        products,
      } = updateOrderDto;

      // Robust fallback logic using nullish coalescing to support partial updates
      const finalLocationId = location_id ?? currentOrder.location_id;
      const finalOrderStatus = order_status ?? currentOrder.order_status;
      const finalCustomerId = customer_id ?? currentOrder.customer_id;
      const finalFirstname = firstname ?? currentOrder.firstname;
      const finalLastname = lastname ?? currentOrder.lastname;
      const finalEmail = email ?? currentOrder.email;
      const finalTelephone = telephone ?? currentOrder.telephone;
      const finalCompanyId = company_id ?? currentOrder.company_id;
      const finalDepartmentId = department_id ?? currentOrder.department_id;
      const finalDeliveryFee = delivery_fee ?? currentOrder.delivery_fee;
      const finalOrderComments = order_comments ?? currentOrder.order_comments;
      const finalDeliveryAddress = delivery_address ?? currentOrder.delivery_address;
      const finalDeliveryMethod = delivery_method ?? currentOrder.delivery_method;
      const finalAccountEmail = account_email ?? currentOrder.account_email;
      const finalCostCenter = cost_center ?? currentOrder.cost_center;
      const finalDeliveryContact = delivery_contact ?? currentOrder.delivery_contact;
      const finalDeliveryDetails = delivery_details ?? currentOrder.delivery_details;
      const finalStandingOrder = standing_order ?? currentOrder.standing_order;
      const finalDeliveryDateTimeProvided = delivery_date_time ?? currentOrder.delivery_date_time;

      // Build delivery_date_time from provided date/time or preserve existing
      let finalDeliveryDateTime: string | null = finalDeliveryDateTimeProvided;
      if (delivery_date && typeof delivery_date === 'string' && delivery_date.trim()) {
        const normalizedDate = delivery_date.trim();
        if (delivery_time && typeof delivery_time === 'string' && delivery_time.trim()) {
          const timeParts = delivery_time.trim().replace(/:/g, '').match(/.{1,2}/g) || [];
          if (timeParts.length >= 2 && timeParts[0] && timeParts[1]) {
            const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
            finalDeliveryDateTime = `${normalizedDate} ${formattedTime}`;
          } else {
            finalDeliveryDateTime = `${normalizedDate} 00:00:00`;
          }
        } else {
          finalDeliveryDateTime = `${normalizedDate} 00:00:00`;
        }
      }

      // Calculate totals - only if products are provided, otherwise preserve current totals
      let resolvedOrderTotal = currentOrder.order_total;
      let resolvedGst = currentOrder.gst;
      let resolvedCouponDiscount = currentOrder.coupon_discount;
      let resolvedCouponId = currentOrder.coupon_id;

      if (products && Array.isArray(products) && products.length > 0) {
        let subtotal = 0;
        for (const product of products) {
          const productTotal = (product.price || 0) * (product.quantity || 0);
          subtotal += productTotal;
        }

        let couponDiscount = 0;
        let couponIdValue = null;
        if (coupon_code) {
          const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
          const couponResult = await queryRunner.query(
            `SELECT coupon_id, coupon_code, type, coupon_discount, status
             FROM coupon 
             WHERE UPPER(TRIM(coupon_code)) = $1 AND status = 1`,
            [normalizedCouponCode],
          );

          if (couponResult.length > 0) {
            const coupon = couponResult[0];
            couponIdValue = coupon.coupon_id;

            if (coupon.type === 'P') {
              couponDiscount = subtotal * (parseFloat(coupon.coupon_discount) / 100);
            } else if (coupon.type === 'F') {
              couponDiscount = parseFloat(coupon.coupon_discount);
            }
            couponDiscount = Math.min(couponDiscount, subtotal);
          }
        }

        const afterDiscount = subtotal - couponDiscount;
        const deliveryFeeAmountCalc = parseFloat(finalDeliveryFee || 0);
        resolvedOrderTotal = Math.round((afterDiscount + deliveryFeeAmountCalc) * 100) / 100;
        resolvedGst = Math.round((resolvedOrderTotal * (11 / 111)) * 100) / 100;
        resolvedCouponDiscount = couponDiscount;
        resolvedCouponId = couponIdValue;
      }

      const branch_id = finalLocationId || 1;
      const shipping_method = finalDeliveryMethod === 'pickup' ? 2 : 1;
      const user_id = userId || 1;

      const orderResult = await queryRunner.query(
        `UPDATE orders 
         SET customer_id = $1,
             location_id = $2,
             branch_id = $3,
             shipping_method = $4,
             delivery_date_time = $5,
             delivery_fee = $6,
             order_total = $7,
             order_comments = $8,
             coupon_id = $9,
             coupon_discount = $10,
             delivery_address = $11,
             delivery_method = $12,
             account_email = $13,
             cost_center = $14,
             delivery_contact = $15,
             delivery_details = $16,
             user_id = $17,
             order_status = $18,
             payment_status = $19,
             standing_order = $20,
             firstname = $21,
             lastname = $22,
             email = $23,
             telephone = $24,
             gst = $25,
             company_id = $26,
             department_id = $27,
             date_modified = CURRENT_TIMESTAMP
         WHERE order_id = $28
         RETURNING *`,
        [
          finalCustomerId,
          finalLocationId,
          branch_id,
          shipping_method,
          finalDeliveryDateTime,
          parseFloat(finalDeliveryFee || 0),
          resolvedOrderTotal,
          finalOrderComments,
          resolvedCouponId,
          resolvedCouponDiscount,
          finalDeliveryAddress,
          finalDeliveryMethod,
          finalAccountEmail,
          finalCostCenter,
          finalDeliveryContact,
          finalDeliveryDetails,
          user_id,
          finalOrderStatus,
          preservedPaymentStatus,
          finalStandingOrder,
          finalFirstname,
          finalLastname,
          finalEmail,
          finalTelephone,
          resolvedGst,
          finalCompanyId,
          finalDepartmentId,
          id,
        ],
      );

      if (!orderResult || orderResult.length === 0) {
        throw new NotFoundException('Order not found or cannot be updated');
      }

      const order = orderResult[0];

      // Create updated order products - ONLY if products were provided
      if (products && Array.isArray(products) && products.length > 0) {
        await queryRunner.query(`DELETE FROM order_product WHERE order_id = $1`, [id]);

        for (let index = 0; index < products.length; index++) {
          const product = products[index];
          const productTotal = (product.price || 0) * (product.quantity || 0);
          const sortOrder = product.sort_order !== undefined ? product.sort_order : index + 1;
          const excludeGst = product.exclude_gst !== undefined ? product.exclude_gst : 0;

          await queryRunner.query(
            `INSERT INTO order_product (order_id, product_id, quantity, price, total, order_product_comment, sort_order, exclude_gst)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              id,
              product.product_id,
              product.quantity,
              product.price,
              productTotal,
              product.comment || null,
              sortOrder,
              excludeGst,
            ],
          );
        }
      }

      await queryRunner.commitTransaction();

      return {
        order: order,
        message: 'Order updated successfully',
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update order ${id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(id: number, orderStatus: number, comment?: string): Promise<any> {
    const order = await this.orderRepository.findOne({ where: { order_id: id } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const oldStatus = order.order_status;
    const updateData: any = {
      order_status: Number(orderStatus),
      date_modified: new Date(),
    };

    if (comment) {
      if (orderStatus === 0) {
        updateData.cancel_comment = comment;
      } else if (orderStatus === 7 || orderStatus === 8) {
        updateData.approval_comments = comment;
      }
    }

    await this.orderRepository.update({ order_id: id }, updateData);

    // Send email notification for important status changes
    try {
      const orderData = await this.findOne(id);
      const orderDetails = orderData.order;
      const recipientEmail = orderDetails.customer_order_email || orderDetails.email || orderDetails.customer_email;

      if (recipientEmail && oldStatus !== orderStatus) {
        const statusMessages: Record<number, string> = {
          0: 'cancelled',
          2: 'paid',
          3: 'processing',
          4: 'awaiting approval',
          5: 'delivered',
          7: 'approved',
          8: 'rejected',
        };

        const statusMessage = statusMessages[orderStatus] || 'updated';
        const customerName = orderDetails.customer_order_name ||
          `${orderDetails.firstname || ''} ${orderDetails.lastname || ''}`.trim() ||
          'Customer';
        const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';

        // Only send email for important status changes
        if ([0, 2, 3, 5, 7, 8].includes(orderStatus)) {
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
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 5px; font-weight: bold; margin: 10px 0; }
    .status-paid { background-color: #28a745; color: white; }
    .status-processing { background-color: #17a2b8; color: white; }
    .status-completed { background-color: #28a745; color: white; }
    .status-cancelled { background-color: #dc3545; color: white; }
    .status-approved { background-color: #28a745; color: white; }
    .status-rejected { background-color: #dc3545; color: white; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>Order Status Update</h2>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Your order #${id} status has been updated.</p>
      
      <div style="margin: 20px 0;">
        <span class="status-badge status-${statusMessage.replace(' ', '-')}">${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}</span>
      </div>

      ${comment ? `<p><strong>Note:</strong> ${comment}</p>` : ''}

      <p>If you have any questions about your order, please don't hesitate to contact us.</p>
      
      <p>Thank you for choosing ${companyName}!</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
          `;

          await this.emailService.sendEmail({
            to: recipientEmail,
            subject: `Order #${id} Status Update - ${statusMessage.charAt(0).toUpperCase() + statusMessage.slice(1)}`,
            html: emailHtml,
            attachments: logoAttachment ? [logoAttachment] : [],
          });

          this.logger.log(`Order status update email sent to ${recipientEmail} for order #${id}`);
        }
      }
    } catch (emailError) {
      this.logger.error('Failed to send order status update email:', emailError);
      // Don't fail the status update if email fails
    }

    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const checkResult = await queryRunner.query(`SELECT order_id FROM orders WHERE order_id = $1`, [id]);

      if (checkResult.length === 0) {
        await queryRunner.rollbackTransaction();
        throw new NotFoundException('Order not found');
      }

      await queryRunner.query(
        `DELETE FROM order_product_option 
         WHERE order_product_id IN (
           SELECT order_product_id FROM order_product WHERE order_id = $1
         )`,
        [id],
      );

      await queryRunner.query(`DELETE FROM order_product WHERE order_id = $1`, [id]);
      await queryRunner.query(`DELETE FROM orders WHERE order_id = $1`, [id]);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Delete order error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getStats(): Promise<any> {
    const statsQuery = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_status = 1 THEN 1 END) as new_orders,
        COUNT(CASE WHEN order_status = 4 THEN 1 END) as pending_approval,
        COUNT(CASE WHEN order_status = 7 THEN 1 END) as approved,
        COUNT(CASE WHEN order_status = 5 THEN 1 END) as completed_orders,
        COUNT(CASE WHEN order_status = 2 THEN 1 END) as paid_orders
      FROM orders
      WHERE order_status NOT IN (0, 8)
      -- Exclude quotes (payment_status = 'quote')
      AND (payment_status IS NULL OR payment_status != 'quote')
      -- Note: Status 1 (New) orders ARE included, but quotes are excluded
    `;

    const statsResult = await this.dataSource.query(statsQuery);
    const stats = statsResult[0];

    const deliveriesTodayResult = await this.dataSource.query(`
      SELECT COUNT(*) as deliveries_today
      FROM orders
      WHERE order_status NOT IN (0, 8)
      AND order_status NOT IN (1, 9)
      -- Exclude quotes (payment_status = 'quote')
      AND (payment_status IS NULL OR payment_status != 'quote')
      AND delivery_date_time IS NOT NULL
      AND DATE(delivery_date_time) = CURRENT_DATE
    `);

    const productionResult = await this.dataSource.query(`
      SELECT COUNT(*) as production_orders
      FROM orders
      WHERE order_status = 7
    `);

    const revenueResult = await this.dataSource.query(`
      SELECT COALESCE(SUM(order_total), 0) as total_revenue
      FROM orders
      WHERE order_status IN (2, 7, 5)
    `);

    const todayResult = await this.dataSource.query(`
      SELECT COUNT(*) as today_orders
      FROM orders
      WHERE DATE(date_added) = CURRENT_DATE
      AND order_status NOT IN (0, 8)
      -- Exclude quotes (payment_status = 'quote')
      AND (payment_status IS NULL OR payment_status != 'quote')
      -- Include status 1 (New) orders, but exclude quotes
    `);

    // Get today's delivery orders with full details
    // Only show orders that are actually scheduled for delivery TODAY (not future orders)
    const todayOrdersQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.date_added,
        o.is_completed,
        o.customer_order_name,
        o.customer_from as order_made_from,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_status NOT IN (0, 8)
      -- Exclude quotes (payment_status = 'quote')
      AND (o.payment_status IS NULL OR o.payment_status != 'quote')
      -- Only show orders with delivery_date_time set to TODAY (not future dates)
      AND o.delivery_date_time IS NOT NULL
      AND DATE(o.delivery_date_time) = CURRENT_DATE
      ORDER BY o.delivery_date_time ASC, o.date_added DESC
      LIMIT 50
    `;
    const todayOrdersResult = await this.dataSource.query(todayOrdersQuery);
    const todayOrders = todayOrdersResult.map((row: any) => ({
      order_id: row.order_id,
      customer_order_name: row.customer_order_name || `${row.firstname || ''} ${row.lastname || ''}`.trim() || 'N/A',
      order_total: parseFloat(row.order_total || 0),
      order_status: row.order_status,
      date_added: row.date_added,
      delivery_date_time: row.delivery_date_time,
      is_completed: row.is_completed || 0,
      order_made_from: row.order_made_from,
      customer: {
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
      },
    }));

    // Get tomorrow's delivery orders
    // Use CURRENT_DATE + 1 to avoid timezone issues
    const tomorrowOrdersQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.date_added,
        o.is_completed,
        o.customer_order_name,
        o.customer_from as order_made_from,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_status NOT IN (0, 8)
      -- Exclude quotes (payment_status = 'quote')
      AND (o.payment_status IS NULL OR o.payment_status != 'quote')
      -- Only show orders scheduled for tomorrow
      AND o.delivery_date_time IS NOT NULL
      AND DATE(o.delivery_date_time) = CURRENT_DATE + 1
      ORDER BY o.delivery_date_time ASC, o.date_added DESC
      LIMIT 50
    `;
    const tomorrowOrdersResult = await this.dataSource.query(tomorrowOrdersQuery);
    const tomorrowOrders = tomorrowOrdersResult.map((row: any) => ({
      order_id: row.order_id,
      customer_order_name: row.customer_order_name || `${row.firstname || ''} ${row.lastname || ''}`.trim() || 'N/A',
      order_total: parseFloat(row.order_total || 0),
      order_status: row.order_status,
      date_added: row.date_added,
      delivery_date_time: row.delivery_date_time,
      is_completed: row.is_completed || 0,
      order_made_from: row.order_made_from,
      customer: {
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
      },
    }));

    // Get next 7 days orders
    const next7DaysStart = new Date();
    next7DaysStart.setDate(next7DaysStart.getDate() + 2);
    const next7DaysEnd = new Date();
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);
    const next7DaysStartStr = next7DaysStart.toISOString().split('T')[0];
    const next7DaysEndStr = next7DaysEnd.toISOString().split('T')[0];

    const next7DaysOrdersQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.date_added,
        o.is_completed,
        o.customer_order_name,
        o.customer_from as order_made_from,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_status NOT IN (0, 8)
      -- Include status 1 (New) orders
      AND o.delivery_date_time IS NOT NULL
      AND DATE(o.delivery_date_time) >= $1
      AND DATE(o.delivery_date_time) <= $2
      ORDER BY o.date_added DESC, o.delivery_date_time DESC
      LIMIT 100
    `;
    const next7DaysOrdersResult = await this.dataSource.query(next7DaysOrdersQuery, [next7DaysStartStr, next7DaysEndStr]);
    const next7DaysOrders = next7DaysOrdersResult.map((row: any) => ({
      order_id: row.order_id,
      customer_order_name: row.customer_order_name || `${row.firstname || ''} ${row.lastname || ''}`.trim() || 'N/A',
      order_total: parseFloat(row.order_total || 0),
      order_status: row.order_status,
      date_added: row.date_added,
      delivery_date_time: row.delivery_date_time,
      is_completed: row.is_completed || 0,
      order_made_from: row.order_made_from,
      customer: {
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
      },
    }));

    // Get recent orders (last 10)
    const recentOrdersQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.date_added,
        o.is_completed,
        o.customer_order_name,
        o.customer_from as order_made_from,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_status NOT IN (0, 8)
      -- Include status 1 (New) orders in recent orders
      ORDER BY o.date_added DESC
      LIMIT 10
    `;
    const recentOrdersResult = await this.dataSource.query(recentOrdersQuery);
    const recentOrders = recentOrdersResult.map((row: any) => ({
      order_id: row.order_id,
      customer_order_name: row.customer_order_name || `${row.firstname || ''} ${row.lastname || ''}`.trim() || 'N/A',
      order_total: parseFloat(row.order_total || 0),
      order_status: row.order_status,
      date_added: row.date_added,
      delivery_date_time: row.delivery_date_time,
      is_completed: row.is_completed || 0,
      order_made_from: row.order_made_from,
      customer: {
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
      },
    }));

    return {
      stats: {
        totalOrders: parseInt(stats.total_orders) || 0,
        newOrders: parseInt(stats.new_orders) || 0,
        pendingApproval: parseInt(stats.pending_approval) || 0,
        approved: parseInt(stats.approved) || 0,
        completed: parseInt(stats.completed_orders) || 0,
        paidOrders: parseInt(stats.paid_orders) || 0,
        todayOrders: parseInt(todayResult[0]?.today_orders) || 0,
        totalRevenue: parseFloat(revenueResult[0]?.total_revenue) || 0,
        deliveriesToday: parseInt(deliveriesTodayResult[0]?.deliveries_today) || 0,
        productionOrders: parseInt(productionResult[0]?.production_orders) || 0,
      },
      todayOrders,
      tomorrowOrders,
      next7DaysOrders,
      recentOrders,
    };
  }

  async getStDruexOrders(query: any): Promise<any> {
    const {
      limit = 50,
      offset = 0,
      status,
      search,
      past = false,
    } = query;

    const params: any[] = [];
    let paramIndex = 1;

    // Query for St Druex orders (company name contains "St Druex" or "St. Druex" or similar)
    let sqlQuery = `
      SELECT 
        o.order_id,
        o.order_total,
        o.order_status,
        o.delivery_date_time,
        o.date_added,
        o.order_comments,
        o.shipping_address_1,
        o.is_completed,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone,
        co.company_name,
        l.location_name,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'product_id', op.product_id,
              'product_name', COALESCE(p.product_name, 'Unknown Product'),
              'quantity', op.quantity,
              'price', op.price,
              'total', op.total
            ) ORDER BY op.order_product_id
          )
          FROM order_product op
          LEFT JOIN product p ON op.product_id = p.product_id
          WHERE op.order_id = o.order_id
        ), '[]'::json) as products
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      WHERE 1=1
      AND (
        co.company_name ILIKE '%St Druex%' 
        OR co.company_name ILIKE '%St. Druex%'
        OR co.company_name ILIKE '%StDruex%'
        OR o.customer_company_name ILIKE '%St Druex%'
        OR o.customer_company_name ILIKE '%St. Druex%'
        OR o.customer_company_name ILIKE '%StDruex%'
      )
    `;

    // Filter by completion status
    if (past) {
      // Show completed orders (status 7 or is_completed = 1)
      sqlQuery += ` AND (o.order_status = 7 OR o.is_completed = 1)`;
    } else {
      // Show non-completed orders (not status 7 and is_completed != 1)
      sqlQuery += ` AND o.order_status != 7 AND (o.is_completed IS NULL OR o.is_completed != 1)`;
    }

    // Filter by status if provided
    if (status !== undefined) {
      sqlQuery += ` AND o.order_status = $${paramIndex++}`;
      params.push(Number(status));
    }

    // Search filter
    if (search) {
      sqlQuery += ` AND (
        CAST(o.order_id AS TEXT) ILIKE $${paramIndex} OR
        c.firstname ILIKE $${paramIndex} OR
        c.lastname ILIKE $${paramIndex} OR
        CONCAT(c.firstname, ' ', c.lastname) ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM (${sqlQuery}) as count_query`;
    const countResult = await this.dataSource.query(countQuery, params);
    const count = parseInt(countResult[0].count);

    // Add ordering and pagination - latest orders first
    sqlQuery += ` ORDER BY o.date_added DESC, o.delivery_date_time DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    // Parse products JSON
    const orders = result.map((row: any) => {
      const products = typeof row.products === 'string' ? JSON.parse(row.products) : row.products || [];

      // Extract suburb and postcode from shipping address
      const address = row.shipping_address_1 || '';
      const addressParts = address.split(',').map((p: string) => p.trim());
      let suburb = '';
      let postcode = '';

      // Try to extract postcode (usually last part)
      const postcodeMatch = address.match(/\b\d{4}\b/);
      if (postcodeMatch) {
        postcode = postcodeMatch[0];
        const postcodeIndex = addressParts.findIndex((p: string) => p.includes(postcode));
        if (postcodeIndex > 0) {
          suburb = addressParts[postcodeIndex - 1];
        }
      }

      // Determine payment status
      // Check if there's a successful payment in payment_history OR order_status is 2 (Paid)
      let paymentStatus = 'Not Paid';
      const hasSuccessfulPayment = row.has_successful_payment || false;
      if (hasSuccessfulPayment || row.order_status === 2) {
        paymentStatus = 'Paid';
      } else if (row.order_status === 7 || row.is_completed === 1) {
        paymentStatus = 'Completed';
      }

      // Calculate summary
      const productCount = products.length;
      const productSummary = products.map((p: any) => `${p.product_name} (Qty: ${p.quantity})`).join(', ');

      return {
        order_id: row.order_id,
        customer_name: `${row.firstname || ''} ${row.lastname || ''}`.trim() || 'N/A',
        suburb_postcode: suburb && postcode ? `${suburb} ${postcode}` : (address || 'N/A'),
        suburb,
        postcode,
        address: row.shipping_address_1,
        status: paymentStatus,
        order_status: row.order_status,
        is_completed: row.is_completed || 0,
        notes: row.order_comments || '',
        order_total: parseFloat(row.order_total || 0),
        delivery_date_time: row.delivery_date_time,
        date_added: row.date_added,
        products,
        product_count: productCount,
        product_summary: productSummary,
        company_name: row.company_name,
        location_name: row.location_name,
      };
    });

    return {
      orders,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  async updateOrderNotes(id: number, notes: string, weight?: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if order exists
      const checkResult = await queryRunner.query(`SELECT order_id FROM orders WHERE order_id = $1`, [id]);
      if (checkResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      // Update order comments (notes)
      const updateQuery = `
        UPDATE orders 
        SET order_comments = $1,
            date_modified = NOW()
        WHERE order_id = $2
        RETURNING order_id, order_comments
      `;

      const result = await queryRunner.query(updateQuery, [notes, id]);

      await queryRunner.commitTransaction();

      return {
        order_id: result[0].order_id,
        notes: result[0].order_comments,
        weight: weight || null,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Update order notes error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async sendEmail(id: number, emailType: string = 'order_confirmation', customMessage?: string): Promise<any> {
    const orderData = await this.findOne(id);
    const order = orderData.order;

    const recipientEmail = order.customer_order_email || order.email || order.customer_email;

    if (!recipientEmail) {
      throw new BadRequestException('Customer email not found');
    }

    // Determine if this is a quote based on payment_status or explicitly requested
    const isQuote = order.payment_status === 'quote' ||
      emailType === 'quote' ||
      (order.order_status === 0 && order.standing_order === 0);

    const documentType = isQuote ? 'Quote' : 'Invoice';
    const emailSubject = isQuote ? `Quote #${order.order_id} from Caterly` : `Order Confirmation #${order.order_id}`;

    // Generate PDF buffer
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await this.invoiceService.generatePDFBuffer(id);
    } catch (error) {
      this.logger.error('Failed to generate PDF buffer for email:', error);
    }

    const logoAttachment = this.emailService.getLogoAttachment();
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; background-color: #fff; }
          .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; border-bottom: 3px solid #E03A3E; }
          .logo { max-width: 200px; height: auto; }
          .content { padding: 20px; }
          .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>Caterly</h1>`}
            <h2>${isQuote ? 'Quote' : 'Order Confirmation'}</h2>
          </div>
          <div class="content">
            <p>Dear ${order.customer_order_name || 'Customer'},</p>
            <p>Please find attached the ${documentType.toLowerCase()} for your ${isQuote ? 'requested quote' : 'order'} #${order.order_id}.</p>
            
            ${customMessage ? `<p>${customMessage}</p>` : ''}
            
            <p>Thank you for choosing Caterly!</p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact us at catering@caterly.com.au</p>
            <p>&copy; ${new Date().getFullYear()} Caterly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments: any[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `${documentType.toLowerCase()}-${order.order_id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    if (logoAttachment) {
      attachments.push(logoAttachment);
    }

    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: attachments,
    });

    return {
      message: `${documentType} email sent successfully`,
      sentTo: recipientEmail,
      type: documentType
    };
  }

  /**
   * Send payment link email to customer (SecurePay - matching caterly)
   */
  async sendPaymentLink(id: number, emailPayment?: string): Promise<any> {
    const orderData = await this.findOne(id);
    const order = orderData.order;

    // Calculate total amount (matching caterly logic)
    let total = parseFloat(order.order_total || 0);
    const deliveryFee = parseFloat(order.delivery_fee || 0);
    const lateFee = parseFloat(order.late_fee || 0);

    // Calculate coupon discount
    let couponDiscount = 0;
    if (order.coupon_id) {
      const couponQuery = await this.dataSource.query(
        `SELECT type, coupon_discount FROM coupon WHERE coupon_id = $1`,
        [order.coupon_id]
      );
      if (couponQuery.length > 0) {
        const coupon = couponQuery[0];
        if (coupon.type === 'F') {
          couponDiscount = parseFloat(coupon.coupon_discount || 0);
        } else {
          couponDiscount = (total + deliveryFee + lateFee) * (parseFloat(coupon.coupon_discount || 0) / 100);
        }
      }
    }

    const finalTotal = total + deliveryFee + lateFee - couponDiscount;

    // Determine recipient emails
    const customerEmail = order.email || order.customer_order_email;
    const emailToList = emailPayment
      ? [emailPayment]
      : customerEmail
        ? [customerEmail]
        : [];

    if (emailToList.length === 0) {
      throw new BadRequestException('No email address found for this order');
    }

    // Customer name
    const customerName = order.customer_order_name || `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Customer';

    // Generate auth token (same as invoice for consistency)
    const orderTotalValue = parseFloat(order.order_total || 0);
    const authToken = crypto
      .createHash('sha1')
      .update(`${customerName}|${customerName}|${id}|${orderTotalValue}`)
      .digest('hex');

    // Generate payment link (SecurePay route)
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000';
    const paymentLink = `${backendUrl}/store/payment/${id}/process?auth=${authToken}`;

    // Generate invoice download link
    const frontendUrl = this.configService.get<string>('STORE_PORTAL_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const invoiceLink = `${frontendUrl}/orders/${id}/invoice?auth=${authToken}`;
    const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
    const companyPhone = this.configService.get<string>('COMPANY_PHONE') || '1300 827 286';

    // Prepare email content (matching caterly format)
    const emailSubject = `Payment Request - Order #${id} - ${companyName}`;

    const logoAttachment = this.emailService.getLogoAttachment();
    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .logo { max-width: 200px; height: auto; }
  </style>
</head>
<body style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 825px; margin: 0 auto; background-color: #fff;">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1 style="color: #E03A3E;">${companyName}</h1>`}
    </div>
    <div style="padding: 25px;">
      <p style="margin: 0; font-size: 18px; line-height: 21px;">
        Dear ${customerName},
      </p>
      <p style="margin: 0; font-size: 18px; line-height: 21px; margin-top: 10px;">
        Thank you for ordering with us.
      </p>
      
      <div style="margin-top: 20px;">
        <p style="margin: 0; font-size: 18px; line-height: 21px;">
          <strong>Please click on the payment button below to make payment for your order #${id}:</strong>
        </p>
        <p style="margin-top: 20px;">
          <a href="${paymentLink}" style="background-color: #E03A3E; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 700;">
            Click here to pay
          </a>
        </p>
        <p style="margin-top: 20px;">
          <a href="${invoiceLink}" style="background-color: #E03A3E; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 700;">
            View PDF Invoice
          </a>
        </p>
        <p style="margin-top: 20px;">Please call us on ${companyPhone} for any queries.</p>
      </div>
      
      <div style="margin-top: 20px; font-size: 18px; line-height: 24px;">
        <p><strong>Note:</strong> Payment must be made 7 days from the delivery date. Late payment fees will incur after 21 days.</p>
        <p>Thank you and have a great day!</p>
        <br/>
        <p>Kind Regards,<br/>${companyName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using centralized email service
    let emailSent = false;
    let emailError: string | null = null;

    try {
      const attachments: any[] = [];
      if (logoAttachment) {
        attachments.push(logoAttachment);
      }

      const emailResult = await this.emailService.sendEmail({
        to: emailToList,
        subject: emailSubject,
        html: emailBody,
        attachments: attachments,
      });

      if (emailResult.success) {
        emailSent = true;
      } else {
        emailError = emailResult.error || 'Email sending failed';
      }
    } catch (err: any) {
      emailError = err.message || 'Unknown error';
      this.logger.error("Email sending error:", err);
    }

    this.logger.log(`Payment link email ${emailSent ? 'sent' : 'failed'} to ${emailToList.join(', ')} for order #${id}`);

    return {
      success: emailSent,
      message: emailSent
        ? "Payment link email sent successfully"
        : emailError
          ? `Failed to send email: ${emailError}`
          : "Payment link email prepared (email service not configured)",
      sent_to: emailToList,
      payment_link: paymentLink,
      invoice_link: invoiceLink,
      email_sent: emailSent,
      error: emailError || undefined,
    };
  }

  async getChecklist(orderId: number): Promise<any> {
    try {
      const checklistQuery = `
        SELECT * FROM order_checklist
        WHERE order_id = $1
        LIMIT 1
      `;
      const result = await this.dataSource.query(checklistQuery, [orderId]);

      if (result.length === 0) {
        // Return default empty checklist
        return {
          checklist: {
            catering_location: false,
            catering_time: false,
            catering_people: false,
            catering_delivery_instructions: false,
            catering_dietary_req: false,
            day_before_location: false,
            day_before_time: false,
            day_before_people: false,
            day_before_delivery_instructions: false,
            day_before_dietary_req: false,
            delivery_day_check_everything: false,
            delivery_day_cutlery: false,
            delivery_day_cups: false,
            delivery_day_coffee_tea: false,
            delivery_day_sugar: false,
            delivery_day_plates: false,
            delivery_day_signs: false,
            delivery_day_hot_cold: false,
            delivery_day_safety_pins: false,
            delivering_check_right_order: false,
            delivering_greet_introduce: false,
            delivering_ask_setup_area: false,
            delivering_introduce_service: false,
            delivering_setup_specifications: false,
            delivering_cover_everything: false,
            delivering_remind_questions: false,
            delivering_wish_great_day: false,
          },
        };
      }

      return { checklist: result[0] };
    } catch (error) {
      this.logger.error(`Error getting checklist for order ${orderId}:`, error);
      throw error;
    }
  }

  async updateChecklist(orderId: number, checklistData: any): Promise<any> {
    try {
      // Verify order exists
      const orderCheck = await this.dataSource.query(
        `SELECT order_id FROM orders WHERE order_id = $1`,
        [orderId],
      );

      if (orderCheck.length === 0) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Define all checklist fields
      const fields = [
        'catering_location', 'catering_time', 'catering_people', 'catering_delivery_instructions', 'catering_dietary_req',
        'day_before_location', 'day_before_time', 'day_before_people', 'day_before_delivery_instructions', 'day_before_dietary_req',
        'delivery_day_check_everything', 'delivery_day_cutlery', 'delivery_day_cups', 'delivery_day_coffee_tea',
        'delivery_day_sugar', 'delivery_day_plates', 'delivery_day_signs', 'delivery_day_hot_cold', 'delivery_day_safety_pins',
        'delivering_check_right_order', 'delivering_greet_introduce', 'delivering_ask_setup_area', 'delivering_introduce_service',
        'delivering_setup_specifications', 'delivering_cover_everything', 'delivering_remind_questions', 'delivering_wish_great_day',
      ];

      // Check if checklist exists
      const checkQuery = `SELECT * FROM order_checklist WHERE order_id = $1`;
      const checkResult = await this.dataSource.query(checkQuery, [orderId]);

      // Prepare values array
      const values = fields.map(field => checklistData[field] || false);

      if (checkResult.length === 0) {
        // Insert new checklist
        const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
        const insertQuery = `
          INSERT INTO order_checklist (
            order_id, ${fields.join(', ')}, updated_at
          ) VALUES ($1, ${placeholders}, NOW())
          RETURNING *
        `;
        const result = await this.dataSource.query(insertQuery, [orderId, ...values]);
        return { message: 'Checklist created successfully', checklist: result[0] };
      } else {
        // Update existing checklist
        const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
        const updateQuery = `
          UPDATE order_checklist SET
            ${setClause}, updated_at = NOW()
          WHERE order_id = $1
          RETURNING *
        `;
        const result = await this.dataSource.query(updateQuery, [orderId, ...values]);
        return { message: 'Checklist updated successfully', checklist: result[0] };
      }
    } catch (error) {
      this.logger.error(`Error updating checklist for order ${orderId}:`, error);
      throw error;
    }
  }

  async updatePreparedStatus(orderId: number, productId: number, isPrepared: boolean): Promise<any> {
    try {
      // Verify order exists
      const orderCheck = await this.dataSource.query(
        `SELECT order_id FROM orders WHERE order_id = $1`,
        [orderId],
      );

      if (orderCheck.length === 0) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Check if is_prepared column exists, if not add it
      // const columnCheck = await this.dataSource.query(`
      //   SELECT column_name 
      //   FROM information_schema.columns 
      //   WHERE table_name = 'order_product' AND column_name = 'is_prepared'
      // `);

      // if (columnCheck.length === 0) {
      //   // Add is_prepared column if it doesn't exist
      //   await this.dataSource.query(`
      //     ALTER TABLE order_product 
      //     ADD COLUMN IF NOT EXISTS is_prepared BOOLEAN DEFAULT FALSE
      //   `);
      // }

      const updateQuery = `
        UPDATE order_product
        SET is_prepared = $1
        WHERE order_id = $2 AND order_product_id = $3
        RETURNING *
      `;
      const result = await this.dataSource.query(updateQuery, [isPrepared, orderId, productId]);

      if (result.length === 0) {
        throw new NotFoundException('Order product not found');
      }

      return {
        message: 'Product prepared status updated',
        product: result[0],
      };
    } catch (error) {
      this.logger.error(`Error updating prepared status for order ${orderId}, product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Update late fees for multiple orders
   */
  async updateLateFees(orderIds: number[], lateFee: number): Promise<any> {
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException('At least one order ID is required');
    }

    if (lateFee < 0) {
      throw new BadRequestException('Late fee must be a positive number');
    }

    // Remove duplicates and ensure all IDs are valid numbers
    const uniqueOrderIds = [...new Set(orderIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0))];

    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('No valid order IDs provided');
    }

    this.logger.log(`Updating late fees for ${uniqueOrderIds.length} order(s): ${uniqueOrderIds.join(', ')}`);

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Update late fees for all selected orders
        const placeholders = uniqueOrderIds.map((_, index) => `$${index + 1}`).join(', ');
        const updateQuery = `
          UPDATE orders 
          SET late_fee = $${uniqueOrderIds.length + 1},
              date_modified = CURRENT_TIMESTAMP
          WHERE order_id IN (${placeholders})
          RETURNING order_id, late_fee
        `;

        const result = await queryRunner.query(
          updateQuery,
          [...uniqueOrderIds, lateFee]
        );

        this.logger.log(`Successfully updated ${result.length} order(s) with late fee`);

        await queryRunner.commitTransaction();

        return {
          success: true,
          message: `Late fee of $${lateFee.toFixed(2)} applied to ${result.length} order(s)`,
          updated_orders: result.length,
          orders: result,
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      this.logger.error('Error updating late fees:', error);
      throw error;
    }
  }

  /**
   * Mark order as complete (finished preparing)
   * Sets is_completed = 1, does NOT change order_status or payment status
   */
  async complete(id: number): Promise<any> {
    // Check if order exists
    const orderCheck = await this.dataSource.query(
      `SELECT order_id FROM orders WHERE order_id = $1`,
      [id]
    );

    if (orderCheck.length === 0) {
      throw new NotFoundException('Order not found');
    }

    // Update is_completed flag only (not order_status) using raw query
    const updateQuery = `
      UPDATE orders 
      SET is_completed = 1,
          date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *
    `;

    await this.dataSource.query(updateQuery, [id]);

    // Get updated order with all details
    const updatedOrder = await this.findOne(id);

    return {
      message: 'Order marked as complete',
      status: 'complete',
      order: updatedOrder.order,
    };
  }

  /**
   * Mark order as delivered
   * Sets order_status = 5 and is_completed = 1
   */
  async deliver(id: number): Promise<any> {
    // Check if order exists
    const orderCheck = await this.dataSource.query(
      `SELECT order_id FROM orders WHERE order_id = $1`,
      [id]
    );

    if (orderCheck.length === 0) {
      throw new NotFoundException('Order not found');
    }

    // Update order_status to 5 (Delivered) and is_completed = 1
    const updateQuery = `
      UPDATE orders 
      SET order_status = 5,
          is_completed = 1,
          date_modified = CURRENT_TIMESTAMP
      WHERE order_id = $1
      RETURNING *
    `;

    await this.dataSource.query(updateQuery, [id]);

    // Get updated order with all details
    const updatedOrder = await this.findOne(id);

    return {
      message: 'Order marked as delivered',
      status: 'delivered',
      order: updatedOrder.order,
    };
  }
}
