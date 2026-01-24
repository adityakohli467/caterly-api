import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreCouponsService } from './store-coupons.service';

@ApiTags('Store Coupons')
@Controller('store/coupons')
export class StoreCouponsController {
  constructor(private readonly storeCouponsService: StoreCouponsService) {}

  @Get()
  @ApiOperation({ summary: 'List active coupons' })
  async listActive() {
    return this.storeCouponsService.listActiveCoupons();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get coupon by code' })
  async getByCode(
    @Param('code') code: string,
    @Query('order_total') order_total?: string,
  ) {
    const total = order_total ? parseFloat(order_total) : undefined;
    return this.storeCouponsService.getCouponByCode(code, total);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code' })
  async validateCoupon(
    @Body() data: {
      coupon_code: string;
      order_total?: number;
    },
  ) {
    return this.storeCouponsService.validateCoupon(data);
  }
}
