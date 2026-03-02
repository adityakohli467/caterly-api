import { Module } from '@nestjs/common';
import { AdminQuotationInquiriesService } from './admin-quotation-inquiries.service';
import { AdminQuotationInquiriesController } from './admin-quotation-inquiries.controller';

@Module({
    controllers: [AdminQuotationInquiriesController],
    providers: [AdminQuotationInquiriesService],
    exports: [AdminQuotationInquiriesService],
})
export class AdminQuotationInquiriesModule { }
