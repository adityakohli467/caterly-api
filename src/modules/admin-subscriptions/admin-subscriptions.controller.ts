import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Subscriptions')
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminSubscriptionsController {
  constructor(private readonly adminSubscriptionsService: AdminSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List subscriptions (standing orders)' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listSubscriptions(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminSubscriptionsService.listSubscriptions({
      status,
      search,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single subscription' })
  @ApiParam({ name: 'id', type: Number })
  async getSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.adminSubscriptionsService.getSubscription(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'cancel_comment', required: false, type: String })
  async cancelSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body('cancel_comment') cancelComment?: string,
  ) {
    return this.adminSubscriptionsService.cancelSubscription(id, cancelComment);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate subscription' })
  @ApiParam({ name: 'id', type: Number })
  async activateSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.adminSubscriptionsService.activateSubscription(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiParam({ name: 'id', type: Number })
  async updateSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: {
      standing_order?: number;
      delivery_date_time?: string;
      order_comments?: string;
      customer_order_name?: string;
    },
  ) {
    return this.adminSubscriptionsService.updateSubscription(id, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete subscription' })
  @ApiParam({ name: 'id', type: Number })
  async deleteSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.adminSubscriptionsService.deleteSubscription(id);
  }

  @Post(':id/send-to-customer')
  @ApiOperation({ summary: 'Mark subscription as sent to customer' })
  @ApiParam({ name: 'id', type: Number })
  async sendToCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.adminSubscriptionsService.sendToCustomer(id);
  }
}
