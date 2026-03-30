import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreNewsletterService } from './store-newsletter.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Newsletter')
@Controller('admin/newsletter')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminNewsletterController {
  constructor(private readonly storeNewsletterService: StoreNewsletterService) {}

  @Get()
  @ApiOperation({ summary: 'Get all newsletter subscriptions' })
  async findAll(@Query() query: any) {
    return this.storeNewsletterService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get newsletter stats' })
  async getStats() {
    return this.storeNewsletterService.getStats();
  }

  @Put(':id/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe a user' })
  async unsubscribe(@Param('id', ParseIntPipe) id: number) {
    return this.storeNewsletterService.unsubscribe(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.storeNewsletterService.delete(id);
  }
}
