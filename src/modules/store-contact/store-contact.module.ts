import { Module } from '@nestjs/common';
import { StoreContactController } from './store-contact.controller';
import { StoreContactService } from './store-contact.service';
import { CommonModule } from '../../common/common.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [CommonModule, AdminNotificationsModule],
  controllers: [StoreContactController],
  providers: [StoreContactService],
  exports: [StoreContactService],
})
export class StoreContactModule {}

