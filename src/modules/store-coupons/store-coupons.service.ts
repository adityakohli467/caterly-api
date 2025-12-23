import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StoreCouponsService {
  private readonly logger = new Logger(StoreCouponsService.name);

  constructor(private dataSource: DataSource) {}

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
        status,
        date_start,
        date_end
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

    // Check if coupon is within valid date range
    const now = new Date();
    if (coupon.date_start && new Date(coupon.date_start) > now) {
      throw new BadRequestException({
        message: 'Coupon is not yet active',
        valid: false,
      });
    }
    if (coupon.date_end && new Date(coupon.date_end) < now) {
      throw new BadRequestException({
        message: 'Coupon has expired',
        valid: false,
      });
    }

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
