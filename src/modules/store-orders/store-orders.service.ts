import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';
import { EmailService } from '../../common/services/email.service';
import { InvoiceService } from '../../common/services/invoice.service';
import * as crypto from 'crypto';

@Injectable()
export class StoreOrdersService implements OnModuleInit {
  private readonly logger = new Logger(StoreOrdersService.name);

  constructor(
    private dataSource: DataSource,
    private notificationsService: AdminNotificationsService,
    private emailService: EmailService,
    private configService: ConfigService,
    private invoiceService: InvoiceService,
  ) { }

  async onModuleInit() {
    try {
      this.logger.log('Ensuring orders table supports guest checkouts...');
      // Drop NOT NULL constraint on customer_id to allow guest orders
      await this.dataSource.query(`ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;`);
      // Also ensure firstname, lastname, email, telephone are nullable (though they should be already)
      await this.dataSource.query(`ALTER TABLE orders ALTER COLUMN firstname DROP NOT NULL;`);
      await this.dataSource.query(`ALTER TABLE orders ALTER COLUMN lastname DROP NOT NULL;`);
      await this.dataSource.query(`ALTER TABLE orders ALTER COLUMN email DROP NOT NULL;`);
      await this.dataSource.query(`ALTER TABLE orders ALTER COLUMN telephone DROP NOT NULL;`);

      this.logger.log('Orders table updated successfully.');
    } catch (error) {
      this.logger.warn('Failed to update orders table schema (it might already be updated): ' + error.message);
    }
  }

  /**
   * Create order (checkout)
   */
  async createOrder(
    userId: number | null,
    orderData: {
      items: any[];
      firstname?: string;
      lastname?: string;
      email?: string;
      telephone?: string;
      delivery_address: string;
      delivery_date?: string;
      delivery_start_date?: string;
      delivery_time?: string;
      standing_order?: number;
      frequency_unit?: 'days' | 'weeks' | 'months';
      frequency_value?: number;
      delivery_frequency?: string;
      delivery_fee?: number;
      payment_method?: string;
      notes?: string;
      coupon_code?: string;
      postcode?: string;
      gst_status?: number;
      location_id?: number;
      name?: string;
    },
  ) {
    const {
      items,
      firstname,
      lastname,
      email,
      telephone,
      delivery_address,
      delivery_date,
      delivery_start_date,
      delivery_time,
      standing_order,
      frequency_unit,
      frequency_value,
      delivery_frequency,
      delivery_fee = 0,
      payment_method,
      notes,
      coupon_code,
      postcode,
      gst_status,
      location_id,
      name,
    } = orderData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Order items are required');
    }

    if (!delivery_address) {
      throw new BadRequestException('Delivery address is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let customer: any = null;
      if (userId) {
        // Get customer with customer_type
        const customerQuery = `
          SELECT c.customer_id, c.telephone, c.email, c.customer_type, c.company_id, c.department_id, c.firstname, c.lastname
          FROM customer c 
          WHERE c.user_id = $1
        `;
        const customerResult = await queryRunner.query(customerQuery, [userId]);
        customer = customerResult[0];

        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
      }

      // Get customer product option discounts (option-level)
      const optionDiscountsMap = new Map();
      // Get customer product discounts (product-level)
      const productDiscountsMap = new Map();

      if (customer) {
        const optionDiscountQuery = `
          SELECT product_id, option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1
        `;
        const optionDiscountResult = await queryRunner.query(optionDiscountQuery, [customer.customer_id]);
        optionDiscountResult.forEach((row: any) => {
          const key = `${row.product_id}_${row.option_value_id}`;
          optionDiscountsMap.set(key, parseFloat(row.discount_percentage));
        });
      }

      if (customer) {
        // Get product-level discounts
        const productDiscountQuery = `
          SELECT product_id, discount_percentage
          FROM customer_product_discount
          WHERE customer_id = $1
        `;
        const productDiscountResult = await queryRunner.query(productDiscountQuery, [customer.customer_id]);
        productDiscountResult.forEach((row: any) => {
          productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
        });
      }

      // Calculate order total with product-option-level and product-level discounts
      let subtotal = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        const productQuery = `
          SELECT product_id, product_name, product_price
          FROM product 
          WHERE product_id = $1 AND product_status = 1
        `;
        const productResult = await queryRunner.query(productQuery, [item.product_id]);
        const product = productResult[0];

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }

        // Calculate product base price
        const productPrice = parseFloat(product.product_price);
        let itemTotal = productPrice * item.quantity;

        // Check if product has options
        const hasOptions = item.options && item.options.length > 0;

        if (hasOptions) {
          // Product has options - apply option-level discounts
          for (const option of item.options) {
            if (option.option_value_id) {
              const discountKey = `${product.product_id}_${option.option_value_id}`;
              const discountPercentage = optionDiscountsMap.get(discountKey) || 0;

              if (discountPercentage > 0 && option.option_price) {
                const optionPrice = parseFloat(option.option_price);
                const discountAmount = optionPrice * (discountPercentage / 100);
                itemTotal += (optionPrice - discountAmount) * item.quantity;
              } else if (option.option_price) {
                itemTotal += parseFloat(option.option_price) * item.quantity;
              }
            }
          }
        } else {
          // Product has no options - apply product-level discount
          const productDiscountPercentage = productDiscountsMap.get(product.product_id) || 0;

          if (productDiscountPercentage > 0) {
            const discountAmount = itemTotal * (productDiscountPercentage / 100);
            itemTotal = itemTotal - discountAmount;
          }
        }

        subtotal += itemTotal;

        orderItems.push({
          product_id: product.product_id,
          product_name: product.product_name,
          quantity: item.quantity,
          price: product.product_price,
          total: itemTotal,
          options: item.options || [],
          item_comments: item.item_comments || null,
        });
      }

      let wholesaleDiscount = 0;
      const customerType = customer?.customer_type || 'Retail';
      const isWholesale = customerType && (customerType.includes('Wholesale') || customerType.includes('Wholesaler'));

      if (isWholesale) {
        const discountPercentage = customerType.includes('Full Service') ? 15 : 10;
        wholesaleDiscount = subtotal * (discountPercentage / 100);
      }

      const afterWholesaleDiscount = subtotal - wholesaleDiscount;

      // Apply coupon if provided (after wholesale discount)
      let couponDiscount = 0;
      let couponId = null;

      if (coupon_code) {
        // Trim whitespace and make case-insensitive lookup
        const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
        const couponQuery = `
          SELECT * FROM coupon 
          WHERE UPPER(TRIM(coupon_code)) = $1 AND status = 1
        `;
        const couponResult = await queryRunner.query(couponQuery, [normalizedCouponCode]);
        const coupon = couponResult[0];

        if (coupon) {
          couponId = coupon.coupon_id;
          // Apply coupon discount after wholesale discount
          if (coupon.type === 'P') {
            couponDiscount = afterWholesaleDiscount * (parseFloat(coupon.coupon_discount) / 100);
          } else if (coupon.type === 'F') {
            couponDiscount = parseFloat(coupon.coupon_discount);
          }
          couponDiscount = Math.min(couponDiscount, afterWholesaleDiscount);
        }
      }

      const afterDiscount = afterWholesaleDiscount - couponDiscount;
      const deliveryFee = parseFloat((delivery_fee || 0).toString());
      const gstStatus = Number(gst_status || 0);
      const baseTotal = afterDiscount + deliveryFee;
      // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
      // Use original subtotal for GST calculation to match storefront display
      const gst = gstStatus ? Math.round(subtotal * 0.11 * 100) / 100 : 0;
      // GST is not added to total for Caterly
      const total = Math.round(baseTotal * 100) / 100;

      let parsedUnit = frequency_unit;
      let parsedValue = frequency_value;
      if (!parsedUnit && !parsedValue && delivery_frequency) {
        const s = (delivery_frequency || '').toLowerCase().trim();
        const m = s.match(/(\d+)\s*(day|week|month)s?/);
        if (m) {
          parsedValue = parseInt(m[1], 10);
          parsedUnit = (m[2] + 's') as 'days' | 'weeks' | 'months';
        } else if (s.includes('daily')) {
          parsedUnit = 'days';
          parsedValue = 1;
        } else if (s.includes('weekly')) {
          parsedUnit = 'weeks';
          parsedValue = 1;
        } else if (s.includes('monthly')) {
          parsedUnit = 'months';
          parsedValue = 1;
        }
      }
      let standingOrderDays = 0;
      if (typeof standing_order === 'number' && standing_order > 0) {
        standingOrderDays = Math.floor(standing_order);
      } else if (parsedUnit && typeof parsedValue === 'number' && parsedValue > 0) {
        const val = Math.floor(parsedValue);
        if (parsedUnit === 'days') standingOrderDays = val;
        else if (parsedUnit === 'weeks') standingOrderDays = val * 7;
        else if (parsedUnit === 'months') standingOrderDays = val * 30;
      }

      let deliveryDateTime = new Date();
      const startDateInput = delivery_start_date || delivery_date;
      if (startDateInput) {
        const [datePart, timePart] = startDateInput.split('T');
        if (timePart) {
          deliveryDateTime = new Date(startDateInput);
        } else if (delivery_time) {
          deliveryDateTime = new Date(`${startDateInput} ${delivery_time}`);
        } else {
          deliveryDateTime = new Date(startDateInput);
        }
      }

      // Create order
      const orderQuery = `
        INSERT INTO orders (
          customer_id,
          branch_id,
          shipping_method,
          order_total,
          order_status,
          delivery_date_time,
          delivery_fee,
          delivery_address,
          delivery_phone,
          delivery_email,
          postcode,
          order_comments,
          pickup_delivery_notes,
          user_id,
          coupon_id,
          coupon_discount,
          gst_status,
          standing_order,
          firstname,
          lastname,
          email,
          telephone,
          company_id,
          department_id,
          customer_order_name,
          customer_order_email,
          customer_order_telephone,
          location_id,
          gst,
          delivery_frequency,
          delivery_start_date,
          delivery_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
        RETURNING order_id
      `;

      const orderResult = await queryRunner.query(orderQuery, [
        customer?.customer_id || null,
        1, // branch_id
        1, // shipping_method
        total,
        10, // order_status = pending payment (10)
        deliveryDateTime,
        deliveryFee,
        delivery_address,
        telephone || customer?.telephone || null,
        email || customer?.email || null,
        parseInt((postcode || '3000').toString()) || 3000,
        (notes && notes.trim()) || null,
        (notes && notes.trim()) || null,
        userId || null,
        couponId,
        couponDiscount,
        gstStatus,
        standingOrderDays,
        firstname || (name ? name.split(' ')[0] : null),
        lastname || (name ? name.split(' ').slice(1).join(' ') : null),
        email || null,
        telephone || null,
        customer?.company_id || null,
        customer?.department_id || null,
        name || (firstname || lastname ? `${firstname || ''} ${lastname || ''}`.trim() : null) || customer?.name || `${customer?.firstname || ''} ${customer?.lastname || ''}`.trim() || 'Guest',
        email || customer?.email || null,
        telephone || customer?.telephone || null,
        location_id || 1,
        gst,
        delivery_frequency || null,
        delivery_start_date || null,
        delivery_time || null
      ]);

      const orderId = orderResult[0].order_id;

      // Add order products
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
        const orderProductQuery = `
          INSERT INTO order_product (
            order_id,
            product_id,
            quantity,
            price,
            total,
            sort_order,
            order_product_comment
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING order_product_id
        `;

        const opResult = await queryRunner.query(orderProductQuery, [
          orderId,
          item.product_id,
          item.quantity,
          item.price,
          item.total,
          i + 1,
          item.item_comments || null,
        ]);

        const orderProductId = opResult[0].order_product_id;

        // Add order product options
        if (item.options && item.options.length > 0) {
          for (const option of item.options) {
            let productOptionId = option.product_option_id || option.option_id;
            if (!productOptionId && option.option_value_id) {
              const poQuery = await queryRunner.query(
                `SELECT product_option_id FROM product_option 
                 WHERE product_id = $1 AND option_value_id = $2 
                 LIMIT 1`,
                [item.product_id, option.option_value_id],
              );
              if (poQuery.length > 0) {
                productOptionId = poQuery[0].product_option_id;
              }
            }

            if (!productOptionId) {
              productOptionId = 0;
            }

            const optionQuantity = option.quantity || 1;
            const optionPrice = parseFloat((option.price || option.option_price || 0).toString());
            const optionTotal = optionPrice * optionQuantity;

            const optionQuery = `
              INSERT INTO order_product_option (
                order_id,
                order_product_id,
                product_option_id,
                option_name,
                option_value,
                option_quantity,
                option_price,
                option_total
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;

            await queryRunner.query(optionQuery, [
              orderId,
              orderProductId,
              productOptionId,
              option.option_name || '',
              option.option_value || '',
              optionQuantity,
              optionPrice,
              optionTotal,
            ]);
          }
        }

        // Stock management not implemented - product table doesn't have product_quantity column
        // TODO: Add stock management if needed in the future
      }

      // Update coupon usage if applicable
      if (couponId) {
        try {
          const columnCheck = await queryRunner.query(
            `SELECT 1 FROM information_schema.columns WHERE table_name = 'coupon' AND column_name = 'uses_total' LIMIT 1`
          );
          const hasColumn =
            Array.isArray(columnCheck)
              ? columnCheck.length > 0
              : (columnCheck?.rows?.length || 0) > 0;
          if (hasColumn) {
            const updateCouponQuery = `
              UPDATE coupon 
              SET uses_total = COALESCE(uses_total, 0) + 1
              WHERE coupon_id = $1
            `;
            await queryRunner.query(updateCouponQuery, [couponId]);
          }
        } catch (err) {
          try {
            const fallbackUpdate = `
              UPDATE coupon 
              SET uses_total = uses_total + 1
              WHERE coupon_id = $1
            `;
            await queryRunner.query(fallbackUpdate, [couponId]);
          } catch (_) { }
        }
      }

      await queryRunner.commitTransaction();

      // Get complete order details
      const completeOrderQuery = `
        SELECT 
          o.*,
          c.firstname as account_firstname,
          c.lastname as account_lastname,
          c.email as account_email,
          c.telephone as account_telephone
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `;
      const completeOrder = await this.dataSource.query(completeOrderQuery, [orderId]);

      // Admin notification will be sent after successful payment
      /*
      if (this.notificationsService) {
        ...
      }
      */

      // Order confirmation email will be sent after successful payment
      /*
      try {
        ...
      } catch (emailError) {
        ...
      }
      */

      // Get coupon code if coupon was applied
      let couponCode = null;
      if (couponId) {
        const couponCodeQuery = `SELECT coupon_code FROM coupon WHERE coupon_id = $1`;
        const couponCodeResult = await this.dataSource.query(couponCodeQuery, [couponId]);
        couponCode = couponCodeResult[0]?.coupon_code || null;
      }

      return {
        message: 'Order created successfully. Please complete payment to place your order.',
        order: {
          ...completeOrder[0],
          items: orderItems,
          subtotal,
          wholesale_discount: wholesaleDiscount,
          coupon_discount: couponDiscount,
          coupon_code: couponCode,
          total_discount: wholesaleDiscount + couponDiscount,
          after_wholesale_discount: afterWholesaleDiscount,
          after_discount: afterDiscount,
          gst,
          delivery_fee: deliveryFee,
          total,
        },
        order_id: orderId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get customer orders
   */
  async listOrders(userId: number, page: number = 1, limit: number = 10) {
    const offset = (Number(page) - 1) * Number(limit);

    // Get customer
    const customerQuery = `SELECT customer_id FROM customer WHERE user_id = $1`;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);
    const customer = customerResult[0];

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get orders
    const ordersQuery = `
      SELECT 
        o.order_id,
        o.order_total as total,
        o.gst,
        o.order_status,
        o.date_added,
        o.delivery_date_time,
        o.delivery_address,
        o.delivery_frequency,
        o.delivery_start_date,
        co.company_name,
        d.department_name,
        loc.location_name,
        loc.company_name as location_company_name,
        loc.abn as location_abn,
        loc.remittance_email as location_email,
        loc.pickup_address as location_address,
        loc.contact as location_phone,
        COALESCE(COUNT(op.order_product_id), 0)::integer as item_count
      FROM orders o
      LEFT JOIN order_product op ON o.order_id = op.order_id
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN locations loc ON o.location_id = loc.location_id
      WHERE o.customer_id = $1
      GROUP BY o.order_id, o.order_total, o.order_status, o.date_added, o.delivery_date_time, o.delivery_address, co.company_name, d.department_name, loc.location_name, loc.company_name, loc.abn, loc.remittance_email, loc.pickup_address, loc.contact
      ORDER BY o.date_added DESC
      LIMIT $2 OFFSET $3
    `;

    const ordersResult = await this.dataSource.query(ordersQuery, [
      customer.customer_id,
      Number(limit),
      offset,
    ]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*)::integer as total 
      FROM orders 
      WHERE customer_id = $1
    `;
    const countResult = await this.dataSource.query(countQuery, [customer.customer_id]);
    const total = parseInt(countResult[0]?.total || '0', 10);

    return {
      orders: ordersResult || [],
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        total: total || 0,
        total_pages: Math.ceil((total || 0) / (Number(limit) || 10)),
      },
    };
  }

  /**
   * Get single guest order details (for payment)
   */
  async getGuestOrder(orderId: number, auth?: string) {
    // 1. First find if a token was provided and if it is valid
    let tokenVerified = false;
    if (auth) {
      tokenVerified = await this.verifyInvoiceToken(orderId, auth);
    }

    // Get order with coupon info
    // If token is verified, we allow fetching any order by ID (regardless of guest status)
    let orderQuery = `
      SELECT 
        o.*,
        cp.coupon_code,
        cp.type as coupon_type,
        co.company_name,
        d.department_name,
        loc.location_name,
        loc.company_name as location_company_name,
        loc.abn as location_abn,
        loc.remittance_email as location_email,
        loc.pickup_address as location_address,
        loc.contact as location_phone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      LEFT JOIN locations loc ON o.location_id = loc.location_id
      WHERE o.order_id = $1
    `;

    // If no valid token, strictly limit to genuine guest orders (no user/customer ID)
    if (!tokenVerified) {
      orderQuery += ` AND (o.customer_id IS NULL OR o.user_id IS NULL)`;
    }

    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    const order = orderResult[0];

    if (!order) {
      throw new NotFoundException('Guest order not found');
    }

    // Get order products with product names
    const productsQuery = `
      SELECT 
        op.*,
        p.product_name,
        p.product_image
      FROM order_product op
      LEFT JOIN product p ON op.product_id = p.product_id
      WHERE op.order_id = $1
      ORDER BY op.sort_order, op.order_product_id
    `;
    const productsResult = await this.dataSource.query(productsQuery, [orderId]);

    // Get order product options for each product
    const items: any[] = [];
    let subtotal = 0;

    for (const product of productsResult) {
      const optionsQuery = `
        SELECT * FROM order_product_option 
        WHERE order_product_id = $1
      `;
      const optionsResult = await this.dataSource.query(optionsQuery, [product.order_product_id]);

      // Calculate item total - product.total already includes quantity and options
      const itemTotal = product.total ? parseFloat(product.total) : parseFloat(product.price || '0') * parseInt(product.quantity || '1', 10);
      subtotal += itemTotal;

      items.push({
        ...product,
        options: optionsResult,
        item_total: itemTotal,
      });
    }

    const afterDiscount = subtotal; // Assuming no discounts for guest order for now as per code
    // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
    // Recalculate 11% of subtotal (after discount) consistently
    const gstValue = Math.round(afterDiscount * 0.11 * 100) / 100;

    // Ensure frontend gets total consistently
    order.total = order.order_total;
    order.gst = gstValue;

    return {
      order: {
        ...order,
        subtotal,
        items,
      },
    };
  }

  /**
   * Get single order details
   */
  async getOrder(userId: number, orderId: number) {
    // 1. Get order with coupon info first
    const orderQuery = `
      SELECT 
        o.*,
        cp.coupon_code,
        cp.type as coupon_type,
        co.company_name,
        d.department_name,
        loc.location_name,
        loc.company_name as location_company_name,
        loc.abn as location_abn,
        loc.remittance_email as location_email,
        loc.pickup_address as location_address,
        loc.contact as location_phone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      LEFT JOIN locations loc ON o.location_id = loc.location_id
      WHERE o.order_id = $1
    `;

    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    const order = orderResult[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 2. Clear customer lookup to verify ownership
    const customerQuery = `
      SELECT c.customer_id, c.customer_type 
      FROM customer c 
      WHERE c.user_id = $1
    `;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);
    const customer = customerResult[0];
    const customerId = customer?.customer_id || null;

    // Verify ownership: must match either user_id OR customer_id
    const isOwner = (order.user_id && Number(order.user_id) === Number(userId)) ||
      (order.customer_id && customerId && Number(order.customer_id) === Number(customerId));

    if (!isOwner) {
      throw new NotFoundException('Order not found or access denied');
    }

    // Ensure frontend gets total consistently
    order.total = order.order_total;

    // Get order products with product names
    const productsQuery = `
      SELECT 
        op.*,
        op.order_product_comment as item_comments,
        p.product_name,
        p.product_image
      FROM order_product op
      LEFT JOIN product p ON op.product_id = p.product_id
      WHERE op.order_id = $1
      ORDER BY op.sort_order, op.order_product_id
    `;
    const productsResult = await this.dataSource.query(productsQuery, [orderId]);

    // Get order product options for each product
    const items: any[] = [];
    let subtotal = 0;

    for (const product of productsResult) {
      const optionsQuery = `
        SELECT * FROM order_product_option 
        WHERE order_product_id = $1
      `;
      const optionsResult = await this.dataSource.query(optionsQuery, [product.order_product_id]);

      // Calculate item total - product.total already includes quantity and options
      const itemTotal = product.total ? parseFloat(product.total) : parseFloat(product.price || '0') * parseInt(product.quantity || '1', 10);
      subtotal += itemTotal;

      items.push({
        product_id: product.product_id,
        product_name: product.product_name || 'Unknown Product',
        quantity: parseInt(product.quantity || '1', 10),
        price: parseFloat(product.price || '0'),
        total: itemTotal,
        product_image: product.product_image,
        item_comments: product.item_comments || null,
        options: optionsResult.map((opt: any) => ({
          option_name: opt.option_name,
          option_value: opt.option_value,
          option_quantity: opt.option_quantity,
        })),
      });
    }

    // Calculate breakdown
    const orderTotal = parseFloat(order.order_total || '0');
    const deliveryFee = parseFloat(order.delivery_fee || '0');

    // Calculate wholesale discount based on customer type
    let wholesaleDiscount = 0;
    const customerType = customer.customer_type || 'Retail';
    const isWholesale = customerType && (customerType.includes('Wholesale') || customerType.includes('Wholesaler'));

    if (isWholesale) {
      const discountPercentage = customerType.includes('Full Service') ? 15 : 10;
      wholesaleDiscount = subtotal * (discountPercentage / 100);
    }

    const afterWholesaleDiscount = subtotal - wholesaleDiscount;

    // Get coupon discount (use stored value if available, otherwise calculate)
    let couponDiscount = 0;
    let couponCode = order.coupon_code || null;

    if (order.coupon_id) {
      // Use stored coupon_discount if available (for historical accuracy)
      if (order.coupon_discount && parseFloat(order.coupon_discount) > 0) {
        couponDiscount = parseFloat(order.coupon_discount);
      } else if (order.coupon_type) {
        // Calculate from coupon type if stored discount not available
        const couponQuery = `SELECT coupon_discount FROM coupon WHERE coupon_id = $1`;
        const couponResult = await this.dataSource.query(couponQuery, [order.coupon_id]);
        if (couponResult[0]) {
          if (order.coupon_type === 'P') {
            couponDiscount = afterWholesaleDiscount * (parseFloat(couponResult[0].coupon_discount) / 100);
          } else {
            couponDiscount = parseFloat(couponResult[0].coupon_discount);
          }
          couponDiscount = Math.min(couponDiscount, afterWholesaleDiscount);
        }
      }
    }

    const afterDiscount = afterWholesaleDiscount - couponDiscount;
    const calculatedTotal = Math.round((afterDiscount + deliveryFee) * 100) / 100;
    // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
    // Recalculate 11% of subtotal (after discount) consistently
    const gstValue = Math.round(afterDiscount * 0.11 * 100) / 100;

    return {
      order: {
        ...order,
        items,
        subtotal: subtotal.toFixed(2),
        wholesale_discount: wholesaleDiscount.toFixed(2),
        coupon_discount: couponDiscount.toFixed(2),
        coupon_code: couponCode,
        after_wholesale_discount: afterWholesaleDiscount.toFixed(2),
        after_discount: afterDiscount.toFixed(2),
        gst: gstValue.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        total: orderTotal.toFixed(2),
        calculated_total: calculatedTotal.toFixed(2),
      },
    };
  }
  /**
   * Verify invoice token for public access
   */
  async verifyInvoiceToken(orderId: number, token: string): Promise<boolean> {
    const orderQuery = `
      SELECT 
        o.order_id, 
        o.order_total,
        o.customer_order_name,
        o.firstname,
        o.lastname,
        c.firstname as account_firstname,
        c.lastname as account_lastname
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1
    `;
    const result = await this.dataSource.query(orderQuery, [orderId]);
    const order = result[0];

    if (!order) return false;

    const customerName = order.customer_order_name ||
      `${order.firstname || order.account_firstname || ''} ${order.lastname || order.account_lastname || ''}`.trim() ||
      'Guest';

    const orderTotal = parseFloat(order.order_total);
    const expectedToken = crypto
      .createHash('sha1')
      .update(`${customerName}|${customerName}|${orderId}|${orderTotal}`)
      .digest('hex');

    return token === expectedToken;
  }

  /**
   * Get invoice PDF buffer
   */
  async getInvoicePdf(orderId: number): Promise<Buffer> {
    return this.invoiceService.getInvoicePDF(orderId);
  }
}
