import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AdminPaymentsService } from './admin-payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Payments')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminPaymentsController {
  private readonly logger = new Logger(AdminPaymentsController.name);
  
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Post('create-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Payment Intent for admin payment processing' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'number' },
        email: { type: 'string' },
      },
      required: ['order_id'],
    },
  })
  async createPaymentIntent(
    @Body('order_id', ParseIntPipe) orderId: number,
    @Body('email') email: string,
    @Req() req: any,
  ) {
    return this.adminPaymentsService.createPaymentIntent(
      orderId,
      email,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process refund' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'number' },
        amount: { type: 'number' },
      },
      required: ['order_id'],
    },
  })
  async processRefund(
    @Body('order_id', ParseIntPipe) orderId: number,
    @Body('amount') amount?: number,
  ) {
    return this.adminPaymentsService.processRefund(orderId, amount);
  }

  @Post('stripe-refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process Stripe refund' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payment_intent_id: { type: 'string' },
        amount: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['payment_intent_id'],
    },
  })
  async processStripeRefund(
    @Req() req: any,
    @Body('payment_intent_id') paymentIntentId: string,
    @Body('amount') amount?: number,
    @Body('reason') reason?: string,
  ) {
    const userId = req.user?.user_id;
    return this.adminPaymentsService.processStripeRefund(
      paymentIntentId,
      amount,
      reason,
      userId,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('order/:order_id')
  @ApiOperation({ summary: 'Get payment status for an order' })
  async getPaymentStatus(@Param('order_id', ParseIntPipe) orderId: number) {
    return this.adminPaymentsService.getPaymentStatus(orderId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get payment history with filters' })
  @ApiQuery({ name: 'order_id', required: false, type: Number })
  @ApiQuery({ name: 'customer_id', required: false, type: Number })
  @ApiQuery({ name: 'payment_status', required: false, type: String })
  @ApiQuery({ name: 'payment_gateway', required: false, type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getPaymentHistory(
    @Query('order_id') orderId?: string,
    @Query('customer_id') customerId?: string,
    @Query('payment_status') paymentStatus?: string,
    @Query('payment_gateway') paymentGateway?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminPaymentsService.getPaymentHistory({
      order_id: orderId ? parseInt(orderId) : undefined,
      customer_id: customerId ? parseInt(customerId) : undefined,
      payment_status: paymentStatus,
      payment_gateway: paymentGateway,
      date_from: dateFrom,
      date_to: dateTo,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('history/:order_id')
  @ApiOperation({ summary: 'Get order payment history' })
  async getOrderPaymentHistory(@Param('order_id', ParseIntPipe) orderId: number) {
    return this.adminPaymentsService.getOrderPaymentHistoryPublic(orderId);
  }

  @Get('audit/:transaction_id')
  @ApiOperation({ summary: 'Get payment audit log for a transaction' })
  async getPaymentAuditLog(@Param('transaction_id') transactionId: string) {
    return this.adminPaymentsService.getPaymentAuditLog(transactionId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  async getPaymentStatistics(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.adminPaymentsService.getPaymentStatistics(dateFrom, dateTo);
  }

  // Note: Stripe webhooks are handled at /store/payment/stripe/webhook
  // This endpoint is kept for backward compatibility but should not be used
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Legacy webhook endpoint (deprecated - use /store/payment/stripe/webhook)' })
  @ApiBody({
    schema: {
      type: 'object',
    },
  })
  async handleWebhook(@Body() webhookData: any, @Req() req: any) {
    this.logger.warn('Legacy webhook endpoint called - this should use Stripe webhooks instead');
    return { message: 'This endpoint is deprecated. Use /store/payment/stripe/webhook for Stripe webhooks.' };
  }
}
