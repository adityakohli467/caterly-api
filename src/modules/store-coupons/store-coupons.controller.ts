import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreCouponsService } from './store-coupons.service';

@ApiTags('Store Coupons')
@Controller('store/coupons')
export class StoreCouponsController {
  constructor(private readonly storeCouponsService: StoreCouponsService) {}

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
