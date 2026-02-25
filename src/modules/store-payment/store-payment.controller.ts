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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { StorePaymentService } from './store-payment.service';
import { PinPaymentsService } from '../../common/services/pinpayments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Payment')
@Controller('store/payment')
export class StorePaymentController {
  constructor(
    private readonly storePaymentService: StorePaymentService,
    private readonly pinPaymentsService: PinPaymentsService,
  ) { }

  @Get(':orderId/pin-key')
  @ApiOperation({ summary: 'Get Pin Payments publishable key for frontend' })
  @ApiParam({ name: 'orderId', type: Number })
  async getPinKey(@Param('orderId', ParseIntPipe) orderId: number) {
    try {
      const publishableKey = this.pinPaymentsService.getPublishableKey();
      if (!publishableKey) {
        return {
          success: false,
          message: 'Pin Payments not configured. Please set PINPAYMENTS_PUBLISHABLE_KEY in environment variables.',
          publishable_key: null,
        };
      }
      return {
        success: true,
        publishable_key: publishableKey,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to get Pin Payments key',
        publishable_key: null,
      };
    }
  }

  @Post(':orderId/charge')
  @ApiOperation({ summary: 'Process Pin Payments charge with card token' })
  @ApiParam({ name: 'orderId', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        card_token: { type: 'string', description: 'Card token from Pin.js' },
        ip_address: { type: 'string', description: 'Customer IP address' },
      },
      required: ['card_token', 'ip_address'],
    },
  })
  async processPinPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { card_token: string; ip_address: string },
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.processPinPayment(
      orderId,
      body.card_token,
      body.ip_address,
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post(':orderId/fatzebra-charge')
  @ApiOperation({ summary: 'Process Fat Zebra payment charge' })
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
  @ApiOperation({ summary: 'Get Fat Zebra HPP form' })
  async fatZebraHpp(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.getFatZebraHppForm(orderId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get(':orderId/process')
  @ApiOperation({ summary: 'Process payment - redirects to Pin Payments flow' })
  @ApiParam({ name: 'orderId', type: Number })
  @ApiQuery({ name: 'ofrom', required: false, type: String })
  async processPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Query('ofrom') ofrom: string = 'backend',
    @Res() res: Response,
  ) {
    // Redirect to frontend payment page with Pin Payments
    const frontendUrl = process.env.FRONTEND_URL || process.env.ADMIN_PORTAL_URL || 'http://localhost:3000';
    const paymentUrl = `${frontendUrl}/payment?order_id=${orderId}`;
    res.redirect(paymentUrl);
  }


  // Legacy SecurePay endpoints (deprecated - kept for backward compatibility)
  @Post('callback')
  @ApiOperation({ summary: 'Handle SecurePay payment callback (deprecated)' })
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
  @ApiOperation({ summary: 'Handle SecurePay payment callback GET (deprecated)' })
  async handleCallbackGet(
    @Query() query: any,
    @Res() res: Response,
  ) {
    const html = await this.storePaymentService.handleCallback({}, query);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
