import { Module } from '@nestjs/common';
import { AdminContactInquiriesController } from './admin-contact-inquiries.controller';
import { AdminContactInquiriesService } from './admin-contact-inquiries.service';

@Module({
  imports: [],
  controllers: [AdminContactInquiriesController],
  providers: [AdminContactInquiriesService],
  exports: [AdminContactInquiriesService],
})
export class AdminContactInquiriesModule {}
