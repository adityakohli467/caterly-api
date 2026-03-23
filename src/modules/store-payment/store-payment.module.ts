import { Module } from '@nestjs/common';
import { StorePaymentController } from './store-payment.controller';
import { StorePaymentService } from './store-payment.service';
import { CommonModule } from '../../common/common.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [CommonModule, AdminNotificationsModule],
  controllers: [StorePaymentController],
  providers: [StorePaymentService],
  exports: [StorePaymentService],
})
export class StorePaymentModule {}
