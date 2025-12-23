import {
  Controller,
  Post,
  Body,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreNewsletterService } from './store-newsletter.service';

@ApiTags('Store Newsletter')
@Controller('store/newsletter')
export class StoreNewsletterController {
  constructor(private readonly storeNewsletterService: StoreNewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to newsletter' })
  async subscribe(
    @Body() data: { email: string },
    @Request() req: any,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;
    return this.storeNewsletterService.subscribe(data, ipAddress, userAgent);
  }
}

