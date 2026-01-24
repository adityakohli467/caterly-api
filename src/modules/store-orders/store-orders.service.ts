import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';
import { EmailService } from '../../common/services/email.service';
import * as crypto from 'crypto';

@Injectable()
export class StoreOrdersService {
  private readonly logger = new Logger(StoreOrdersService.name);

  constructor(
    private dataSource: DataSource,
    private notificationsService: AdminNotificationsService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  /**
   * Create order (checkout)
   */
  async createOrder(
    userId: number,
    orderData: {
      items: any[];
      delivery_address: string;
      delivery_date?: string;
      delivery_time?: string;
      standing_order?: number;
      frequency_unit?: 'days' | 'weeks' | 'months';
      frequency_value?: number;
      delivery_fee?: number;
      payment_method?: string;
      notes?: string;
      coupon_code?: string;
      postcode?: string;
      gst_status?: number;
    },
  ) {
    const {
      items,
      delivery_address,
      delivery_date,
      delivery_time,
      standing_order,
      frequency_unit,
      frequency_value,
      delivery_fee = 0,
      payment_method,
      notes,
      coupon_code,
      postcode,
      gst_status,
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
      // Get customer with customer_type
      const customerQuery = `
        SELECT c.customer_id, c.telephone, c.email, c.customer_type 
        FROM customer c 
        WHERE c.user_id = $1
      `;
      const customerResult = await queryRunner.query(customerQuery, [userId]);
      const customer = customerResult[0];

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      // Get customer product option discounts (option-level)
      const optionDiscountsMap = new Map();
      // Get customer product discounts (product-level)
      const productDiscountsMap = new Map();
      
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
        });
      }

      // Calculate wholesale discount based on customer type
      let wholesaleDiscount = 0;
      const customerType = customer.customer_type || 'Retail';
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
      const gst = gstStatus ? Math.round(afterDiscount * 0.10 * 100) / 100 : 0;
      const total = Math.round((baseTotal + gst) * 100) / 100;

      // Determine subscription frequency in days (standing_order)
      let standingOrderDays = 0;
      if (typeof standing_order === 'number' && standing_order > 0) {
        standingOrderDays = Math.floor(standing_order);
      } else if (frequency_unit && typeof frequency_value === 'number' && frequency_value > 0) {
        const val = Math.floor(frequency_value);
        if (frequency_unit === 'days') standingOrderDays = val;
        else if (frequency_unit === 'weeks') standingOrderDays = val * 7;
        else if (frequency_unit === 'months') standingOrderDays = val * 30;
      }

      // Parse delivery date and time
      let deliveryDateTime = new Date();
      if (delivery_date) {
        const [datePart, timePart] = delivery_date.split('T');
        if (timePart) {
          deliveryDateTime = new Date(delivery_date);
        } else if (delivery_time) {
          deliveryDateTime = new Date(`${delivery_date} ${delivery_time}`);
        } else {
          deliveryDateTime = new Date(delivery_date);
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
          standing_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING order_id
      `;

      const orderResult = await queryRunner.query(orderQuery, [
        customer.customer_id,
        1, // branch_id
        1, // shipping_method
        total,
        1, // order_status = new
        deliveryDateTime,
        deliveryFee,
        delivery_address,
        customer.telephone || null,
        customer.email || null,
        parseInt((postcode || '3000').toString()) || 3000,
        (notes && notes.trim()) || null,
        (notes && notes.trim()) || null,
        userId,
        couponId,
        couponDiscount,
        gstStatus,
        standingOrderDays
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
            sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING order_product_id
        `;

        const opResult = await queryRunner.query(orderProductQuery, [
          orderId,
          item.product_id,
          item.quantity,
          item.price,
          item.total,
          i + 1,
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
        const updateCouponQuery = `
          UPDATE coupon 
          SET uses_total = uses_total + 1
          WHERE coupon_id = $1
        `;
        await queryRunner.query(updateCouponQuery, [couponId]);
      }

      await queryRunner.commitTransaction();

      // Get complete order details
      const completeOrderQuery = `
        SELECT 
          o.*,
          c.firstname,
          c.lastname,
          c.email,
          c.telephone
        FROM orders o
        JOIN customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `;
      const completeOrder = await this.dataSource.query(completeOrderQuery, [orderId]);

      // Create notification for admin users
      if (this.notificationsService) {
        const customerName = completeOrder[0].customer_order_name || 
          `${completeOrder[0].firstname || ''} ${completeOrder[0].lastname || ''}`.trim() || 
          'Customer';
        
        this.notificationsService.createNotification({
          type: 'order',
          message: `New order #${orderId} placed by ${customerName} for $${total.toFixed(2)}`,
          order_id: orderId,
          metadata: {
            order_total: total,
            customer_name: customerName,
            delivery_date: delivery_date,
            delivery_time: delivery_time,
          },
        }).catch((err) => {
          this.logger.error('Failed to create order notification', err);
        });
      }

      // Send order confirmation email to customer
      try {
        const order = completeOrder[0];
        const customerEmail = order.customer_order_email || order.email;
        const customerName = order.customer_order_name || 
          `${order.firstname || ''} ${order.lastname || ''}`.trim() || 
          'Customer';

        if (customerEmail) {
          const backendUrl = this.configService.get<string>('BACKEND_URL') || 
                           this.configService.get<string>('FRONTEND_URL') || 
                           'http://localhost:9000';
          const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 
                            this.configService.get<string>('STORE_URL') || 
                            'http://localhost:3000';
          
          // Generate payment link (deep link)
          const paymentLink = `${frontendUrl}/payment?order_id=${orderId}`;
          
          // Generate invoice view link
          const orderTotal = parseFloat(order.order_total || total);
          const authToken = crypto
            .createHash('sha1')
            .update(`${customerName}|${customerName}|${orderId}|${orderTotal}`)
            .digest('hex');
          const invoiceUrl = `${backendUrl}/admin/orders/${orderId}/invoice/view?auth=${authToken}&ofrom=frontend`;

          const companyName = this.configService.get<string>('COMPANY_NAME') || 'Sendrix';
          
          const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #0d6efd; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .order-details { background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .order-info { margin: 10px 0; }
    .order-info strong { display: inline-block; width: 150px; }
    .cta-button { display: inline-block; padding: 12px 24px; background-color: #0d6efd; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Confirmation #${orderId}</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <p>Thank you for your order! We've received your order and it's being processed.</p>
      
      <div class="order-details">
        <h3>Order Details</h3>
        <div class="order-info"><strong>Order Number:</strong> #${orderId}</div>
        <div class="order-info"><strong>Order Total:</strong> $${total.toFixed(2)}</div>
        ${delivery_date ? `<div class="order-info"><strong>Delivery Date:</strong> ${new Date(delivery_date).toLocaleDateString()}</div>` : ''}
        ${delivery_time ? `<div class="order-info"><strong>Delivery Time:</strong> ${delivery_time}</div>` : ''}
        ${order.delivery_address ? `<div class="order-info"><strong>Delivery Address:</strong> ${order.delivery_address}</div>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentLink}" class="cta-button">Pay Now</a>
        <a href="${invoiceUrl}" class="cta-button" style="background-color: #28a745;">View Invoice</a>
      </div>

      <p>You can pay for your order by clicking the "Pay Now" button above. Once payment is received, we'll process your order.</p>
      
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
            to: customerEmail,
            subject: `Order Confirmation #${orderId} - ${companyName}`,
            html: emailHtml,
          });

          this.logger.log(`Order confirmation email sent to ${customerEmail} for order #${orderId}`);
        }
      } catch (emailError) {
        this.logger.error('Failed to send order confirmation email:', emailError);
        // Don't fail the order creation if email fails
      }

      // Get coupon code if coupon was applied
      let couponCode = null;
      if (couponId) {
        const couponCodeQuery = `SELECT coupon_code FROM coupon WHERE coupon_id = $1`;
        const couponCodeResult = await this.dataSource.query(couponCodeQuery, [couponId]);
        couponCode = couponCodeResult[0]?.coupon_code || null;
      }

      return {
        message: 'Order placed successfully',
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
        o.order_status,
        o.date_added,
        o.delivery_date_time,
        o.delivery_address,
        COALESCE(COUNT(op.order_product_id), 0)::integer as item_count
      FROM orders o
      LEFT JOIN order_product op ON o.order_id = op.order_id
      WHERE o.customer_id = $1
      GROUP BY o.order_id, o.order_total, o.order_status, o.date_added, o.delivery_date_time, o.delivery_address
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
   * Get single order details
   */
  async getOrder(userId: number, orderId: number) {
    // Get customer with customer_type
    const customerQuery = `
      SELECT c.customer_id, c.customer_type 
      FROM customer c 
      WHERE c.user_id = $1
    `;
    const customerResult = await this.dataSource.query(customerQuery, [userId]);
    const customer = customerResult[0];

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get order with coupon info
    const orderQuery = `
      SELECT 
        o.*,
        cp.coupon_code,
        cp.type as coupon_type
      FROM orders o
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.order_id = $1 AND o.customer_id = $2
    `;

    const orderResult = await this.dataSource.query(orderQuery, [orderId, customer.customer_id]);
    const order = orderResult[0];

    if (!order) {
      throw new NotFoundException('Order not found');
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

      // Calculate item total
      const itemTotal = parseFloat(product.total || product.price || '0') * parseInt(product.quantity || '1', 10);
      subtotal += itemTotal;

      items.push({
        product_id: product.product_id,
        product_name: product.product_name || 'Unknown Product',
        quantity: parseInt(product.quantity || '1', 10),
        price: parseFloat(product.price || '0'),
        total: itemTotal,
        product_image: product.product_image,
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
    // GST is inclusive: calculate as 11% but display as 10%
    const calculatedTotal = Math.round((afterDiscount + deliveryFee) * 100) / 100; // Total is inclusive of GST
    const gst = Math.round((calculatedTotal * (11 / 111)) * 100) / 100; // Calculate GST as 11% but display as 10%

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
        gst: gst.toFixed(2),
        delivery_fee: deliveryFee.toFixed(2),
        total: orderTotal.toFixed(2),
        calculated_total: calculatedTotal.toFixed(2),
      },
    };
  }
}
