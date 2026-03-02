import { Controller, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { StoreQuotationService } from './store-quotation.service';

@Controller('store/quotation')
export class StoreQuotationController {
    constructor(private readonly quotationService: StoreQuotationService) { }

    /**
     * Submit a new quotation inquiry from the storefront
     * POST /store/quotation
     */
    @Post()
    async submitQuotation(@Body() quotationInquiryDto: {
        name: string;
        contact: string;
        email: string;
        delivery_date_time?: string;
        occasion?: string;
        message?: string;
        captcha?: string;
    }) {
        return this.quotationService.submitQuotationInquiry(quotationInquiryDto);
    }
}
