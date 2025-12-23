import { Module } from '@nestjs/common';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminCouponsService } from './admin-coupons.service';

@Module({
  imports: [],
  controllers: [AdminCouponsController],
  providers: [AdminCouponsService],
  exports: [AdminCouponsService],
})
export class AdminCouponsModule {}
