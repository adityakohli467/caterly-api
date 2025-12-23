import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreCartService {
  private readonly logger = new Logger(StoreCartService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Add item to cart (validation endpoint)
   * Cart is maintained on client-side, this endpoint validates product availability and pricing
   */
  async addToCart(data: {
    product_id: number;
    quantity?: number;
    options?: any[];
  }) {
    const { product_id, quantity = 1, options = [] } = data;

    if (!product_id) {
      throw new BadRequestException('Product ID is required');
    }

    // Get product details
    const productQuery = `
      SELECT 
        product_id,
        product_name,
        product_description,
        product_price,
        product_status,
        product_image,
        product_quantity as stock_quantity
      FROM product 
      WHERE product_id = $1
    `;

    const productResult = await this.dataSource.query(productQuery, [product_id]);
    const product = productResult[0];

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.product_status !== 1) {
      throw new BadRequestException('Product is not available');
    }

    if (product.stock_quantity < quantity) {
      throw new BadRequestException({
        message: 'Insufficient stock',
        available_quantity: product.stock_quantity,
      });
    }

    // Calculate item total
    const itemTotal = parseFloat(product.product_price) * quantity;

    // Get product options if provided
    let productOptions: any[] = [];
    if (options && options.length > 0) {
      const optionIds = options.map((opt: any) => opt.option_value_id);
      const optionsQuery = `
        SELECT 
          ov.option_value_id,
          ov.option_id,
          ov.name as option_value,
          ov.price_prefix,
          ov.price as option_price,
          o.name as option_name
        FROM option_value ov
        JOIN options o ON ov.option_id = o.option_id
        WHERE ov.option_value_id = ANY($1)
      `;
      const optionsResult = await this.dataSource.query(optionsQuery, [optionIds]);
      productOptions = optionsResult;
    }

    return {
      message: 'Product validated successfully',
      item: {
        product_id: product.product_id,
        product_name: product.product_name,
        product_description: product.product_description,
        price: parseFloat(product.product_price),
        quantity,
        image: product.product_image,
        options: productOptions,
        subtotal: itemTotal,
      },
    };
  }

  /**
   * Validate entire cart before checkout
   */
  async validateCart(data: {
    items: any[];
    coupon_code?: string;
  }) {
    const { items, coupon_code } = data;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Cart items are required');
    }

    let subtotal = 0;
    const validatedItems: any[] = [];

    // Validate each item
    for (const item of items) {
      const productQuery = `
        SELECT 
          product_id,
          product_name,
          product_price,
          product_status,
          product_quantity as stock_quantity,
          product_image
        FROM product 
        WHERE product_id = $1
      `;

      const result = await this.dataSource.query(productQuery, [item.product_id]);
      const product = result[0];

      if (!product) {
        throw new NotFoundException(`Product ${item.product_id} not found`);
      }

      if (product.product_status !== 1) {
        throw new BadRequestException(`Product "${product.product_name}" is no longer available`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new BadRequestException({
          message: `Insufficient stock for "${product.product_name}"`,
          product_id: product.product_id,
          available: product.stock_quantity,
          requested: item.quantity,
        });
      }

      const itemTotal = parseFloat(product.product_price) * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        product_id: product.product_id,
        product_name: product.product_name,
        price: parseFloat(product.product_price),
        quantity: item.quantity,
        image: product.product_image,
        subtotal: itemTotal,
        options: item.options || [],
      });
    }

    // Apply coupon if provided
    let discount = 0;
    let couponDetails: {
      code: string;
      name: string;
      discount_amount: number;
      type: string;
      value: number;
    } | null = null;

    if (coupon_code) {
      const couponQuery = `
        SELECT 
          coupon_id,
          coupon_code,
          coupon_name,
          coupon_discount,
          type,
          date_start,
          date_end,
          status,
          uses_total,
          uses_customer
        FROM coupon 
        WHERE coupon_code = $1 
        AND status = 1
        AND (date_end IS NULL OR date_end >= CURRENT_DATE)
      `;

      const couponResult = await this.dataSource.query(couponQuery, [coupon_code]);
      const coupon = couponResult[0];

      if (coupon) {
        if (coupon.type === 'P') {
          // Percentage discount
          discount = (subtotal * parseFloat(coupon.coupon_discount)) / 100;
        } else if (coupon.type === 'F') {
          // Fixed amount discount
          discount = parseFloat(coupon.coupon_discount);
        }

        // Don't allow discount to exceed subtotal
        discount = Math.min(discount, subtotal);

        couponDetails = {
          code: coupon.coupon_code,
          name: coupon.coupon_name,
          discount_amount: discount,
          type: coupon.type === 'P' ? 'percentage' : 'fixed',
          value: parseFloat(coupon.coupon_discount),
        };
      } else {
        throw new BadRequestException('Invalid or expired coupon code');
      }
    }

    const total = subtotal - discount;

    return {
      cart: {
        items: validatedItems,
        item_count: validatedItems.length,
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        coupon: couponDetails,
      },
    };
  }
}
