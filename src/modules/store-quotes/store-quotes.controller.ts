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

  @Get('token/:token')
  @ApiOperation({ summary: 'Get public quote details by token (no authentication required)' })
  @ApiParam({ name: 'token', type: String })
  async getPublicQuoteByToken(@Param('token') token: string) {
    return this.storeQuotesService.getPublicQuoteByToken(token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public quote details by ID (no authentication required)' })
  @ApiParam({ name: 'id', type: Number, description: 'Quote order ID (numeric only)' })
  async getPublicQuote(@Param('id', ParseIntPipe) id: number) {
    // ParseIntPipe will automatically reject non-numeric values
    return this.storeQuotesService.getPublicQuote(id);
  }

  @Post('token/:token/feedback')
  @ApiOperation({ summary: 'Submit customer feedback/approval by token (no authentication required)' })
  @ApiParam({ name: 'token', type: String })
  async submitCustomerFeedbackByToken(
    @Param('token') token: string,
    @Body() data: { action: string; comments?: string },
  ) {
    return this.storeQuotesService.submitCustomerFeedbackByToken(token, data);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit customer feedback/approval by ID (no authentication required)' })
  @ApiParam({ name: 'id', type: Number })
  async submitCustomerFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { action: string; comments?: string },
  ) {
    return this.storeQuotesService.submitCustomerFeedback(id, data);
  }
}

