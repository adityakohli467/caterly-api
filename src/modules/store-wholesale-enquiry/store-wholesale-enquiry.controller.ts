import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreWholesaleEnquiryService } from './store-wholesale-enquiry.service';

@ApiTags('Store Wholesale Enquiry')
@Controller('store')
export class StoreWholesaleEnquiryController {
  constructor(private readonly storeWholesaleEnquiryService: StoreWholesaleEnquiryService) {}

  @Post('wholesale-enquiry')
  @ApiOperation({ summary: 'Submit wholesale enquiry form' })
  async submitEnquiry(
    @Body() data: {
      firstName: string;
      lastName: string;
      businessName: string;
      email: string;
      phoneNumber?: string;
      businessAddress: string;
      suburb: string;
      state: string;
      postcode: string;
      businessLicense?: string;
      businessWebsite?: string;
      weeklyVolume: string;
      startMonth: string;
      startYear: string;
    },
  ) {
    return this.storeWholesaleEnquiryService.submitEnquiry(data);
  }
}

