import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';
import { ConfigService } from '@nestjs/config';
import { FatZebraService } from '../../common/services/fatzebra.service';
import { StripeService } from '../../common/services/stripe.service';
import { NotificationService } from '../../common/services/notification.service';
import { InvoiceService } from '../../common/services/invoice.service';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class StorePaymentService {
  private readonly logger = new Logger(StorePaymentService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private fatZebraService: FatZebraService,
    private stripeService: StripeService,
    private notificationService: NotificationService,
    private invoiceService: InvoiceService,
    private adminNotificationsService: AdminNotificationsService,
  ) { }

  // ─── Stripe Payment Methods ─────────────────────────────────────────

  /**
   * Create Stripe Payment Intent for an order (customer portal)
   */
  async createStripePaymentIntent(orderId: number, email: string, ipAddress?: string, userAgent?: string) {
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    // Get order details
    const orderQuery = `
      SELECT 
        o.order_id, o.order_total, o.order_status, o.payment_status,
        o.customer_id, o.delivery_fee, o.late_fee, o.customer_order_name, o.customer_order_email,
        c.email as customer_email, c.firstname, c.lastname, c.telephone as customer_phone
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1
    `;
    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    const order = orderResult[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if already paid
    if (order.payment_status === 'paid' || order.payment_status === 'succeeded' || order.order_status === 2) {
      throw new BadRequestException('Order is already paid');
    }

    // Check for existing pending payment intent (idempotency)
    const existingIntentQuery = `
      SELECT payment_transaction_id, gateway_response
      FROM payment_history
      WHERE order_id = $1 
        AND payment_gateway = 'stripe' 
        AND payment_status = 'pending'
        AND payment_type = 'payment_intent'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const existingIntent = await this.dataSource.query(existingIntentQuery, [orderId]);

    if (existingIntent.length > 0) {
      const existing = existingIntent[0];
      const gatewayResponse = typeof existing.gateway_response === 'string'
        ? JSON.parse(existing.gateway_response)
        : existing.gateway_response;

      // Verify the intent is still valid with Stripe AND amount matches current order total
      try {
        await this.stripeService.initialize();
        const status = await this.stripeService.getPaymentIntentStatus(existing.payment_transaction_id);
        const currentTotal = parseFloat(order.order_total || 0) + parseFloat(order.late_fee || 0);
        const currentTotalCents = Math.round(currentTotal * 100);

        if (status.status !== 'canceled' && status.status !== 'succeeded') {
          // If the order total has changed since the intent was created, cancel the old one and create a new one
          if (status.amount !== currentTotalCents) {
            try {
              await this.stripeService.cancelPaymentIntent(existing.payment_transaction_id);
              // Mark old intent as canceled in payment_history
              await this.dataSource.query(
                `UPDATE payment_history SET payment_status = 'canceled' WHERE payment_transaction_id = $1`,
                [existing.payment_transaction_id]
              );
            } catch {
              // If cancel fails, still proceed to create a new intent
            }
          } else {
            // Amount matches, safe to reuse
            return {
              success: true,
              client_secret: gatewayResponse.clientSecret,
              payment_intent_id: existing.payment_transaction_id,
              order_id: orderId,
              amount: currentTotal,
              currency: 'AUD',
            };
          }
        }
      } catch {
        // Intent no longer valid, create a new one
      }
    }

    // Initialize Stripe
    await this.stripeService.initialize();

    // Calculate total (order_total + late_fee)
    const totalAmount = parseFloat(order.order_total || 0) + parseFloat(order.late_fee || 0);
    const totalAmountCents = Math.round(totalAmount * 100);

    if (totalAmountCents <= 0) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    const customerEmail = email || order.customer_order_email || order.customer_email || '';
    const customerName = order.customer_order_name ||
      `${order.firstname || ''} ${order.lastname || ''}`.trim() || '';

    // Create Stripe Payment Intent
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: totalAmountCents,
      currency: 'aud',
      orderId: orderId.toString(),
      customerEmail,
      customerName: customerName || undefined,
      customerPhone: order.customer_phone || undefined,
      description: `Order #${orderId}`,
      metadata: {
        order_id: orderId.toString(),
        customer_id: order.customer_id?.toString() || '',
        customer_name: customerName,
      },
    });

    // Record in payment_history
    const idempotencyKey = `store_order_${orderId}_${Date.now()}`;
    await this.dataSource.query(
      `INSERT INTO payment_history (
        order_id, payment_transaction_id, payment_type, payment_status,
        payment_gateway, amount, currency, gateway_response, request_id, idempotency_key,
        customer_email, customer_id, ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        orderId,
        paymentIntent.paymentIntentId,
        'payment_intent',
        'pending',
        'stripe',
        totalAmount,
        'AUD',
        JSON.stringify(paymentIntent),
        crypto.randomUUID(),
        idempotencyKey,
        customerEmail,
        order.customer_id || null,
        ipAddress || null,
        userAgent || null,
        JSON.stringify({ order_id: orderId, customer_id: order.customer_id }),
      ]
    );

    return {
      success: true,
      client_secret: paymentIntent.clientSecret,
      payment_intent_id: paymentIntent.paymentIntentId,
      order_id: orderId,
      amount: totalAmount,
      currency: 'AUD',
    };
  }

  /**
   * Verify Stripe payment after client-side confirmation
   */
  async verifyStripePayment(paymentIntentId: string, orderId: number) {
    if (!paymentIntentId) {
      throw new BadRequestException('Payment Intent ID is required');
    }
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    await this.stripeService.initialize();
    const paymentStatus = await this.stripeService.getPaymentIntentStatus(paymentIntentId);

    if (paymentStatus.status === 'succeeded') {
      // Update order and payment history
      await this.markOrderAsPaid(orderId, paymentIntentId, paymentStatus);
      return { success: true, status: 'succeeded', order_id: orderId };
    }

    return {
      success: false,
      status: paymentStatus.status,
      order_id: orderId,
      message: `Payment status: ${paymentStatus.status}`,
    };
  }

  /**
   * Get payment status for an order
   */
  async getPaymentStatus(orderId: number) {
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    const orderQuery = `
      SELECT order_id, order_total, order_status, payment_status, payment_date
      FROM orders WHERE order_id = $1
    `;
    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    if (orderResult.length === 0) {
      throw new NotFoundException('Order not found');
    }

    const order = orderResult[0];
    const historyQuery = `
      SELECT payment_history_id, payment_transaction_id, payment_type, payment_status,
             payment_gateway, amount, refund_amount, currency, created_at
      FROM payment_history
      WHERE order_id = $1
      ORDER BY created_at DESC
    `;
    const history = await this.dataSource.query(historyQuery, [orderId]);

    return {
      order_id: order.order_id,
      order_total: order.order_total,
      payment_status: order.payment_status,
      payment_date: order.payment_date,
      is_paid: order.payment_status === 'paid' || order.payment_status === 'succeeded' || order.order_status === 2,
      payment_history: history,
    };
  }

  /**
   * Handle Stripe Webhook events
   */
  async handleStripeWebhook(rawBody: Buffer | string, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('Stripe webhook secret not configured');
    }

    await this.stripeService.initialize();
    const event = this.stripeService.verifyWebhookSignature(rawBody, signature, webhookSecret);

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as any);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as any);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as any);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle payment_intent.succeeded webhook
   */
  private async handlePaymentIntentSucceeded(paymentIntent: any) {
    const orderId = parseInt(paymentIntent.metadata?.order_id);
    if (!orderId || isNaN(orderId)) {
      this.logger.warn('Webhook: No valid order_id in payment_intent metadata');
      return;
    }

    // Check if already processed
    const orderCheck = await this.dataSource.query(
      `SELECT order_status, payment_status FROM orders WHERE order_id = $1`,
      [orderId]
    );
    if (orderCheck.length > 0 && (orderCheck[0].order_status === 2 || orderCheck[0].payment_status === 'paid')) {
      this.logger.log(`Webhook: Order ${orderId} already paid, skipping`);
      return;
    }

    await this.markOrderAsPaid(orderId, paymentIntent.id, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      paymentMethod: paymentIntent.payment_method,
      createdAt: paymentIntent.created,
      metadata: paymentIntent.metadata,
    });
  }

  /**
   * Handle payment_intent.payment_failed webhook
   */
  private async handlePaymentIntentFailed(paymentIntent: any) {
    const orderId = parseInt(paymentIntent.metadata?.order_id);
    this.logger.error(`Stripe payment failed for order ${orderId}: ${paymentIntent.last_payment_error?.message}`);

    // Update payment_history status
    await this.dataSource.query(
      `UPDATE payment_history 
       SET payment_status = 'failed',
           gateway_error = $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_transaction_id = $2`,
      [
        JSON.stringify({
          error: paymentIntent.last_payment_error?.message || 'Payment failed',
          code: paymentIntent.last_payment_error?.code,
          decline_code: paymentIntent.last_payment_error?.decline_code,
        }),
        paymentIntent.id,
      ]
    );
  }

  /**
   * Handle charge.refunded webhook
   */
  private async handleChargeRefunded(charge: any) {
    const paymentIntentId = charge.payment_intent;
    if (!paymentIntentId) return;

    const refundAmountCents = charge.amount_refunded || 0;
    const refundAmount = refundAmountCents / 100;

    // Update payment_history refund_amount
    await this.dataSource.query(
      `UPDATE payment_history 
       SET refund_amount = $1,
           payment_status = CASE WHEN $1 >= amount THEN 'refunded' ELSE payment_status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE payment_transaction_id = $2`,
      [refundAmount, paymentIntentId]
    );

    // Get order_id and update order if fully refunded
    const ph = await this.dataSource.query(
      `SELECT order_id, amount FROM payment_history WHERE payment_transaction_id = $1`,
      [paymentIntentId]
    );
    if (ph.length > 0 && refundAmount >= parseFloat(ph[0].amount)) {
      await this.dataSource.query(
        `UPDATE orders SET payment_status = 'refunded', date_modified = NOW() WHERE order_id = $1`,
        [ph[0].order_id]
      );
    }
  }

  /**
   * Mark order as paid and send confirmation
   */
  private async markOrderAsPaid(orderId: number, paymentIntentId: string, paymentData: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock and check order
      const orderCheck = await queryRunner.query(
        `SELECT order_status, payment_status, payment_date FROM orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]
      );
      if (orderCheck.length > 0 && (orderCheck[0].order_status === 2 || orderCheck[0].payment_status === 'paid')) {
        await queryRunner.commitTransaction();
        return; // Already paid
      }

      // Update order
      await queryRunner.query(
        `UPDATE orders 
         SET order_status = 2,
             payment_status = 'paid',
             payment_date = NOW(),
             mark_paid_comment = $1,
             date_modified = NOW()
         WHERE order_id = $2`,
        [`Paid via Stripe - PaymentIntent: ${paymentIntentId}`, orderId]
      );

      // Update payment_history
      await queryRunner.query(
        `UPDATE payment_history 
         SET payment_status = 'succeeded',
             gateway_response = $1::jsonb,
             processed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE payment_transaction_id = $2`,
        [JSON.stringify(paymentData), paymentIntentId]
      );

      await queryRunner.commitTransaction();

      // Send confirmation email (async, don't block)
      this.sendPostPaymentNotifications(orderId).catch(err =>
        this.logger.error('Post-payment notification error:', err)
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send payment confirmation email and admin notification
   */
  private async sendPostPaymentNotifications(orderId: number) {
    const orderQuery = `
      SELECT o.*, c.email, c.firstname, c.lastname
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1
    `;
    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    if (orderResult.length === 0) return;

    const order = orderResult[0];
    await this.sendPaymentConfirmationEmail(orderId, order);

    const customerName = order.customer_order_name ||
      `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Guest';
    await this.adminNotificationsService.createNotification({
      type: 'order',
      message: `Payment received for order #${orderId} by ${customerName} - $${parseFloat(order.order_total || 0).toFixed(2)}`,
      order_id: orderId,
    }).catch(err => this.logger.error('Failed to notify admin:', err));
  }

  /**
   * Process Fat Zebra HPP payment (generate payment form)
   * GET /store/payment/:orderId/fatzebra-hpp
   */
  async getFatZebraHppForm(orderId: number): Promise<string> {
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const orderQuery = `
        SELECT o.*, c.email
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `;
      const orderResult = await queryRunner.query(orderQuery, [orderId]);

      if (orderResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderResult[0];

      if (order.payment_status === 'paid' || order.payment_date) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        const alreadyPaidUrl = `${frontendUrl}/orders/${orderId}`;
        return this.generateRedirectHtml(alreadyPaidUrl, 'Order Already Paid');
      }

      // Calculate total
      const total = parseFloat(order.order_total || 0) + parseFloat(order.late_fee || 0);

      const totalCents = Math.round(total * 100);
      const username = this.configService.get<string>('FATZEBRA_USERNAME');
      const sharedSecret = this.configService.get<string>('FATZEBRA_SHARED_SECRET');
      const reference = `Order #${orderId}`;
      const currency = 'AUD';

      if (!username || !sharedSecret) {
        throw new InternalServerErrorException('Fat Zebra credentials not fully configured');
      }

      // Generate HMAC-MD5 verification hash
      // Format: amount + reference + currency
      const hashString = `${totalCents}${reference}${currency}`;
      const verificationHash = crypto.createHmac('md5', sharedSecret).update(hashString).digest('hex');

      const baseUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000';
      const returnUrl = `${baseUrl}/store/payment/callback`;

      const fatZebraUrl = this.configService.get<string>('NODE_ENV') === 'production'
        ? 'https://pay.fatzebra.com.au/'
        : 'https://pay.pmnts-sandbox.io/';

      return this.generateFatZebraForm({
        fatZebraUrl,
        username,
        amount: totalCents,
        reference,
        currency,
        returnUrl,
        verificationHash,
      });

    } finally {
      await queryRunner.release();
    }
  }



  /**
   * Handle payment callback (Fat Zebra)
   * POST /store/payment/callback
   */
  async handleCallback(body: any, query: any): Promise<any> {
    return this.handleFatZebraCallback(body, query);
  }

  /**
   * Handle Fat Zebra payment callback
   */
  async handleFatZebraCallback(body: any, query: any): Promise<any> {
    const data = { ...query, ...body };
    const { successful, reference, id, message, amount, verification_hash } = data;

    if (!reference) {
      throw new BadRequestException('Order reference is required');
    }

    // Extract order ID from reference (format: "Order #123")
    const orderIdMatch = reference.match(/Order #(\d+)/);
    const orderId = orderIdMatch ? parseInt(orderIdMatch[1]) : parseInt(reference);

    if (isNaN(orderId)) {
      throw new BadRequestException('Invalid order reference format');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderQuery = `
        SELECT o.*, c.email, c.firstname, c.lastname
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `;
      const orderResult = await queryRunner.query(orderQuery, [orderId]);

      if (orderResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderResult[0];

      // Security: Validate verification_hash if you wish (requires re-calculating HMAC)
      const isSuccess = successful === 'true' || successful === true;

      if (isSuccess) {
        // Double-check if already paid
        if (order.payment_status === 'paid' || order.order_status === 2) {
          await queryRunner.commitTransaction();
          const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
            this.configService.get<string>('ADMIN_PORTAL_URL') ||
            'http://localhost:3000';
          return this.generateRedirectHtml(`${frontendUrl}/orders/${orderId}`, 'Payment Already Processed');
        }

        // Update order status
        await queryRunner.query(
          `UPDATE orders 
           SET order_status = 2,
               payment_status = 'paid', 
               payment_date = NOW(),
               mark_paid_comment = 'Paid via Fat Zebra HPP - Transaction: ${id}',
               date_modified = NOW()
           WHERE order_id = $1`,
          [orderId]
        );

        await queryRunner.commitTransaction();

        // Send payment/order confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);
        
        // Notify admin
        const customerName = order.customer_order_name ||
          `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
          'Guest';
        await this.adminNotificationsService.createNotification({
          type: 'order',
          message: `New order #${orderId} placed by ${customerName} for $${parseFloat(order.order_total || 0).toFixed(2)}`,
          order_id: orderId,
        }).catch(err => this.logger.error('Failed to notify admin of new paid order:', err));

        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        return this.generateRedirectHtml(`${frontendUrl}/payment/success?order_id=${orderId}`, 'Payment Successful');
      } else {
        await queryRunner.rollbackTransaction();
        this.logger.error("Fat Zebra payment failed:", { id, message, reference });
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        return this.generateRedirectHtml(`${frontendUrl}/payment/failed?order_id=${orderId}&message=${encodeURIComponent(message || 'Unknown error')}`, 'Payment Failed');
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }




  /**
   * Generate Fat Zebra HPP form HTML
   */
  private generateFatZebraForm(params: {
    fatZebraUrl: string;
    username: string;
    amount: number;
    reference: string;
    currency: string;
    returnUrl: string;
    verificationHash: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Payment...</title>
</head>
<body onload="document.getElementById('fatzebra_form').submit()">
  <form id="fatzebra_form" action="${params.fatZebraUrl}" method="post">
    <input type="hidden" name="username" value="${params.username}">
    <input type="hidden" name="amount" value="${params.amount}">
    <input type="hidden" name="reference" value="${params.reference}">
    <input type="hidden" name="currency" value="${params.currency}">
    <input type="hidden" name="return_url" value="${params.returnUrl}">
    <input type="hidden" name="verification_hash" value="${params.verificationHash}">
  </form>
  <p>Redirecting to secure payment gateway...</p>
</body>
</html>
    `;
  }

  /**
   * Generate redirect HTML
   */
  private generateRedirectHtml(url: string, title: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${url}">
  <title>${title}</title>
</head>
<body>
  <p>${title}. Redirecting...</p>
  <script>window.location.href = "${url}";</script>
</body>
</html>
    `;
  }

  /**
   * Generate error HTML
   */
  private generateErrorHtml(message: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Error</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 800px; margin: 50px auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card-body { text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="card-body">
        <p>${message}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }



  /**
   * Process Fat Zebra payment charge
   * POST /store/payment/:orderId/fatzebra-charge
   */
  async processFatZebraPayment(orderId: number, paymentData: any, ipAddress: string): Promise<any> {
    // SECURITY: Validate order_id is numeric
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    if (!paymentData) {
      throw new BadRequestException('Payment data is required');
    }

    if (!ipAddress) {
      throw new BadRequestException('IP address is required');
    }

    // Check if Fat Zebra is configured
    if (!this.fatZebraService.isConfigured()) {
      throw new InternalServerErrorException('Fat Zebra is not configured');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get order details
      const orderQuery = `
        SELECT 
          o.*,
          c.firstname,
          c.lastname,
          c.email,
          c.company_id,
          co.company_name,
          l.location_name
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN company co ON c.company_id = co.company_id
        LEFT JOIN locations l ON o.location_id = l.location_id
        WHERE o.order_id = $1
      `;
      const orderResult = await queryRunner.query(orderQuery, [orderId]);

      if (orderResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderResult[0];

      // SECURITY: Check if order is already paid
      if (order.payment_status === 'paid' || order.payment_date) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        const alreadyPaidUrl = `${frontendUrl}/payment/success?order_id=${orderId}`;
        await queryRunner.commitTransaction();
        return { success: true, message: 'Order Already Paid', already_paid: true, redirect_url: alreadyPaidUrl };
      }

      // Calculate total
      const total = parseFloat(order.order_total || 0) + parseFloat(order.late_fee || 0);

      // Convert to cents
      const totalCents = Math.round(total * 100);

      const customerName = order.customer_order_name ||
        `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
        'Customer';

      let fatZebraResponse;
      if (paymentData.token) {
        // Tokenized purchase
        fatZebraResponse = await this.fatZebraService.createTokenPurchase({
          amount: totalCents,
          reference: `Order #${orderId}`,
          customer_ip: ipAddress,
          token: paymentData.token,
          cvv: paymentData.cvv,
        });
      } else {
        // Direct card purchase (for testing/sandbox as requested)
        fatZebraResponse = await this.fatZebraService.createPurchase({
          amount: totalCents,
          reference: `Order #${orderId}`,
          customer_ip: ipAddress,
          card_holder: paymentData.card_holder || customerName,
          card_number: paymentData.card_number,
          card_expiry: paymentData.card_expiry,
          cvv: paymentData.cvv,
        });
      }

      if (fatZebraResponse.successful) {
        // Double-check order hasn't been paid
        const checkQuery = await queryRunner.query(
          `SELECT order_status, payment_status, payment_date FROM orders WHERE order_id = $1 FOR UPDATE`,
          [orderId]
        );

        if (checkQuery[0]?.order_status === 2 ||
          checkQuery[0]?.payment_status === 'paid' ||
          checkQuery[0]?.payment_date) {
          await queryRunner.rollbackTransaction();
          this.logger.warn(`Order ${orderId} was already paid (race condition detected)`);
          const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
            this.configService.get<string>('ADMIN_PORTAL_URL') ||
            'http://localhost:3000';
          const redirectUrl = `${frontendUrl}/payment/success?order_id=${orderId}`;
          return { success: true, message: 'Payment Already Processed', already_paid: true, redirect_url: redirectUrl };
        }

        // Mark order as paid
        await queryRunner.query(
          `UPDATE orders 
           SET order_status = 2,
               payment_status = 'paid', 
               payment_date = NOW(),
               mark_paid_comment = 'Paid via Fat Zebra - Transaction: ${fatZebraResponse.id || fatZebraResponse.response?.id}',
               date_modified = NOW()
           WHERE order_id = $1`,
          [orderId]
        );

        await queryRunner.commitTransaction();

        // Send payment/order confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);
        
        // Notify admin
        await this.adminNotificationsService.createNotification({
          type: 'order',
          message: `New order #${orderId} placed by ${customerName} for $${(totalCents / 100).toFixed(2)}`,
          order_id: orderId,
        }).catch(err => this.logger.error('Failed to notify admin of new paid order:', err));

        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/payment/success?order_id=${orderId}`;
        return { success: true, message: 'Payment Successful', transaction_id: fatZebraResponse.id || fatZebraResponse.response?.id, redirect_url: redirectUrl };

      } else {
        // Payment failed
        await queryRunner.rollbackTransaction();

        // Detailed error extraction
        const fzErrors = fatZebraResponse.errors || [];
        const fzMessage = fatZebraResponse.message || fatZebraResponse.response?.message;
        const responseCode = fatZebraResponse.response_code || fatZebraResponse.response?.response_code;

        let errorMessage = "Payment failed.";
        if (fzErrors.length > 0) {
          errorMessage = fzErrors.join(', ');
        } else if (fzMessage) {
          errorMessage = fzMessage;
        } else if (responseCode) {
          errorMessage = `Payment declined (Code: ${responseCode})`;
        } else {
          errorMessage = "Payment failed. Please check your card details or try a different card.";
        }

        this.logger.error(`Fat Zebra charge failed [Order ${orderId}]: ${errorMessage}`, JSON.stringify(fatZebraResponse));

        return {
          success: false,
          message: errorMessage
        };
      }

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Fat Zebra processing error [Order ${orderId}]:`, error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      return {
        success: false,
        message: error.response?.data?.message || error.message || "An error occurred processing your payment. Please try again."
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send payment confirmation email
   * Always re-fetches order data from DB to ensure current totals and email
   */
  private async sendPaymentConfirmationEmail(orderId: number, _order?: any): Promise<void> {
    try {
      // Always fetch fresh order data from database to avoid stale totals/email
      const freshOrderQuery = `
        SELECT 
          o.order_id, o.order_total, o.order_status, o.late_fee, o.delivery_fee,
          o.customer_order_name, o.customer_order_email, o.delivery_date_time, o.delivery_address,
          c.email, c.firstname, c.lastname
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = $1
      `;
      const freshResult = await this.dataSource.query(freshOrderQuery, [orderId]);
      const order = freshResult[0];
      if (!order) {
        this.logger.error(`sendPaymentConfirmationEmail: Order #${orderId} not found in database`);
        return;
      }

      const customerName = order.customer_order_name ||
        `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
        'Customer';

      const toEmail = order.customer_order_email || order.email;
      if (!toEmail) return;

      const orderTotal = parseFloat(order.order_total || 0);

      // Generate PDF Invoice
      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await this.invoiceService.getInvoicePDF(orderId);
      } catch (invoiceError) {
        this.logger.error("Failed to generate invoice PDF for payment email:", invoiceError);
      }

      const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
      const contactNumber = this.configService.get<string>('COMPANY_PHONE') || '1300 827 286';
      
      const frontendUrl = this.configService.get<string>('STORE_PORTAL_URL') ||
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';

      // Generate auth token for invoice view
      const authToken = crypto
        .createHash('sha1')
        .update(`${customerName}|${customerName}|${orderId}|${orderTotal}`)
        .digest('hex');

      const invoiceUrl = `${frontendUrl}/orders/${orderId}/invoice?auth=${authToken}`;

      const logoAttachment = this.emailService.getLogoAttachment();
      const attachments: any[] = logoAttachment ? [logoAttachment] : [];
      
      if (pdfBuffer) {
        attachments.push({
          filename: `tax-invoice-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #fff; padding: 20px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 20px; text-align: center; border-bottom: 3px solid #E03A3E; }
    .logo { max-width: 200px; height: auto; }
    .content { padding: 20px; }
    .order-details { background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .order-info { margin: 10px 0; }
    .order-info strong { display: inline-block; width: 150px; }
    .cta-button { display: inline-block; padding: 12px 24px; background-color: #E03A3E; color: white !important; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .payment-badge { display: inline-block; padding: 5px 15px; background-color: #E03A3E; color: white; border-radius: 20px; font-weight: bold; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;" aria-hidden="true">
    Thank you for your order! Your payment has been successfully processed for order #${orderId}.
  </div>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
      <h2>Order Confirmation #${orderId}</h2>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      <div class="payment-badge">Payment Received</div>  
      <p>Thank you for your order! Your payment has been successfully processed, and your order is now being prepared.</p>
      
      <div class="order-details">
        <h3>Order Details</h3>
        <div class="order-info"><strong>Order Number:</strong> #${orderId}</div>
        <div class="order-info"><strong>Order Total:</strong> $${orderTotal.toFixed(2)}</div>
        <div class="order-info"><strong>GST:</strong> Included in total</div>
        ${order.delivery_date_time ? `<div class="order-info"><strong>Delivery Date:</strong> ${new Date(order.delivery_date_time).toLocaleDateString()}</div>` : ''}
        ${order.delivery_address ? `<div class="order-info"><strong>Delivery Address:</strong> ${order.delivery_address}</div>` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invoiceUrl}" class="cta-button">View Tax Invoice</a>
      </div>

      <p>A copy of your tax invoice is also attached to this email for your records.</p>
      
      <p>If you have any questions about your order, please don't hesitate to contact us at ${contactNumber}.</p>
      
      <p>Thank you for choosing ${companyName}!</p>

      <br>
      <p>Warm regards,<br>The ${companyName} Team</p>
    </div>
    <div class="footer">
      <p>If you have any questions, please contact us.</p>
      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `;

      await this.emailService.sendEmail({
        to: toEmail,
        subject: `Order Confirmation #${orderId} - ${companyName}`,
        html: emailHtml,
        attachments: attachments,
      });

      // Send a separate, admin-specific notification email with the same PDF attachment and direct download link
      await this.sendAdminOrderAlert(orderId, order, pdfBuffer, invoiceUrl);

      this.logger.log(`Order/Payment confirmation email sent to ${toEmail} for order #${orderId}`);

    } catch (emailError) {
      this.logger.error("Failed to send payment confirmation email:", emailError);
    }
  }

  /**
   * Send a dedicated notification to the admin about a new paid order
   */
  private async sendAdminOrderAlert(orderId: number, order: any, pdfBuffer?: Buffer | null, invoiceUrl?: string): Promise<void> {
    try {
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
      if (!adminEmail) return;

      const customerName = order.customer_order_name ||
        `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
        'Customer';

      const orderTotal = parseFloat(order.order_total || 0);
      const companyName = this.configService.get<string>('COMPANY_NAME') || 'Caterly';
      const adminUrl = this.configService.get<string>('ADMIN_PORTAL_URL') || 'https://admin.caterly.com.au';
      const orderUrl = `${adminUrl}/orders/${orderId}`;

      const logoAttachment = this.emailService.getLogoAttachment();

      const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #fce4e4; }
    .container { max-width: 600px; margin: 20px auto; background-color: #fff; padding: 20px; border: 1px solid #e03a3e; border-radius: 8px; }
    .header { background-color: #ffffff; color: #E03A3E; padding: 10px; text-align: center; border-bottom: 2px solid #E03A3E; }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 20px; }
    .alert-header { color: #E03A3E; font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: center; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .details-table td.label { font-weight: bold; width: 150px; color: #666; }
    .cta-button { display: inline-block; padding: 12px 24px; background-color: #E03A3E; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .secondary-button { display: inline-block; padding: 10px 20px; background-color: #f1f1f1; color: #333 !important; text-decoration: none; border-radius: 5px; margin: 10px 0; font-size: 14px; border: 1px solid #ccc; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoAttachment ? '<img src="cid:logo" alt="Caterly Logo" class="logo">' : `<h1>${companyName}</h1>`}
    </div>
    <div class="content">
      <div class="alert-header">PAYMENT RECEIVED</div>
      <p>Hello Admin,</p>
      <p>A payment has been successfully received on the storefront.</p>
      
      <table class="details-table">
        <tr>
          <td class="label">Order Number:</td>
          <td><strong>#${orderId}</strong></td>
        </tr>
        <tr>
          <td class="label">Customer:</td>
          <td>${customerName}</td>
        </tr>
        <tr>
          <td class="label">Amount Paid:</td>
          <td>$${orderTotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">GST:</td>
          <td>Included in total</td>
        </tr>
        <tr>
          <td class="label">Delivery Date:</td>
          <td>${order.delivery_date_time ? new Date(order.delivery_date_time).toLocaleDateString() : 'N/A'}</td>
        </tr>
        <tr>
          <td class="label">Delivery Area:</td>
          <td>${order.delivery_address || 'N/A'}</td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="${invoiceUrl || orderUrl}" class="cta-button">View Order Details</a>
      </div>

    </div>
    <div class="footer">
      <p>This is an automated notification from ${companyName} Storefront.</p>
    </div>
  </div>
</body>
</html>
      `;

      const attachments: any[] = logoAttachment ? [logoAttachment] : [];
      
      if (pdfBuffer) {
        attachments.push({
          filename: `invoice-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }

      await this.emailService.sendEmail({
        to: adminEmail,
        subject: `🚨 Order #${orderId} - ${customerName} - Payment Received`,
        html: adminEmailHtml,
        attachments: attachments,
      });

    } catch (adminEmailError) {
      this.logger.error("Failed to send admin order alert email:", adminEmailError);
    }
  }
}
