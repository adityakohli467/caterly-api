import { Module } from '@nestjs/common';
import { AdminWholesaleEnquiriesController } from './admin-wholesale-enquiries.controller';
import { AdminWholesaleEnquiriesService } from './admin-wholesale-enquiries.service';

@Module({
  imports: [],
  controllers: [AdminWholesaleEnquiriesController],
  providers: [AdminWholesaleEnquiriesService],
  exports: [AdminWholesaleEnquiriesService],
})
export class AdminWholesaleEnquiriesModule {}
