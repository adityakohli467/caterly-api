import { Module } from '@nestjs/common';
import { StoreWholesaleEnquiryController } from './store-wholesale-enquiry.controller';
import { StoreWholesaleEnquiryService } from './store-wholesale-enquiry.service';
import { CommonModule } from '../../common/common.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [CommonModule, AdminNotificationsModule],
  controllers: [StoreWholesaleEnquiryController],
  providers: [StoreWholesaleEnquiryService],
  exports: [StoreWholesaleEnquiryService],
})
export class StoreWholesaleEnquiryModule {}

