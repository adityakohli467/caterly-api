import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreQuotesService {
  private readonly logger = new Logger(StoreQuotesService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get public quote details by token (no authentication required)
   * Used for customer quote review via email link with secure token
   */
  async getPublicQuoteByToken(token: string) {
    const query = `
      SELECT 
        o.order_id,
        o.customer_id,
        o.location_id,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.delivery_address,
        o.order_comments,
        o.approval_comments,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone,
        c.company_id,
        c.department_id,
        c.customer_type,
        co.company_name,
        d.department_name,
        l.location_name,
        cp.coupon_id,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'options', (
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity,
                'option_price', opo.option_price,
                'product_option_id', opo.product_option_id
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
      LEFT JOIN department d ON c.department_id = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.quote_token = $1 AND o.standing_order = 0
    `;
    const result = await this.dataSource.query(query, [token]);

    if (result.length === 0) {
      throw new NotFoundException('Quote not found or invalid token');
    }

    const quote = result[0];
    return this.calculateQuoteTotals(quote);
  }

  /**
   * Get public quote details (no authentication required)
   * Used for customer quote review via email link
   */
  async getPublicQuote(id: number) {
    const query = `
      SELECT 
        o.order_id,
        o.customer_id,
        o.location_id,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.delivery_address,
        o.order_comments,
        o.approval_comments,
        c.firstname,
        c.lastname,
        c.email,
        c.telephone,
        c.company_id,
        c.department_id,
        c.customer_type,
        co.company_name,
        d.department_name,
        l.location_name,
        cp.coupon_id,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        (
          SELECT json_agg(json_build_object(
            'product_id', op.product_id,
            'product_name', p.product_name,
            'quantity', op.quantity,
            'price', op.price,
            'total', op.total,
            'options', (
              SELECT json_agg(json_build_object(
                'option_name', opo.option_name,
                'option_value', opo.option_value,
                'option_quantity', opo.option_quantity,
                'option_price', opo.option_price,
                'product_option_id', opo.product_option_id
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
      LEFT JOIN department d ON c.department_id = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.order_id = $1 AND o.standing_order = 0
    `;
    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Quote not found');
    }

    const quote = result[0];
    return this.calculateQuoteTotals(quote);
  }

  /**
   * Calculate quote totals with discounts
   * Helper method to avoid code duplication
   */
  private async calculateQuoteTotals(quote: any) {
    // Get customer type for discount calculation
    const customerType = quote.customer_type || 'Retail';
    const isWholesale = customerType && (customerType.includes('Wholesale') || customerType.includes('Wholesaler'));

    // Get customer product option discounts (option-level)
    const optionDiscountsMap = new Map();
    // Get customer product discounts (product-level)
    const productDiscountsMap = new Map();
    
    if (quote.customer_id) {
      // Fetch option-level discounts
      const optionDiscountQuery = `
        SELECT product_id, option_value_id, discount_percentage
        FROM customer_product_option_discount
        WHERE customer_id = $1
      `;
      const optionDiscountResult = await this.dataSource.query(optionDiscountQuery, [quote.customer_id]);
      optionDiscountResult.forEach((row: any) => {
        const key = `${row.product_id}_${row.option_value_id}`;
        optionDiscountsMap.set(key, parseFloat(row.discount_percentage));
      });

      // Fetch product-level discounts
      const productDiscountQuery = `
        SELECT product_id, discount_percentage
        FROM customer_product_discount
        WHERE customer_id = $1
      `;
      const productDiscountResult = await this.dataSource.query(productDiscountQuery, [quote.customer_id]);
      productDiscountResult.forEach((row: any) => {
        productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
      });
    }

    // Calculate subtotal with discounts
    let subtotal = 0;
    if (quote.products) {
      for (const product of quote.products) {
        const productPrice = parseFloat(product.price || 0);
        const productQuantity = parseInt(product.quantity || 1);
        let productSubtotal = productPrice * productQuantity;

        // Check if product has options
        const hasOptions = product.options && Array.isArray(product.options) && product.options.length > 0;

        if (hasOptions) {
          // Product has options - apply option-level discounts
          for (const option of product.options) {
            const optionPrice = parseFloat(option.option_price || 0);
            const optionQuantity = option.option_quantity || 1;

            // Note: option_value_id is not available in order_product_option
            // Discounts should already be applied in the stored price
            // For quotes, we use the stored option_price directly
            if (false && optionDiscountsMap.size > 0) {
              // Discount calculation disabled for quotes - prices are already final
              const discountKey = `${product.product_id}_${option.product_option_id}`;
              const discountPercentage = optionDiscountsMap.get(discountKey) || 0;

              if (discountPercentage > 0) {
                const discountAmount = optionPrice * (discountPercentage / 100);
                subtotal += (optionPrice - discountAmount) * optionQuantity;
              } else {
                subtotal += optionPrice * optionQuantity;
              }
            } else {
              subtotal += optionPrice * optionQuantity;
            }
          }
          // Add base product total
          subtotal += productSubtotal;
        } else {
          // Product has no options - apply product-level discount
          const productDiscountPercentage = productDiscountsMap.get(product.product_id) || 0;
          
          if (productDiscountPercentage > 0) {
            const discountAmount = productSubtotal * (productDiscountPercentage / 100);
            subtotal += productSubtotal - discountAmount;
          } else {
            subtotal += productSubtotal;
          }
        }
      }
    }

    // Calculate wholesale discount
    let wholesaleDiscount = 0;
    // Only apply wholesale discount if no custom discounts are set
    if (isWholesale && optionDiscountsMap.size === 0 && productDiscountsMap.size === 0) {
      const discountPercentage = customerType.includes('Full Service') ? 15 : 10;
      wholesaleDiscount = subtotal * (discountPercentage / 100);
    }

    // Calculate coupon discount
    let couponDiscount = 0;
    if (quote.coupon_code && quote.coupon_type && quote.coupon_discount) {
      if (quote.coupon_type === 'P') {
        couponDiscount = subtotal * (parseFloat(quote.coupon_discount) / 100);
      } else if (quote.coupon_type === 'F') {
        couponDiscount = parseFloat(quote.coupon_discount);
      }
      couponDiscount = Math.min(couponDiscount, subtotal);
    }

    const afterWholesaleDiscount = subtotal - wholesaleDiscount;
    const finalCouponDiscount =
      couponDiscount > 0 ? Math.min(couponDiscount, afterWholesaleDiscount) : 0;
    const afterDiscount = afterWholesaleDiscount - finalCouponDiscount;
    const gst = afterDiscount * 0.1;
    const calculatedTotal = afterDiscount + gst + parseFloat(quote.delivery_fee || 0);

    // Add calculated fields
    quote.subtotal = subtotal;
    quote.wholesale_discount = wholesaleDiscount;
    quote.coupon_discount = finalCouponDiscount;
    quote.total_discount = wholesaleDiscount + finalCouponDiscount;
    quote.after_wholesale_discount = afterWholesaleDiscount;
    quote.after_discount = afterDiscount;
    quote.gst = gst;
    quote.calculated_total = calculatedTotal;

    return { quote };
  }

  /**
   * Submit customer feedback/approval by token (no authentication required)
   * Actions: 'approve', 'modify', 'reject'
   */
  async submitCustomerFeedbackByToken(token: string, data: { action: string; comments?: string }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { action, comments } = data;

      if (!action || !['approve', 'modify', 'reject'].includes(action)) {
        throw new BadRequestException("Invalid action. Must be 'approve', 'modify', or 'reject'");
      }

      // Verify quote exists by token
      const quoteCheck = await queryRunner.query(
        `SELECT order_id, order_status FROM orders WHERE quote_token = $1 AND standing_order = 0`,
        [token],
      );

      if (quoteCheck.length === 0) {
        throw new NotFoundException('Quote not found or invalid token');
      }

      const quoteId = quoteCheck[0].order_id;

      // Map action to status
      // Status: 7=approved, 8=rejected, 9=modified
      let newStatus: number;
      switch (action) {
        case 'approve':
          newStatus = 7; // approved
          break;
        case 'modify':
          newStatus = 9; // modified
          break;
        case 'reject':
          newStatus = 8; // rejected
          break;
        default:
          newStatus = 1; // new (shouldn't happen)
      }

      // Update quote with customer feedback
      const updateQuery = `
        UPDATE orders 
        SET order_status = $1,
            approval_comments = $2,
            date_modified = CURRENT_TIMESTAMP
        WHERE quote_token = $3 AND standing_order = 0
        RETURNING *
      `;

      const result = await queryRunner.query(updateQuery, [
        newStatus,
        (comments && comments.trim()) || null,
        token,
      ]);

      await queryRunner.commitTransaction();
      
      return {
        success: true,
        quote: result[0],
        message: `Quote ${action === 'approve' ? 'approved' : action === 'modify' ? 'marked for modification' : 'rejected'} successfully`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Submit customer feedback/approval (no authentication required)
   * Actions: 'approve', 'modify', 'reject'
   */
  async submitCustomerFeedback(id: number, data: { action: string; comments?: string }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { action, comments } = data;

      if (!action || !['approve', 'modify', 'reject'].includes(action)) {
        throw new BadRequestException("Invalid action. Must be 'approve', 'modify', or 'reject'");
      }

      // Verify quote exists
      const quoteCheck = await queryRunner.query(
        `SELECT order_id, order_status FROM orders WHERE order_id = $1 AND standing_order = 0`,
        [Number(id)],
      );

      if (quoteCheck.length === 0) {
        throw new NotFoundException('Quote not found');
      }

      // Map action to status
      // Status: 7=approved, 8=rejected, 9=modified
      let newStatus: number;
      switch (action) {
        case 'approve':
          newStatus = 7; // approved
          break;
        case 'modify':
          newStatus = 9; // modified
          break;
        case 'reject':
          newStatus = 8; // rejected
          break;
        default:
          newStatus = 1; // new (shouldn't happen)
      }

      // Update quote with customer feedback
      const updateQuery = `
        UPDATE orders 
        SET order_status = $1,
            approval_comments = $2,
            date_modified = CURRENT_TIMESTAMP
        WHERE order_id = $3 AND standing_order = 0
        RETURNING *
      `;

      const result = await queryRunner.query(updateQuery, [
        newStatus,
        (comments && comments.trim()) || null,
        Number(id),
      ]);

      // Auto-generate invoice when quote is approved (status 7)
      if (newStatus === 7) {
        try {
          // Note: Invoice generation is handled in admin-quotes service
          // This is just a placeholder for future implementation
        } catch (error) {
          // Log but don't fail
          console.error('Error importing InvoiceService:', error);
        }
      }

      await queryRunner.commitTransaction();
      
      // Note: Auto-invoice generation when quote is approved (status 7) 
      // is handled in admin-quotes service update method to ensure proper dependency injection

      return {
        success: true,
        quote: result[0],
        message: `Quote ${action === 'approve' ? 'approved' : action === 'modify' ? 'marked for modification' : 'rejected'} successfully`,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

