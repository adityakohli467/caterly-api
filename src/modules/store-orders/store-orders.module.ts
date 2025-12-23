import { Module } from '@nestjs/common';
import { StoreOrdersController } from './store-orders.controller';
import { StoreOrdersService } from './store-orders.service';
import { AdminUploadModule } from '../admin-upload/admin-upload.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [AdminUploadModule, AdminNotificationsModule, CommonModule],
  controllers: [StoreOrdersController],
  providers: [StoreOrdersService],
  exports: [StoreOrdersService],
})
export class StoreOrdersModule {}
