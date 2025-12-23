import { Module } from '@nestjs/common';
import { StoreCouponsController } from './store-coupons.controller';
import { StoreCouponsService } from './store-coupons.service';

@Module({
  imports: [],
  controllers: [StoreCouponsController],
  providers: [StoreCouponsService],
  exports: [StoreCouponsService],
})
export class StoreCouponsModule {}
