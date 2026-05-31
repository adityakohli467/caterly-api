import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { StorePaymentService } from './store-payment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Payment')
@Controller('store/payment')
export class StorePaymentController {
  constructor(
    private readonly storePaymentService: StorePaymentService,
  ) { }

  // ─── Stripe Endpoints ───────────────────────────────────────────────

  @Post('create-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Payment Intent for an order' })
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
    return this.storePaymentService.createStripePaymentIntent(
      orderId,
      email,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('cancel-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a Stripe Payment Intent (cleanup abandoned intents)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payment_intent_id: { type: 'string' },
      },
      required: ['payment_intent_id'],
    },
  })
  async cancelPaymentIntent(
    @Body('payment_intent_id') paymentIntentId: string,
  ) {
    return this.storePaymentService.cancelPaymentIntent(paymentIntentId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Stripe payment after completion' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payment_intent_id: { type: 'string' },
        order_id: { type: 'number' },
      },
      required: ['payment_intent_id', 'order_id'],
    },
  })
  async verifyPayment(
    @Body('payment_intent_id') paymentIntentId: string,
    @Body('order_id', ParseIntPipe) orderId: number,
  ) {
    return this.storePaymentService.verifyStripePayment(paymentIntentId, orderId);
  }

  @Get('status/:orderId')
  @ApiOperation({ summary: 'Get payment status for an order' })
  @ApiParam({ name: 'orderId', type: Number })
  async getPaymentStatus(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.storePaymentService.getPaymentStatus(orderId);
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody || req.body;
    const result = await this.storePaymentService.handleStripeWebhook(rawBody, signature);
    res.json(result);
  }

  // ─── Legacy Fat Zebra Endpoints (kept for backward compatibility) ───

  @Post(':orderId/fatzebra-charge')
  @ApiOperation({ summary: '[DEPRECATED] Process Fat Zebra payment charge' })
  @ApiParam({ name: 'orderId', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Fat Zebra card token (optional if card details provided)' },
        card_holder: { type: 'string', description: 'Card holder name' },
        card_number: { type: 'string', description: 'Card number' },
        card_expiry: { type: 'string', description: 'Card expiry (MM/YYYY)' },
        cvv: { type: 'string', description: 'CVV' },
        ip_address: { type: 'string', description: 'Customer IP address' },
      },
      required: ['ip_address'],
    },
  })
  async fatZebraCharge(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const { ip_address, ...paymentData } = body;
    const result = await this.storePaymentService.processFatZebraPayment(
      orderId,
      paymentData,
      ip_address,
    );
    res.json(result);
  }

  @Get(':orderId/fatzebra-hpp')
  @ApiOperation({ summary: '[DEPRECATED] Get Fat Zebra HPP form' })
  async fatZebraHpp(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.getFatZebraHppForm(orderId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get(':orderId/process')
  @ApiOperation({ summary: 'Process payment - redirects to Fat Zebra flow' })
  @ApiParam({ name: 'orderId', type: Number })
  @ApiQuery({ name: 'auth', required: false, type: String })
  @ApiQuery({ name: 'ofrom', required: false, type: String })
  async processPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('auth') auth: string,
    @Query('ofrom') ofrom: string = 'backend',
    @Res() res: Response,
  ) {
    // Redirect to frontend payment page
    const frontendUrl = process.env.STORE_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    let paymentUrl = `${frontendUrl}/payment?order_id=${orderId}`;
    if (auth) {
      paymentUrl += `&auth=${auth}`;
    }
    res.redirect(paymentUrl);
  }


  // Legacy endpoints (kept for backward compatibility with external integrations)
  @Post('callback')
  @ApiOperation({ summary: 'Handle payment callback' })
  async handleCallback(
    @Body() body: any,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.handleCallback(body, query);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle payment callback GET' })
  async handleCallbackGet(
    @Query() query: any,
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.handleCallback({}, query);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
