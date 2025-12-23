import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { StoreQuotesService } from './store-quotes.service';

@ApiTags('Store Quotes')
@Controller('store/quotes')
export class StoreQuotesController {
  constructor(private readonly storeQuotesService: StoreQuotesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get public quote details (no authentication required)' })
  @ApiParam({ name: 'id', type: Number })
  async getPublicQuote(@Param('id', ParseIntPipe) id: number) {
    return this.storeQuotesService.getPublicQuote(id);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit customer feedback/approval (no authentication required)' })
  @ApiParam({ name: 'id', type: Number })
  async submitCustomerFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: string; comments?: string },
  ) {
    return this.storeQuotesService.submitCustomerFeedback(id, data);
  }
}

