import { Module } from '@nestjs/common';
import { StorePaymentController } from './store-payment.controller';
import { StorePaymentService } from './store-payment.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StorePaymentController],
  providers: [StorePaymentService],
  exports: [StorePaymentService],
})
export class StorePaymentModule {}
