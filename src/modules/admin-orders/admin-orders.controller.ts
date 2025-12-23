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
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminOrdersService } from './admin-orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminOrdersController {
  constructor(private adminOrdersService: AdminOrdersService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics' })
  async getStats() {
    return this.adminOrdersService.getStats();
  }

  @Get('st-druex')
  @ApiOperation({ summary: 'Get St Druex orders' })
  async getStDruexOrders(@Query() query: any) {
    return this.adminOrdersService.getStDruexOrders(query);
  }

  @Get('wholesale')
  @ApiOperation({ summary: 'Get wholesale orders' })
  async getWholesaleOrders(@Query() query: any) {
    return this.adminOrdersService.findAll({ ...query, wholesale: 'true' });
  }

  @Get()
  @ApiOperation({ summary: 'List all orders' })
  async findAll(@Query() query: any) {
    return this.adminOrdersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminOrdersService.findOne(id);
  }

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Get order checklist' })
  async getChecklist(@Param('id', ParseIntPipe) id: number) {
    // TODO: Implement checklist logic
    return { message: 'Checklist endpoint - to be implemented' };
  }

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  async create(@Body() createOrderDto: any, @Request() req: any) {
    const userId = req.user?.user_id || 1; // Default to 1 if no user found
    return this.adminOrdersService.create(createOrderDto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update order' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateOrderDto: any, @Request() req: any) {
    const userId = req.user?.user_id || req.user?.id;
    return this.adminOrdersService.update(id, updateOrderDto, userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { order_status: number; comment?: string },
  ) {
    return this.adminOrdersService.updateStatus(id, body.order_status, body.comment);
  }

  @Put(':id/notes')
  @ApiOperation({ summary: 'Update order notes and weight' })
  async updateNotes(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { notes: string; weight?: number },
  ) {
    return this.adminOrdersService.updateOrderNotes(id, body.notes, body.weight);
  }

  @Put(':id/complete')
  @ApiOperation({ summary: 'Complete order' })
  async complete(@Param('id', ParseIntPipe) id: number) {
    return this.adminOrdersService.updateStatus(id, 2); // Paid status
  }

  @Put(':id/products/:productId/prepared')
  @ApiOperation({ summary: 'Update product prepared status' })
  async updatePrepared(
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { is_prepared: boolean },
  ) {
    // TODO: Implement prepared status update
    return { message: 'Prepared status update - to be implemented' };
  }

  @Put(':id/checklist')
  @ApiOperation({ summary: 'Update order checklist' })
  async updateChecklist(@Param('id', ParseIntPipe) id: number, @Body() checklist: any) {
    // TODO: Implement checklist update
    return { message: 'Checklist update - to be implemented' };
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Send order email to customer' })
  async sendEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email_type?: string; custom_message?: string },
  ) {
    return this.adminOrdersService.sendEmail(id, body.email_type, body.custom_message);
  }

  @Post(':id/send-payment-link')
  @ApiOperation({ summary: 'Send payment link to customer' })
  async sendPaymentLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email_payment?: string },
  ) {
    return this.adminOrdersService.sendPaymentLink(id, body?.email_payment);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminOrdersService.delete(id);
    return { message: 'Order deleted successfully' };
  }
}
