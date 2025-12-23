import {
  Controller,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreContactService } from './store-contact.service';

@ApiTags('Store Contact')
@Controller('store')
export class StoreContactController {
  constructor(private readonly storeContactService: StoreContactService) {}

  @Post('contact')
  @ApiOperation({ summary: 'Submit contact form' })
  async submitContact(
    @Body() data: {
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      email: string;
      message: string;
    },
  ) {
    return this.storeContactService.submitContact(data);
  }
}

