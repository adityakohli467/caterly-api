import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreCouponsService {
  private readonly logger = new Logger(StoreCouponsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * List active coupons for storefront
   */
  async listActiveCoupons() {
    const query = `
      SELECT 
        coupon_id,
        coupon_code,
        coupon_description,
        coupon_discount,
        type,
        status
      FROM coupon
      WHERE status = 1
      ORDER BY coupon_id DESC
    `;

    const result = await this.dataSource.query(query);

    return {
      coupons: result.map((c: any) => ({
        id: c.coupon_id,
        code: c.coupon_code,
        name: c.coupon_description,
        type: c.type === 'P' ? 'percentage' : 'fixed',
        value: parseFloat(c.coupon_discount)
      })),
    };
  }

  /**
   * Get coupon by code (optional discount preview via order_total)
   */
  async getCouponByCode(code: string, order_total?: number) {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const normalizedCouponCode = (code || '').trim().toUpperCase();
    const query = `
      SELECT 
        coupon_id,
        coupon_code,
        coupon_description,
        coupon_discount,
        type,
        status
      FROM coupon
      WHERE UPPER(TRIM(coupon_code)) = $1 AND status = 1
    `;
    const result = await this.dataSource.query(query, [normalizedCouponCode]);
    const coupon = result[0];

    if (!coupon) {
      throw new NotFoundException('Coupon not found or expired');
    }

    // Skip date-based validation to support schemas without date columns

    let discountPreview = 0;
    if (typeof order_total === 'number' && order_total > 0) {
      if (coupon.type === 'P') {
        discountPreview = (order_total * parseFloat(coupon.coupon_discount)) / 100;
      } else if (coupon.type === 'F') {
        discountPreview = parseFloat(coupon.coupon_discount);
      }
      discountPreview = Math.min(discountPreview, order_total);
    }

    return {
      valid: true,
      coupon: {
        id: coupon.coupon_id,
        code: coupon.coupon_code,
        name: coupon.coupon_description,
        type: coupon.type === 'P' ? 'percentage' : 'fixed',
        value: parseFloat(coupon.coupon_discount),
        discount_amount: parseFloat(discountPreview.toFixed(2)),
      },
    };
  }

  /**
   * Validate coupon code
   */
  async validateCoupon(data: { coupon_code: string; order_total?: number }) {
    const { coupon_code, order_total = 0 } = data;

    if (!coupon_code) {
      throw new BadRequestException('Coupon code is required');
    }

    // Trim whitespace and make case-insensitive lookup
    const normalizedCouponCode = (coupon_code || '').trim().toUpperCase();
    
    const query = `
      SELECT 
        coupon_id,
        coupon_code,
        coupon_description,
        coupon_discount,
        type,
        status
      FROM coupon
      WHERE UPPER(TRIM(coupon_code)) = $1 AND status = 1
    `;

    const result = await this.dataSource.query(query, [normalizedCouponCode]);
    const coupon = result[0];

    if (!coupon) {
      throw new NotFoundException({
        message: 'Coupon not found or expired',
        valid: false,
      });
    }

    // Skip date-based validation to support schemas without date columns

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'P') {
      // Percentage discount
      discount = (order_total * parseFloat(coupon.coupon_discount)) / 100;
    } else if (coupon.type === 'F') {
      // Fixed amount discount
      discount = parseFloat(coupon.coupon_discount);
    }

    // Don't allow discount to exceed order total
    discount = Math.min(discount, order_total);

    return {
      valid: true,
      coupon: {
        code: coupon.coupon_code,
        name: coupon.coupon_description,
        type: coupon.type === 'P' ? 'percentage' : 'fixed',
        value: parseFloat(coupon.coupon_discount),
        discount_amount: parseFloat(discount.toFixed(2)),
      },
    };
  }
}
