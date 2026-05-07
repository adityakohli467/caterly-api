import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmailService } from '../../common/services/email.service';
import { InvoiceService } from '../../common/services/invoice.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AdminQuotesService {
  private readonly logger = new Logger(AdminQuotesService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private invoiceService: InvoiceService,
    private configService: ConfigService,
  ) { }

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search, status, customer_id, location_id, date_from, date_to, sort_field, sort_direction } = query;

    let sqlQuery = `
      SELECT 
        o.order_id,
        o.customer_id,
        o.order_status,
        o.order_total,
        o.delivery_fee,
        o.date_added,
        o.date_modified,
        o.delivery_date_time,
        o.customer_order_name,
        o.coupon_id,
        o.coupon_discount as stored_coupon_discount,
        COALESCE(o.firstname, c.firstname) as firstname,
        COALESCE(o.lastname, c.lastname) as lastname,
        COALESCE(o.email, c.email) as email,
        COALESCE(o.telephone, c.telephone) as telephone,
        COALESCE(o.company_id, c.company_id) as company_id,
        COALESCE(o.department_id, c.department_id) as department_id,
        co.company_name,
        l.location_name,
        d.department_name,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.standing_order = 0
      AND (o.order_status = 1 OR o.order_status = 4 OR o.order_status = 7 OR o.order_status = 8 OR o.order_status = 9)
      -- Include: 1=new, 4=awaiting approval, 7=approved, 8=rejected, 9=modification requested
      -- Exclude orders that have been paid (status 2)
      AND o.order_status != 2
      -- Only show quotes (payment_status = 'quote' or NULL for legacy quotes)
      -- Exclude orders: payment_status = 'order' or 'pending' (orders have 'pending' as default)
      AND (o.payment_status = 'quote' OR o.payment_status IS NULL)
      AND (o.payment_status IS NULL OR (o.payment_status != 'order' AND o.payment_status != 'pending'))
      -- Exclude orders with successful payment status
      AND (o.payment_status IS NULL OR o.payment_status NOT IN ('success', 'completed', 'paid'))
      -- Exclude orders that have payment history records (they are orders, not quotes)
      AND NOT EXISTS (
        SELECT 1 FROM payment_history ph 
        WHERE ph.order_id = o.order_id 
        AND ph.payment_status IN ('success', 'completed', 'paid')
      )
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND (c.firstname ILIKE $${paramIndex} OR c.lastname ILIKE $${paramIndex} OR o.customer_order_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== undefined) {
      sqlQuery += ` AND o.order_status = $${paramIndex}`;
      params.push(Number(status));
      paramIndex++;
    }

    if (customer_id) {
      sqlQuery += ` AND o.customer_id = $${paramIndex}`;
      params.push(Number(customer_id));
      paramIndex++;
    }

    if (location_id) {
      sqlQuery += ` AND o.location_id = $${paramIndex}`;
      params.push(Number(location_id));
      paramIndex++;
    }

    if (date_from) {
      sqlQuery += ` AND o.date_added >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      sqlQuery += ` AND o.date_added <= $${paramIndex}`;
      params.push(`${date_to} 23:59:59`);
      paramIndex++;
    }

    // Handle sorting
    let orderByClause = 'ORDER BY o.date_added DESC';
    if (sort_field && typeof sort_field === 'string' && sort_field.trim()) {
      const direction = (sort_direction === 'desc') ? 'DESC' : 'ASC';
      // Map frontend field names to database column names
      const fieldMap: Record<string, string> = {
        'order_id': 'o.order_id',
        'customer_name': 'COALESCE(o.customer_order_name, COALESCE(c.firstname, \'\') || \' \' || COALESCE(c.lastname, \'\'))',
        'company_name': 'co.company_name',
        'department_name': 'd.department_name',
        'delivery_date_time': 'o.delivery_date_time',
        'delivery_time': 'o.delivery_date_time',
        'order_total': 'o.order_total',
        'order_status': 'o.order_status',
      };
      const dbField = fieldMap[sort_field] || 'o.date_added';
      orderByClause = `ORDER BY ${dbField} ${direction}`;
    }

    sqlQuery += ` ${orderByClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.standing_order = 0
      AND (o.order_status = 1 OR o.order_status = 4 OR o.order_status = 7 OR o.order_status = 8 OR o.order_status = 9)
      -- Include: 1=new, 4=awaiting approval, 7=approved, 8=rejected, 9=modification requested
      -- Exclude orders that have been paid (status 2)
      AND o.order_status != 2
      -- Only show quotes (payment_status = 'quote' or NULL for legacy quotes)
      -- Exclude orders: payment_status = 'order' or 'pending' (orders have 'pending' as default)
      AND (o.payment_status = 'quote' OR o.payment_status IS NULL)
      AND (o.payment_status IS NULL OR (o.payment_status != 'order' AND o.payment_status != 'pending'))
      -- Exclude orders with successful payment status
      AND (o.payment_status IS NULL OR o.payment_status NOT IN ('success', 'completed', 'paid'))
      -- Exclude orders that have payment history records (they are orders, not quotes)
      AND NOT EXISTS (
        SELECT 1 FROM payment_history ph 
        WHERE ph.order_id = o.order_id 
        AND ph.payment_status IN ('success', 'completed', 'paid')
      )
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (c.firstname ILIKE $${countParamIndex} OR c.lastname ILIKE $${countParamIndex} OR o.customer_order_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status !== undefined) {
      countQuery += ` AND o.order_status = $${countParamIndex}`;
      countParams.push(Number(status));
      countParamIndex++;
    }

    if (customer_id) {
      countQuery += ` AND o.customer_id = $${countParamIndex}`;
      countParams.push(Number(customer_id));
      countParamIndex++;
    }

    if (location_id) {
      countQuery += ` AND o.location_id = $${countParamIndex}`;
      countParams.push(Number(location_id));
      countParamIndex++;
    }

    if (date_from) {
      countQuery += ` AND o.date_added >= $${countParamIndex}`;
      countParams.push(date_from);
      countParamIndex++;
    }

    if (date_to) {
      countQuery += ` AND o.date_added <= $${countParamIndex}`;
      countParams.push(`${date_to} 23:59:59`);
      countParamIndex++;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    // Fetch products and calculate totals
    const quoteIds = result.map((row: any) => row.order_id);
    const productsMap = new Map();

    if (quoteIds.length > 0) {
      const productsQuery = `
        SELECT 
          op.order_id,
          op.order_product_id,
          op.price,
          op.quantity,
          op.total as product_total,
          COALESCE((
            SELECT SUM(opo.option_price * opo.option_quantity)
            FROM order_product_option opo
            WHERE opo.order_product_id = op.order_product_id
          ), 0) as options_total
        FROM order_product op
        WHERE op.order_id = ANY($1)
      `;
      const productsResult = await this.dataSource.query(productsQuery, [quoteIds]);

      productsResult.forEach((row: any) => {
        if (!productsMap.has(row.order_id)) {
          productsMap.set(row.order_id, 0);
        }
        const currentSubtotal = productsMap.get(row.order_id);
        // Calculate total manually to avoid missing options or double-counting
        const productBaseTotal = parseFloat(row.price || 0) * parseFloat(row.quantity || 0);
        const optionsTotal = parseFloat(row.options_total || 0);
        productsMap.set(row.order_id, currentSubtotal + productBaseTotal + optionsTotal);
      });
    }

    // Fetch custom discounts for all customers in the result set to check if wholesale discount should be applied
    const customerIds = [...new Set(result.map((row: any) => row.customer_id).filter(Boolean))];
    const customerDiscountsMap = new Map<number, { hasProductDiscounts: boolean; hasOptionDiscounts: boolean }>();

    if (customerIds.length > 0) {
      // Check for product-level discounts
      const productDiscountsQuery = `
        SELECT DISTINCT customer_id
        FROM customer_product_discount
        WHERE customer_id = ANY($1)
      `;
      const productDiscountsResult = await this.dataSource.query(productDiscountsQuery, [customerIds]);
      productDiscountsResult.forEach((row: any) => {
        if (!customerDiscountsMap.has(row.customer_id)) {
          customerDiscountsMap.set(row.customer_id, { hasProductDiscounts: false, hasOptionDiscounts: false });
        }
        customerDiscountsMap.get(row.customer_id)!.hasProductDiscounts = true;
      });

      // Check for option-level discounts
      const optionDiscountsQuery = `
        SELECT DISTINCT customer_id
        FROM customer_product_option_discount
        WHERE customer_id = ANY($1)
      `;
      const optionDiscountsResult = await this.dataSource.query(optionDiscountsQuery, [customerIds]);
      optionDiscountsResult.forEach((row: any) => {
        if (!customerDiscountsMap.has(row.customer_id)) {
          customerDiscountsMap.set(row.customer_id, { hasProductDiscounts: false, hasOptionDiscounts: false });
        }
        customerDiscountsMap.get(row.customer_id)!.hasOptionDiscounts = true;
      });
    }

    // Calculate totals for each quote
    const quotes = result.map((row: any) => {
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
          couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(row.delivery_fee || 0));
        } else {
          // Coupon was deleted but coupon_id exists - use stored order_total to calculate discount
          const tempAfterDiscount = subtotal;
          const tempDeliveryFee = parseFloat(row.delivery_fee || 0);
          const tempTotal = Math.round((tempAfterDiscount + tempDeliveryFee) * 100) / 100; // GST-inclusive

          const storedTotal = parseFloat(row.order_total || 0);
          if (storedTotal < tempTotal) {
            couponDiscount = tempTotal - storedTotal;
            couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(row.delivery_fee || 0));
            couponCode = 'DELETED';
          }
        }
      }

      const finalCouponDiscount = couponDiscount;
      const afterDiscount = Math.max(0, subtotal - finalCouponDiscount);
      const deliveryFee = parseFloat(row.delivery_fee || 0);
      const gst = Math.round((afterDiscount / 11) * 100) / 100;
      const calculatedTotal = Math.round((afterDiscount + deliveryFee) * 100) / 100;

      return {
        ...row,
        gst,
        order_total: calculatedTotal,
        coupon_code: couponCode,
        coupon_discount: finalCouponDiscount,
      };
    });

    return { quotes, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const query = `
      SELECT 
        o.*,
        o.coupon_id,
        o.customer_id as order_customer_id,
        c.customer_id,
        COALESCE(o.firstname, c.firstname) as firstname,
        COALESCE(o.lastname, c.lastname) as lastname,
        COALESCE(o.email, c.email) as email,
        COALESCE(o.telephone, c.telephone) as telephone,
        COALESCE(o.company_id, c.company_id) as company_id,
        COALESCE(o.department_id, c.department_id) as department_id,
        c.customer_type,
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
              'price', CASE 
                WHEN op.price = 0 THEN COALESCE((
                  SELECT SUM(opo.option_price * opo.option_quantity) / NULLIF(op.quantity, 0)
                  FROM order_product_option opo
                  WHERE opo.order_product_id = op.order_product_id
                ), 0)
                ELSE op.price 
              END,
              'total', (op.total),
              'product_comment', op.order_product_comment,
              'is_prepared', false,
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
        ), '[]'::json) as products
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON COALESCE(o.company_id, c.company_id) = co.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.order_id = $1 AND o.standing_order = 0
    `;
    const result = await this.dataSource.query(query, [id]);

    if (result.length === 0) {
      throw new NotFoundException('Quote not found');
    }

    const quote = result[0];

    // Calculate totals
    // Fetch option-level discounts
    const optionDiscountsMap = new Map();
    // Fetch product-level discounts
    const productDiscountsMap = new Map();

    if (quote.customer_id) {
      // Get option-level discounts
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

      // Get product-level discounts
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
          // Do NOT add productSubtotal here as it is derived from option prices (double-count)
          for (const option of product.options) {
            const optionPrice = parseFloat(option.option_price || 0);
            const optionQuantity = option.option_quantity || 1;

            if (option.option_value_id && optionDiscountsMap.size > 0) {
              const discountKey = `${product.product_id}_${option.option_value_id}`;
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

    // Calculate coupon discount
    let couponDiscount = 0;
    let couponCode: string | null = quote.coupon_code || null;
    // Check if coupon_id exists (even if JOIN returns NULL due to deleted coupon)
    if (quote.coupon_id) {
      // First, try to use stored coupon_discount from orders table (for historical accuracy)
      if (quote.stored_coupon_discount && parseFloat(quote.stored_coupon_discount) > 0) {
        couponDiscount = parseFloat(quote.stored_coupon_discount);
        couponCode = quote.coupon_code || 'DELETED';
      } else if (quote.coupon_code && quote.coupon_discount) {
        // Coupon information available from JOIN - recalculate to ensure accuracy
        couponCode = quote.coupon_code;
        if (quote.coupon_type === 'P') {
          couponDiscount = subtotal * (parseFloat(quote.coupon_discount) / 100);
        } else if (quote.coupon_type === 'F') {
          couponDiscount = parseFloat(quote.coupon_discount);
        }
        couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(quote.delivery_fee || 0));
      } else {
        // Coupon was deleted but coupon_id exists - calculate discount from stored order_total
        const tempAfterDiscount = subtotal;
        const tempDeliveryFee = parseFloat(quote.delivery_fee || 0);
        const tempTotal = Math.round((tempAfterDiscount + tempDeliveryFee) * 100) / 100; // GST-inclusive

        const storedTotal = parseFloat(quote.order_total || 0);
        if (storedTotal < tempTotal) {
          couponDiscount = tempTotal - storedTotal;
          couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(quote.delivery_fee || 0));
          couponCode = 'DELETED';
        }
      }
    }

    const finalCouponDiscount = couponDiscount;
    // afterDiscount should never go below 0
    const afterDiscount = Math.max(0, subtotal - finalCouponDiscount);
    // GST is inclusive: calculate as 1/11 of the after-discount amount (coupon applied before GST)
    const gst = Math.round((afterDiscount / 11) * 100) / 100;
    const calculatedTotal = Math.round((afterDiscount + parseFloat(quote.delivery_fee || 0)) * 100) / 100;

    quote.subtotal = subtotal;
    quote.coupon_discount = finalCouponDiscount;
    quote.coupon_code = couponCode;
    quote.coupon_id = quote.coupon_id || null; // Ensure coupon_id is included
    quote.total_discount = finalCouponDiscount;
    quote.after_discount = Math.max(0, afterDiscount);
    quote.gst = gst;
    quote.calculated_total = calculatedTotal;
    quote.order_total = calculatedTotal;
    quote.customer_id = quote.customer_id || quote.order_customer_id || null;
    // Explicitly ensure delivery fields are included
    quote.delivery_date_time = quote.delivery_date_time || null;
    quote.delivery_address = quote.delivery_address || null;
    quote.delivery_method = quote.delivery_method || null;
    quote.delivery_contact = quote.delivery_contact || null;
    quote.delivery_details = quote.delivery_details || null;
    quote.account_email = quote.account_email || null;
    quote.cost_center = quote.cost_center || null;
    delete quote.order_customer_id;

    return { quote };
  }

  async create(createQuoteDto: any, userId: number): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const {
        customer_id,
        location_id,
        company_id,
        department_id,
        delivery_date, // Optional - not required for Caterly
        delivery_time,
        delivery_method,
        delivery_address,
        delivery_fee = 0,
        account_email,
        cost_center,
        delivery_contact,
        delivery_details,
        order_comments,
        coupon_code,
        products,
      } = createQuoteDto;

      if (!customer_id) {
        throw new BadRequestException('Customer ID is required');
      }

      if (!products || products.length === 0) {
        throw new BadRequestException('At least one product is required');
      }

      // Get customer product option discounts (option-level)
      const optionDiscountsMap = new Map();
      // Get customer product discounts (product-level)
      const productDiscountsMap = new Map();

      if (customer_id) {
        // Fetch option-level discounts
        const optionDiscountQuery = `
          SELECT product_id, option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1
        `;
        const optionDiscountResult = await manager.query(optionDiscountQuery, [customer_id]);
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
        const productDiscountResult = await manager.query(productDiscountQuery, [customer_id]);
        productDiscountResult.forEach((row: any) => {
          productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
        });
      }

      // Calculate totals
      let subtotal = 0;
      for (const product of products) {
        const productPrice = parseFloat(product.price || 0);
        const productQuantity = parseInt(product.quantity || 1);
        let productSubtotal = productPrice * productQuantity;

        // Check for both 'options' and 'add_ons'
        const optionsList = product.options || product.add_ons;
        const hasAddOns = optionsList && Array.isArray(optionsList) && optionsList.length > 0;

        if (hasAddOns) {
          // Product has options - apply option-level discounts
          let addOnsTotal = 0;
          for (const addon of optionsList) {
            const optPrice = parseFloat((addon.option_price || addon.price || 0).toString());
            const optQty = addon.option_quantity || addon.quantity || 1;
            const optValueId = addon.option_value_id;

            if (optValueId) {
              const discountKey = `${product.product_id}_${optValueId}`;
              const discountPercentage = optionDiscountsMap.get(discountKey) || 0;

              if (discountPercentage > 0) {
                const discountAmount = optPrice * (discountPercentage / 100);
                addOnsTotal += (optPrice - discountAmount) * optQty;
              } else {
                addOnsTotal += optPrice * optQty;
              }
            } else {
              addOnsTotal += optPrice * optQty;
            }
          }
          subtotal += productSubtotal + addOnsTotal;
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

      let couponDiscount = 0;
      let couponId = null;

      if (coupon_code) {
        // Trim whitespace and make case-insensitive lookup
        const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
        const couponResult = await manager.query(
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

          couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(delivery_fee.toString()));
        } else {
          // Log warning if coupon not found (for debugging)
          this.logger.warn(`Coupon not found or inactive: ${coupon_code} (normalized: ${normalizedCouponCode})`);
        }
      }

      const finalCouponDiscount = couponDiscount;
      const afterDiscount = subtotal - finalCouponDiscount;
      const orderTotal = Math.round((afterDiscount + parseFloat(delivery_fee.toString())) * 100) / 100;
      // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
      const gst = Math.round((subtotal / 11) * 100) / 100;

      // Build delivery_date_time: only set if both date and time are provided
      // If null/empty, consider it a future order/quote (no delivery date set)
      let deliveryDateTime: string | null = null;
      if (delivery_date && delivery_time) {
        deliveryDateTime = `${delivery_date} ${delivery_time}:00`;
      }
      // If only date or only time provided, or neither provided, keep as null for future orders/quotes

      // Validate location_id - check if it exists in locations table
      let validLocationId: number | null = null;
      if (location_id) {
        const locationCheck = await manager.query(
          `SELECT location_id FROM locations WHERE location_id = $1`,
          [location_id],
        );
        if (locationCheck.length > 0) {
          validLocationId = location_id;
        } else {
          this.logger.warn(`Location ID ${location_id} does not exist in locations table. Using NULL instead.`);
        }
      }
      // If location_id is not provided or invalid, use NULL (location_id is nullable in orders table)

      // Insert order
      const orderResult = await manager.query(
        `INSERT INTO orders (
          customer_id, 
          location_id,
          branch_id,
          shipping_method,
          postcode,
          order_status,
          order_total,
          delivery_fee,
          delivery_date_time,
          delivery_address,
          delivery_method,
          account_email,
          cost_center,
          delivery_contact,
          delivery_details,
          order_comments,
          standing_order,
          user_id,
          coupon_id,
          coupon_discount,
          payment_status,
          company_id,
          department_id,
          gst,
          delivery_time,
          date_added,
          date_modified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING order_id`,
        [
          customer_id,
          validLocationId,
          1,
          1,
          0,
          1, // New status (1 = New Order/Quote)
          orderTotal,
          delivery_fee,
          deliveryDateTime,
          delivery_address || null,
          delivery_method || null,
          account_email?.trim() || null,
          cost_center?.trim() || null,
          delivery_contact?.trim() || null,
          delivery_details?.trim() || null,
          order_comments?.trim() || null,
          0,
          userId || 1,
          couponId,
          finalCouponDiscount, // Store coupon discount amount for historical accuracy
          'quote', // Mark as 'quote' to distinguish from orders
          company_id || null,
          department_id || null,
          gst,
          delivery_time || null,
        ],
      );

      const orderId = orderResult[0].order_id;

      // Insert order products
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const productResult = await manager.query(
          `INSERT INTO order_product (
            order_id,
            product_id,
            quantity,
            price,
            total,
            sort_order,
            order_product_comment
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING order_product_id`,
          [
            orderId,
            product.product_id,
            product.quantity,
            product.price,
            product.price * product.quantity,
            i + 1,
            product.comment?.trim() || null
          ],
        );

        const orderProductId = productResult[0].order_product_id;

        // Insert product options
        // Robust check for both 'options' and 'add_ons' keys to support various frontend payloads
        const optionsList = product.options || product.add_ons;
        if (optionsList && Array.isArray(optionsList) && optionsList.length > 0) {
          for (const addon of optionsList) {
            const nameValue = addon.option_name || addon.name || 'Add-on';
            const nameParts = nameValue.split(':').map((s: string) => s.trim());
            const optionName = nameParts[0] || 'Add-on';
            const optionValue = nameParts.length > 1 ? nameParts.slice(1).join(':') : nameValue;
            const optionQuantity = addon.option_quantity || addon.quantity || 1;
            const optionPrice = parseFloat((addon.option_price || addon.price || 0).toString());
            const optionTotal = optionPrice * optionQuantity;

            let productOptionId = addon.product_option_id || addon.option_id;
            if (!productOptionId && addon.option_value_id) {
              const optionQuery = await manager.query(
                `SELECT product_option_id FROM product_option 
                 WHERE product_id = $1 AND option_value_id = $2 
                 LIMIT 1`,
                [product.product_id, addon.option_value_id],
              );
              if (optionQuery.length > 0) {
                productOptionId = optionQuery[0].product_option_id;
              }
            }

            if (!productOptionId) {
              productOptionId = 0;
            }

            await manager.query(
              `INSERT INTO order_product_option (
                order_id,
                order_product_id,
                product_option_id,
                option_name,
                option_value,
                option_quantity,
                option_price,
                option_total
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [orderId, orderProductId, productOptionId, optionName, optionValue, optionQuantity, optionPrice, optionTotal],
            );
          }
        }
      }

      return {
        quote: {
          order_id: orderId,
          subtotal,
          coupon_discount: finalCouponDiscount,
          total_discount: finalCouponDiscount,
          after_discount: afterDiscount,
          gst,
          delivery_fee,
          order_total: orderTotal,
        },
        message: 'Quote created successfully',
      };
    });
  }

  async update(id: number, updateQuoteDto: any, userId: number): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      const {
        customer_id,
        location_id,
        company_id,
        department_id,
        delivery_date,
        delivery_time,
        delivery_method,
        delivery_address,
        delivery_fee = 0,
        account_email,
        cost_center,
        delivery_contact,
        delivery_details,
        order_comments,
        coupon_code,
        products,
        order_status,
      } = updateQuoteDto;

      // Ensure products is an array
      const productsArray = Array.isArray(products) ? products : [];

      // Get customer product discounts
      const optionDiscountsMap = new Map();
      const productDiscountsMap = new Map();

      if (customer_id) {
        // Fetch option-level discounts
        const optionDiscountQuery = `
          SELECT product_id, option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1
        `;
        const optionDiscountResult = await manager.query(optionDiscountQuery, [customer_id]);
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
        const productDiscountResult = await manager.query(productDiscountQuery, [customer_id]);
        productDiscountResult.forEach((row: any) => {
          productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
        });
      }

      // Calculate totals
      let subtotal = 0;
      for (const product of productsArray) {
        const productPrice = parseFloat(product.price || 0);
        const productQuantity = parseInt(product.quantity || 1);
        let productSubtotal = productPrice * productQuantity;

        // Check for both 'options' and 'add_ons'
        const optionsList = product.options || product.add_ons;
        const hasAddOns = optionsList && Array.isArray(optionsList) && optionsList.length > 0;

        if (hasAddOns) {
          // Product has options - apply option-level discounts
          let addOnsTotal = 0;
          for (const addon of optionsList) {
            const optPrice = parseFloat((addon.option_price || addon.price || 0).toString());
            const optQty = addon.option_quantity || addon.quantity || 1;
            const optValueId = addon.option_value_id;

            if (optValueId) {
              const discountKey = `${product.product_id}_${optValueId}`;
              const discountPercentage = optionDiscountsMap.get(discountKey) || 0;

              if (discountPercentage > 0) {
                const discountAmount = optPrice * (discountPercentage / 100);
                addOnsTotal += (optPrice - discountAmount) * optQty;
              } else {
                addOnsTotal += optPrice * optQty;
              }
            } else {
              addOnsTotal += optPrice * optQty;
            }
          }
          subtotal += productSubtotal + addOnsTotal;
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

      let couponDiscount = 0;
      let couponId = null;

      if (coupon_code) {
        // Trim whitespace and make case-insensitive lookup
        const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
        const couponResult = await manager.query(
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

          couponDiscount = Math.min(couponDiscount, subtotal + parseFloat(delivery_fee.toString()));
        } else {
          // Log warning if coupon not found (for debugging)
          this.logger.warn(`Coupon not found or inactive: ${coupon_code} (normalized: ${normalizedCouponCode})`);
        }
      }

      const finalCouponDiscount = couponDiscount;
      const afterDiscount = subtotal - finalCouponDiscount;
      const orderTotal = Math.round((afterDiscount + parseFloat(delivery_fee.toString())) * 100) / 100;
      // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
      const gst = Math.round((subtotal / 11) * 100) / 100;

      // Build delivery_date_time: prioritize delivery_date_time if provided, otherwise build from date/time
      // Allow setting just date (with default time 00:00:00) or both date and time
      let deliveryDateTime: string | null = null;

      if (delivery_date && typeof delivery_date === 'string' && delivery_date.trim()) {
        // Build from delivery_date and delivery_time
        const normalizedDate = delivery_date.trim();
        if (delivery_time && typeof delivery_time === 'string' && delivery_time.trim()) {
          // Both date and time provided
          const timeParts = delivery_time.trim().replace(/:/g, '').match(/.{1,2}/g) || [];
          if (timeParts.length >= 2 && timeParts[0] && timeParts[1]) {
            const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;
            deliveryDateTime = `${normalizedDate} ${formattedTime}`;
          } else {
            // Invalid time format, use default time
            deliveryDateTime = `${normalizedDate} 00:00:00`;
          }
        } else {
          // Only date provided, use default time (start of day)
          deliveryDateTime = `${normalizedDate} 00:00:00`;
        }
      }
      // If no date provided, keep as null for future orders/quotes

      // Check current order status - preserve quote status unless explicitly converting
      const currentOrderCheck = await manager.query(
        `SELECT order_status FROM orders WHERE order_id = $1`,
        [id],
      );

      const currentStatus = currentOrderCheck.length > 0 ? currentOrderCheck[0].order_status : null;
      // If updating a quote and order_status is not explicitly provided, keep current status
      // If order_status is explicitly provided, use that value (allows manual conversion)
      const newOrderStatus = order_status !== undefined && order_status !== null ? order_status : (currentStatus || 1);

      // Validate location_id - check if it exists in locations table
      let validLocationId: number | null = null;
      if (location_id) {
        const locationCheck = await manager.query(
          `SELECT location_id FROM locations WHERE location_id = $1`,
          [location_id],
        );
        if (locationCheck.length > 0) {
          validLocationId = location_id;
        } else {
          this.logger.warn(`Location ID ${location_id} does not exist in locations table. Using NULL instead.`);
        }
      }
      // If location_id is not provided or invalid, use NULL (location_id is nullable in orders table)

      // Update order
      const orderResult = await manager.query(
        `UPDATE orders 
         SET customer_id = $1,
             location_id = $2,
             order_total = $3,
             delivery_fee = $4,
             delivery_date_time = $5,
             delivery_address = $6,
             delivery_method = $7,
             account_email = $8,
             cost_center = $9,
             delivery_contact = $10,
             delivery_details = $11,
             order_comments = $12,
             user_id = $13,
             coupon_id = $14,
             coupon_discount = $15,
             order_status = $16,
             company_id = $17,
             department_id = $18,
             gst = $19,
             delivery_time = $20,
             date_modified = CURRENT_TIMESTAMP
         WHERE order_id = $21 AND standing_order = 0
         RETURNING *`,
        [
          customer_id,
          validLocationId,
          orderTotal,
          delivery_fee || 0,
          deliveryDateTime,
          (delivery_address && typeof delivery_address === 'string' && delivery_address.trim()) ? delivery_address.trim() : null,
          delivery_method || null,
          account_email?.trim() || null,
          cost_center?.trim() || null,
          delivery_contact?.trim() || null,
          delivery_details?.trim() || null,
          order_comments?.trim() || null,
          userId || 1,
          couponId,
          finalCouponDiscount, // Store coupon discount amount for historical accuracy
          newOrderStatus, // Keep as quote unless explicitly converting
          company_id || null,
          department_id || null,
          gst,
          delivery_time || null,
          id,
        ],
      );

      // Handle different query result structures (array vs object with rows)
      const resultArray = Array.isArray(orderResult) ? orderResult : (orderResult?.rows || []);

      if (!resultArray || resultArray.length === 0) {
        throw new NotFoundException('Quote not found');
      }

      const updatedOrder = resultArray[0];

      // Auto-convert to order when quote status changes to Approved (7)
      if (order_status === 7) {
        // Get previous status to check if it's a status change
        const previousOrderResult = await manager.query(
          `SELECT order_status FROM orders WHERE order_id = $1`,
          [id]
        );

        const previousOrderArray = Array.isArray(previousOrderResult) ? previousOrderResult : (previousOrderResult?.rows || []);
        const previousStatus = previousOrderArray.length > 0 ? previousOrderArray[0].order_status : null;

        // Only convert if status is changing to approved (not already approved)
        if (previousStatus !== 7) {
          this.logger.log(`Quote ${id} approved. Auto-converting to order.`);

          // Convert to order by updating payment_status from 'quote' to 'order'
          // This ensures it will show in orders list and not in quotes list
          await manager.query(
            `UPDATE orders 
             SET payment_status = $1,
                 order_status = $2,
                 date_modified = CURRENT_TIMESTAMP
             WHERE order_id = $3 AND standing_order = 0
             RETURNING *`,
            ['order', 2, id], // Set payment_status to 'order' and order_status to 2 (Paid/Approved)
          );

          // Auto-generate invoice asynchronously after transaction commits
          setTimeout(async () => {
            try {
              await this.invoiceService.generateInvoice(id);
              this.logger.log(`Auto-generated invoice for approved quote ${id}`);
            } catch (error) {
              this.logger.error(`Failed to auto-generate invoice for quote ${id}:`, error);
            }
          }, 1000);
        }
      }

      // Delete existing order product options
      await manager.query(
        `DELETE FROM order_product_option 
         WHERE order_product_id IN (
           SELECT order_product_id FROM order_product WHERE order_id = $1
         )`,
        [id],
      );

      // Delete existing order products
      await manager.query(`DELETE FROM order_product WHERE order_id = $1`, [id]);

      // Insert updated order products (only if products array is provided)
      if (productsArray && productsArray.length > 0) {
        for (let i = 0; i < productsArray.length; i++) {
          const product = productsArray[i];

          // Validate product data
          if (!product || !product.product_id) {
            this.logger.warn(`Skipping invalid product at index ${i} for quote ${id}`);
            continue;
          }

          const productResult = await manager.query(
            `INSERT INTO order_product (
              order_id,
              product_id,
              quantity,
              price,
              total,
              sort_order,
              order_product_comment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING order_product_id`,
            [
              id,
              product.product_id,
              product.quantity || 1,
              product.price || 0,
              (product.price || 0) * (product.quantity || 1),
              i + 1,
              product.comment?.trim() || null
            ],
          );

          const orderProductId = productResult && productResult[0] ? productResult[0].order_product_id : null;

          if (!orderProductId) {
            this.logger.warn(`Failed to insert product ${product.product_id} for quote ${id}`);
            continue;
          }

          // Insert product options (only if options array exists and is not empty)
          // Robust check for both 'options' and 'add_ons' keys
          const optionsList = product.options || product.add_ons;
          if (optionsList && Array.isArray(optionsList) && optionsList.length > 0) {
            for (const addon of optionsList) {
              const nameValue = addon.option_name || addon.name || 'Add-on';
              const nameParts = nameValue.split(':').map((s: string) => s.trim());
              const optionName = nameParts[0] || 'Add-on';
              const optionValue = nameParts.length > 1 ? nameParts.slice(1).join(':') : nameValue;
              const optionQuantity = addon.option_quantity || addon.quantity || 1;
              const optionPrice = parseFloat((addon.option_price || addon.price || 0).toString());
              const optionTotal = optionPrice * optionQuantity;

              let productOptionId = addon.product_option_id || addon.option_id;
              if (!productOptionId && addon.option_value_id) {
                const optionQuery = await manager.query(
                  `SELECT product_option_id FROM product_option 
                 WHERE product_id = $1 AND option_value_id = $2 
                 LIMIT 1`,
                  [product.product_id, addon.option_value_id],
                );
                if (optionQuery.length > 0) {
                  productOptionId = optionQuery[0].product_option_id;
                }
              }

              if (!productOptionId) {
                productOptionId = 0;
              }

              await manager.query(
                `INSERT INTO order_product_option (
                order_id,
                order_product_id,
                product_option_id,
                option_name,
                option_value,
                option_quantity,
                option_price,
                option_total
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, orderProductId, productOptionId, optionName, optionValue, optionQuantity, optionPrice, optionTotal],
              );
            }
          }
        }
      } else {
        this.logger.warn(`No products provided for quote update ${id}. Existing products will be deleted.`);
      }

      // Get updated quote with all details
      const updatedQuoteResult = await manager.query(
        `SELECT * FROM orders WHERE order_id = $1`,
        [id]
      );

      const updatedQuote = updatedQuoteResult && updatedQuoteResult[0] ? updatedQuoteResult[0] : (orderResult && orderResult[0] ? orderResult[0] : null);

      if (!updatedQuote) {
        throw new NotFoundException('Quote not found after update');
      }
      updatedQuote.subtotal = subtotal;
      updatedQuote.coupon_discount = finalCouponDiscount;
      updatedQuote.total_discount = finalCouponDiscount;
      updatedQuote.after_discount = afterDiscount;
      updatedQuote.gst = gst;
      updatedQuote.calculated_total = orderTotal;

      return { quote: updatedQuote, message: 'Quote updated successfully' };
    });
  }

  async convertToOrder(id: number): Promise<any> {
    // Check if quote exists and is not already converted
    const quoteCheck = await this.dataSource.query(
      `SELECT order_status, payment_status FROM orders WHERE order_id = $1 AND standing_order = 0`,
      [id],
    );

    if (quoteCheck.length === 0) {
      throw new NotFoundException('Quote not found');
    }

    const currentStatus = quoteCheck[0].order_status;
    const currentPaymentStatus = quoteCheck[0].payment_status;

    // Only allow conversion if it's still a quote (payment_status = 'quote' or NULL for legacy quotes)
    // Also allow conversion from status 4 (Awaiting Approval) and 7 (Approved) if still a quote
    if (currentPaymentStatus && currentPaymentStatus !== 'quote') {
      throw new BadRequestException('This quote has already been converted to an order');
    }

    if (currentStatus !== 1 && currentStatus !== 4 && currentStatus !== 7) {
      throw new BadRequestException('Quote has already been converted to order or is in an invalid status');
    }

    // Convert to order by updating payment_status from 'quote' to 'order'
    // This ensures it will show in orders list and not in quotes list
    // Status 1 means "New" for both quotes and orders
    // Status 2 = Paid, which should only be set when payment is received
    const result = await this.dataSource.query(
      `UPDATE orders 
       SET payment_status = $1,
           order_status = $2,
           date_modified = CURRENT_TIMESTAMP
       WHERE order_id = $3 AND standing_order = 0
       RETURNING *`,
      ['order', 1, id], // Set payment_status to 'order' and keep order_status as 1 (New Order)
    );

    if (result.length === 0) {
      throw new NotFoundException('Quote not found');
    }

    return { order: result[0], message: 'Quote converted to order successfully. Order status: New (not paid yet)' };
  }

  async delete(id: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      // Delete order product options
      await manager.query(
        `DELETE FROM order_product_option 
         WHERE order_product_id IN (
           SELECT order_product_id FROM order_product WHERE order_id = $1
         )`,
        [id],
      );

      // Delete order products
      await manager.query(`DELETE FROM order_product WHERE order_id = $1`, [id]);

      // Delete order
      const result = await manager.query(`DELETE FROM orders WHERE order_id = $1 AND standing_order = 0 RETURNING *`, [id]);

      if (result.length === 0) {
        throw new NotFoundException('Quote not found');
      }
    });
  }

  async sendEmail(id: number, recipientEmail?: string, customMessage?: string): Promise<any> {
    return this.dataSource.transaction(async (manager) => {
      // Get quote details
      const quoteQuery = `
        SELECT 
          o.*,
          c.email as customer_email,
          c.firstname,
          c.lastname,
          c.telephone,
          c.customer_id,
          c.customer_type,
          co.company_name,
          d.department_name,
          l.location_name,
          cp.coupon_code,
          cp.type as coupon_type,
          cp.coupon_discount
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN company co ON c.company_id = co.company_id
        LEFT JOIN department d ON c.department_id = d.department_id
        LEFT JOIN locations l ON o.location_id = l.location_id
        LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
        WHERE o.order_id = $1 AND o.standing_order = 0
      `;
      const quoteResult = await manager.query(quoteQuery, [id]);
      const quote = quoteResult[0];

      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      // Get quote products
      const productsQuery = `
        SELECT 
          op.*,
          p.product_name,
          p.product_description,
          (
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
          ) as options
        FROM order_product op
        LEFT JOIN product p ON op.product_id = p.product_id
        WHERE op.order_id = $1
      `;
      const productsResult = await manager.query(productsQuery, [id]);
      const quoteProducts = productsResult;

      // Calculate totals - same logic as findOne method
      // Fetch option-level discounts
      const optionDiscountsMap = new Map();
      // Fetch product-level discounts
      const productDiscountsMap = new Map();

      if (quote.customer_id) {
        // Get option-level discounts
        const optionDiscountQuery = `
          SELECT product_id, option_value_id, discount_percentage
          FROM customer_product_option_discount
          WHERE customer_id = $1
        `;
        const optionDiscountResult = await manager.query(optionDiscountQuery, [quote.customer_id]);
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
        const productDiscountResult = await manager.query(productDiscountQuery, [quote.customer_id]);
        productDiscountResult.forEach((row: any) => {
          productDiscountsMap.set(row.product_id, parseFloat(row.discount_percentage));
        });
      }

      // Build products array with options for calculation
      const productsWithOptions = quoteProducts.map((p: any) => ({
        product_id: p.product_id,
        price: parseFloat(p.price || 0),
        quantity: parseInt(p.quantity || 1),
        options: p.options || []
      }));

      let subtotal = 0;
      for (const product of productsWithOptions) {
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

            // Try to get option_value_id from product_option table if available
            if (option.option_value_id) {
              const discountKey = `${product.product_id}_${option.option_value_id}`;
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

      const deliveryFee = parseFloat(quote.delivery_fee || 0);

      // Calculate coupon discount
      let couponDiscount = 0;
      let couponCode: string | null = quote.coupon_code || null;
      // Check if coupon_id exists (even if JOIN returns NULL due to deleted coupon)
      if (quote.coupon_id) {
        // First, try to use stored coupon_discount from orders table (for historical accuracy)
        if (quote.coupon_discount && parseFloat(quote.coupon_discount.toString()) > 0) {
          couponDiscount = parseFloat(quote.coupon_discount.toString());
          couponCode = quote.coupon_code || 'DELETED';
        } else if (quote.coupon_code && quote.coupon_discount) {
          // Coupon information available from JOIN - recalculate to ensure accuracy
          couponCode = quote.coupon_code;
          if (quote.coupon_type === 'P') {
            couponDiscount = subtotal * (parseFloat(quote.coupon_discount.toString()) / 100);
          } else if (quote.coupon_type === 'F') {
            couponDiscount = parseFloat(quote.coupon_discount.toString());
          }
          couponDiscount = Math.min(couponDiscount, subtotal + deliveryFee);
        }
        // Allow coupon to cover total
        couponDiscount = Math.min(couponDiscount, subtotal + deliveryFee);
      }

      const finalCouponDiscount = couponDiscount;
      const afterDiscount = subtotal - finalCouponDiscount;
      const calculatedTotal = Math.round((afterDiscount + deliveryFee) * 100) / 100;
      // GST is inclusive: calculate as 1/11 of the after-discount amount (product price only)
      // GST is for display only and is not added to subtotal or total. All totals are GST-inclusive.
      const gst = Math.round((subtotal / 11) * 100) / 100;

      // Set calculated fields on quote object for email template
      quote.subtotal = subtotal;
      quote.coupon_discount = finalCouponDiscount;
      quote.coupon_code = couponCode;
      quote.gst = gst;
      quote.calculated_total = calculatedTotal;

      const recipientEmailFinal = recipientEmail || quote.customer_email || quote.email;

      if (!recipientEmailFinal) {
        throw new BadRequestException('Recipient email is required');
      }

      // Generate or retrieve unique token for quote access
      let quoteToken = quote.quote_token;
      if (!quoteToken) {
        // Generate a secure random token
        quoteToken = crypto.randomBytes(32).toString('hex');

        // Store the token in the database
        await manager.query(
          `UPDATE orders SET quote_token = $1 WHERE order_id = $2`,
          [quoteToken, id]
        );
      }

      // Use configured store portal URL for quote links
      const baseUrl = this.configService.get<string>('STORE_PORTAL_URL') ||
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3006';
      const publicQuoteUrl = `${baseUrl}/quote/${quoteToken}`;

      const customerName = quote.firstname && quote.lastname ? `${quote.firstname} ${quote.lastname}` : 'Customer';
      // Normalize company name - remove "Email" suffix if present and ensure proper formatting
      const companyName = 'Caterly';
      const emailSubject = `Quote #${quote.order_id} - ${companyName}`;

      const logoAttachment = this.emailService.getLogoAttachment();
      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333333 !important; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px; background-color: #fff; }
            .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
            .logo { max-width: 200px; height: auto; }
            .content { padding: 20px; background-color: #f4f4f4; color: #333333 !important; }
            .content p { color: #333333 !important; }
            .quote-details { background-color: white; padding: 20px; margin: 15px 0; border-radius: 8px; color: #333333 !important; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .quote-details h2 { color: #E03A3E !important; margin-top: 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
            .quote-details p { color: #333333 !important; margin: 8px 0; }
            .quote-details strong { color: #333333 !important; font-weight: 600; }
            .product-item { padding: 12px 10px; border-bottom: 1px solid #f0f0f0; color: #333333 !important; }
            .product-item:last-child { border-bottom: none; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .total { font-weight: bold; font-size: 20px; color: #E03A3E !important; border-top: 2px solid #E03A3E; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; padding: 30px 20px; color: #666666 !important; font-size: 12px; }
            .cta-button { display: inline-block; padding: 14px 28px; background-color: #E03A3E; color: #ffffff !important; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; font-size: 16px; }
          </style>
        </head>
        <body>
          <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
            Quote #${quote.order_id} for ${customerName}. Total: $${Number(quote.calculated_total || quote.order_total || 0).toFixed(2)}.
          </div>
          <div class="container">
            <div class="header">
              ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
              <h2 style="margin: 10px 0 0 0; font-size: 24px;">Quote #${quote.order_id}</h2>
            </div>
            <div class="content">
              <p style="color: #333333 !important;">Dear ${customerName},</p>
              <p style="color: #333333 !important;">Thank you for your interest. Please review the quote details below for your upcoming order.</p>
              
              <div class="quote-details">
                <h2 style="color: #E03A3E !important;">Customer Details</h2>
                ${quote.company_name ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Company:</strong> ${quote.company_name}</p>` : ''}
                ${quote.department_name ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Department:</strong> ${quote.department_name}</p>` : ''}
                <p style="color: #333333 !important;"><strong style="color: #333333 !important;">Contact:</strong> ${customerName}</p>
                <p style="color: #333333 !important;"><strong style="color: #333333 !important;">Email:</strong> ${quote.customer_email || quote.email || 'N/A'}</p>
                <p style="color: #333333 !important;"><strong style="color: #333333 !important;">Phone:</strong> ${quote.telephone || 'N/A'}</p>
                ${quote.location_name ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Order Location:</strong> ${quote.location_name}</p>` : ''}
              </div>
 
              <div class="quote-details">
                <h2 style="color: #E03A3E !important;">Event Details</h2>
                ${quote.delivery_date_time ? (() => {
          const date = new Date(quote.delivery_date_time);
          const formattedDate = date.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          return `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Date:</strong> ${formattedDate}</p>`;
        })() : ''}
                ${quote.delivery_date_time ? (() => {
          const date = new Date(quote.delivery_date_time);
          const timeStr = quote.delivery_time || date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
          return `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Time:</strong> ${timeStr}</p>`;
        })() : ''}
                ${quote.delivery_address ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Address:</strong> ${quote.delivery_address}</p>` : ''}
                ${quote.delivery_contact ? (() => {
          const parts = quote.delivery_contact.split('|');
          const contactName = parts[0]?.trim() || '';
          const contactNumber = parts[1]?.trim() || '';
          return `
                    ${contactName ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">On-site Contact:</strong> ${contactName}</p>` : ''}
                    ${contactNumber ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Contact Phone:</strong> ${contactNumber}</p>` : ''}
                  `;
        })() : ''}
                ${quote.delivery_details ? `<p style="color: #333333 !important;"><strong style="color: #333333 !important;">Special Instructions:</strong><br>${quote.delivery_details.replace(/\n/g, '<br>')}</p>` : ''}
              </div>
 
              <div class="quote-details">
                <h2 style="color: #E03A3E !important;">Quote Summary</h2>
                ${quoteProducts
          .map(
            (product: any) => `
                  <div class="product-item" style="color: #333333 !important;">
                    <strong style="color: #333333 !important;">${product.product_name}</strong> × ${product.quantity}
                    <div style="float: right;">$${Number(product.total).toFixed(2)}</div>
                    ${product.order_product_comment ? `<div style="margin-top: 4px; font-size: 13px; color: #777 !important; font-style: italic;">Note: ${product.order_product_comment}</div>` : ''}
                    ${product.options && product.options.length > 0 ? `
                      <div style="margin-top: 4px; font-size: 13px; color: #888 !important;">
                        Options: ${product.options.map((opt: any) => `${opt.option_name}: ${opt.option_value}`).join(', ')}
                      </div>
                    ` : ''}
                  </div>
                `,
          )
          .join('')}
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #f0f0f0;">
                  <p style="color: #333333 !important; margin: 5px 0;">Subtotal: <span style="float: right;">$${Number(quote.subtotal || 0).toFixed(2)}</span></p>
                  ${quote.coupon_code && quote.coupon_discount ? `<p style="color: #E03A3E !important; margin: 5px 0;">Discount (${quote.coupon_code}): <span style="float: right;">-$${Number(quote.coupon_discount).toFixed(2)}</span></p>` : ''}
                  ${quote.delivery_fee ? `<p style="color: #333333 !important; margin: 5px 0;">Delivery Fee: <span style="float: right;">$${Number(quote.delivery_fee).toFixed(2)}</span></p>` : ''}
                  <p style="color: #888 !important; margin: 5px 0; font-size: 12px;">GST (Included): <span style="float: right;">$${Number(quote.gst || 0).toFixed(2)}</span></p>
                  <p class="total" style="color: #E03A3E !important; font-weight: bold; font-size: 20px; margin: 10px 0 0 0;">Total: <span style="float: right;">$${Number(quote.calculated_total || quote.order_total || 0).toFixed(2)}</span></p>
                </div>
              </div>
 
              ${customMessage ? `
              <div class="quote-details" style="background-color: #fff9f9; border: 1px solid #fee;">
                <h2 style="color: #E03A3E !important;">Message from ${companyName}</h2>
                <p style="color: #333333 !important; font-style: italic;">"${customMessage}"</p>
              </div>` : ''}
 
              <div style="text-align: center; margin: 30px 0;">
                <a href="${publicQuoteUrl}" class="cta-button" style="color: #ffffff !important; background-color: #E03A3E; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; font-weight: bold;">Review & Approve Quote</a>
              </div>
              
              <p style="font-size: 13px; color: #888 !important; text-align: center;">
                Alternatively, you can request modifications or reject the quote by clicking the button above.
              </p>
            </div>
            <div class="footer">
              <p style="color: #666666 !important;">If you have any questions, please reply to this email or contact us directly.</p>
              <p style="color: #666666 !important; font-weight: bold;">&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email (non-blocking - don't fail if email fails)
      let emailResult;
      try {
        // 1. Send to Customer
        emailResult = await this.emailService.sendEmail({
          to: recipientEmailFinal,
          subject: emailSubject,
          html: emailBody,
          attachments: logoAttachment ? [logoAttachment] : [],
        });

        // 2. Send Admin Copy
        const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || this.configService.get<string>('FROM_EMAIL');
        if (adminEmail && adminEmail !== recipientEmailFinal) {
          try {
            await this.emailService.sendEmail({
              to: adminEmail,
              subject: `[ADMIN COPY] Quote #${quote.order_id} sent to ${customerName}`,
              html: `
                <div style="background-color: #fff4f4; padding: 15px; border: 1px solid #e03a3e; margin-bottom: 20px; border-radius: 8px; color: #333;">
                  <strong style="color: #e03a3e;">ADMIN NOTIFICATION:</strong> Below is a copy of the quote sent to <strong>${customerName}</strong> (${recipientEmailFinal}).
                </div>
                ${emailBody}
              `,
              attachments: logoAttachment ? [logoAttachment] : [],
            });
          } catch (adminEmailError) {
            this.logger.error('Failed to send admin copy of quote (non-blocking):', adminEmailError);
          }
        }
      } catch (emailError: any) {
        this.logger.error('Email sending to customer failed (non-blocking):', emailError);
        emailResult = {
          success: false,
          error: emailError?.message || 'Email sending failed',
        };
      }

      // Update quote status if email sent successfully
      // Note: quote_token is already set above if it didn't exist
      if (emailResult.success) {
        await manager.query(
          `UPDATE orders 
           SET order_status = $1,
               date_modified = CURRENT_TIMESTAMP
           WHERE order_id = $2 AND standing_order = 0`,
          [4, id],
        );
      }

      // Always return success for quote creation, even if email fails
      return {
        success: true, // Always true - quote was created
        email_sent: emailResult.success,
        message: emailResult.success
          ? `Quote email sent successfully to ${recipientEmailFinal}. Quote status updated to "Awaiting Approval".`
          : `Quote created successfully. Email sending failed: ${emailResult.error}. You can send the email manually later.`,
        quote_url: publicQuoteUrl,
        sent_to: recipientEmailFinal,
        status_updated: emailResult.success,
        email_error: emailResult.success ? null : emailResult.error,
      };
    });
  }
}