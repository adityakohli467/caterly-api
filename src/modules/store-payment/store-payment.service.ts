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
import { PinPaymentsService } from '../../common/services/pinpayments.service';
import { FatZebraService } from '../../common/services/fatzebra.service';

@Injectable()
export class StorePaymentService {
  private readonly logger = new Logger(StorePaymentService.name);

  constructor(
    private dataSource: DataSource,
    private emailService: EmailService,
    private configService: ConfigService,
    private pinPaymentsService: PinPaymentsService,
    private fatZebraService: FatZebraService,
  ) { }

  /**
   * Process SecurePay payment (generate payment form)
   * GET /store/payment/:orderId/process
   */
  async processPayment(orderId: number, ofrom: string = 'backend'): Promise<string> {
    // SECURITY: Validate order_id is numeric
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get order details with merchant credentials
      const orderQuery = `
        SELECT 
          o.*,
          c.firstname,
          c.lastname,
          c.email,
          c.company_id,
          co.company_name,
          l.location_name,
          u.user_id,
          u.merchant_id,
          u.merchant_pass
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN company co ON c.company_id = co.company_id
        LEFT JOIN locations l ON o.location_id = l.location_id
        LEFT JOIN "user" u ON o.user_id = u.user_id
        WHERE o.order_id = $1
      `;
      const orderResult = await queryRunner.query(orderQuery, [orderId]);

      if (orderResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderResult[0];

      // SECURITY: Check if order is already paid (prevent duplicate payment attempts)
      if (order.payment_status === 'paid' || order.payment_date) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        const alreadyPaidUrl = `${frontendUrl}/payment/success?order_id=${orderId}`;
        return this.generateRedirectHtml(alreadyPaidUrl, 'Order Already Paid');
      }

      // Get merchant credentials (from user table first, then environment variables)
      let merchantId = order.merchant_id || this.configService.get<string>('SECUREPAY_MERCHANT_ID') || '';
      let merchantPass = order.merchant_pass || this.configService.get<string>('SECUREPAY_MERCHANT_PASS') || '';

      // If still not found, try to get from any user (fallback to first admin user)
      if (!merchantId || !merchantPass) {
        this.logger.warn('Merchant credentials not found in order user, checking for admin user with credentials...');
        const adminUserQuery = `
          SELECT merchant_id, merchant_pass 
          FROM "user" 
          WHERE merchant_id IS NOT NULL 
            AND merchant_pass IS NOT NULL 
            AND merchant_id != '' 
            AND merchant_pass != ''
          ORDER BY auth_level ASC
          LIMIT 1
        `;
        const adminUserResult = await queryRunner.query(adminUserQuery);
        if (adminUserResult.length > 0) {
          merchantId = merchantId || adminUserResult[0].merchant_id || '';
          merchantPass = merchantPass || adminUserResult[0].merchant_pass || '';
          this.logger.log('Using merchant credentials from admin user');
        }
      }

      if (!merchantId || !merchantPass) {
        this.logger.error('Merchant credentials missing');
        throw new InternalServerErrorException('Payment gateway not configured. Merchant credentials are missing.');
      }

      // Calculate total (matching old PHP logic)
      let discount = 0;
      if (order.coupon_id) {
        if (order.coupon_type === 'F') {
          discount = parseFloat(order.coupon_discount || 0);
        } else {
          const subtotal = parseFloat(order.order_total || 0) +
            parseFloat(order.late_fee || 0) +
            parseFloat(order.delivery_fee || 0);
          discount = subtotal * (parseFloat(order.coupon_discount || 0) / 100);
        }
      }

      const total = parseFloat(order.order_total || 0) +
        parseFloat(order.late_fee || 0) +
        parseFloat(order.delivery_fee || 0) -
        discount;

      // Convert to cents (as required by SecurePay)
      const totalCents = Math.round(total * 100);

      // Generate timestamp in GMT format: YmdHis (matching PHP gmdate("YmdHis"))
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;

      // Generate fingerprint hash (SHA1) - EXACTLY matching old PHP format
      const fingerprintString = `${merchantId}|${merchantPass}|0|${orderId}|${totalCents}|${timestamp}`;
      const fingerprint = crypto.createHash('sha1').update(fingerprintString).digest('hex');

      // Build return URLs
      const baseUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000';
      const returnUrl = `${baseUrl}/store/payment/callback`;
      const cancelUrl = `${baseUrl}/store/payment/callback`;
      const callbackUrl = `${baseUrl}/store/payment/callback`;

      // Determine SecurePay endpoint (use test in development)
      const securePayUrl = this.configService.get<string>('NODE_ENV') === 'production'
        ? 'https://payment.securepay.com.au/secureframe/invoice'
        : this.configService.get<string>('SECUREPAY_TEST_URL') || 'https://test.payment.securepay.com.au/secureframe/invoice';

      // Generate HTML form (auto-submit)
      const formHtml = this.generateSecurePayForm({
        securePayUrl,
        merchantId,
        orderId,
        timestamp,
        fingerprint,
        totalCents,
        returnUrl,
        cancelUrl,
        callbackUrl,
      });

      await queryRunner.commitTransaction();
      return formHtml;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      let discount = 0;
      if (order.coupon_id) {
        if (order.coupon_type === 'F') {
          discount = parseFloat(order.coupon_discount || 0);
        } else {
          const subtotal = parseFloat(order.order_total || 0) +
            parseFloat(order.late_fee || 0) +
            parseFloat(order.delivery_fee || 0);
          discount = subtotal * (parseFloat(order.coupon_discount || 0) / 100);
        }
      }

      const total = parseFloat(order.order_total || 0) +
        parseFloat(order.late_fee || 0) +
        parseFloat(order.delivery_fee || 0) -
        discount;

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
        ? 'https://pay.pmnts.io/'
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
   * Handle SecurePay payment callback
   * POST /store/payment/callback
   */
  async handleCallback(body: any, query: any): Promise<any> {
    // Detect if this is a Fat Zebra response
    const successful = body.successful || query.successful;
    const isFatZebra = successful !== undefined && (body.id || query.id);

    if (isFatZebra) {
      return this.handleFatZebraCallback(body, query);
    }

    // SecurePay sends POST data with payment result
    const { rescode, refid, summary_code, response_text, amount, fp_timestamp, fingerprint } = body || query;

    if (!refid) {
      throw new BadRequestException('Order reference ID is required');
    }

    const orderId = parseInt(refid as string);
    if (isNaN(orderId)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get order details with merchant credentials for validation
      const orderQuery = `
        SELECT 
          o.*,
          c.firstname,
          c.lastname,
          c.email,
          c.company_id,
          co.company_name,
          u.merchant_id,
          u.merchant_pass
        FROM orders o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN company co ON c.company_id = co.company_id
        LEFT JOIN "user" u ON o.user_id = u.user_id
        WHERE o.order_id = $1
      `;
      const orderResult = await queryRunner.query(orderQuery, [orderId]);

      if (orderResult.length === 0) {
        throw new NotFoundException('Order not found');
      }

      const order = orderResult[0];

      // SECURITY: Check if order is already paid (prevent duplicate payments)
      if (order.order_status === 2 || order.payment_status === 'paid' || order.payment_date) {
        this.logger.warn(`Payment callback received for already-paid order: ${orderId}`);
        const redirectUrl = this.configService.get<string>('PAYMENT_SUCCESS_REDIRECT_URL') ||
          'https://caterly.com.au/externalRedirect.html';
        await queryRunner.commitTransaction();
        return this.generateRedirectHtml(redirectUrl, 'Payment Already Processed');
      }

      // SECURITY: Validate fingerprint if provided
      if (fingerprint && fp_timestamp && order.merchant_id && order.merchant_pass) {
        const expectedFingerprint = crypto.createHash('sha1')
          .update(`${order.merchant_id}|${order.merchant_pass}|0|${orderId}|${amount}|${fp_timestamp}`)
          .digest('hex');

        if (fingerprint !== expectedFingerprint) {
          this.logger.error(`Fingerprint validation failed for order ${orderId}`);
          throw new BadRequestException('Security validation failed: Invalid payment signature');
        }
      }

      // SECURITY: Validate amount matches order total
      if (amount) {
        let discount = 0;
        if (order.coupon_id) {
          if (order.coupon_type === 'F') {
            discount = parseFloat(order.coupon_discount || 0);
          } else {
            const subtotal = parseFloat(order.order_total || 0) +
              parseFloat(order.late_fee || 0) +
              parseFloat(order.delivery_fee || 0);
            discount = subtotal * (parseFloat(order.coupon_discount || 0) / 100);
          }
        }
        const expectedTotal = parseFloat(order.order_total || 0) +
          parseFloat(order.late_fee || 0) +
          parseFloat(order.delivery_fee || 0) -
          discount;
        const expectedAmountCents = Math.round(expectedTotal * 100);

        if (parseInt(amount as string) !== expectedAmountCents) {
          this.logger.error(`Amount mismatch for order ${orderId}`);
          throw new BadRequestException('Amount validation failed: Payment amount does not match order total');
        }
      }

      // Check payment result codes
      const successCodes = ['00', '08', '11'];
      const isSuccess = successCodes.includes(rescode as string);

      if (isSuccess) {
        // Double-check order hasn't been paid (race condition protection)
        const checkQuery = await queryRunner.query(
          `SELECT order_status, payment_status, payment_date FROM orders WHERE order_id = $1 FOR UPDATE`,
          [orderId]
        );

        if (checkQuery[0]?.order_status === 2 ||
          checkQuery[0]?.payment_status === 'paid' ||
          checkQuery[0]?.payment_date) {
          await queryRunner.rollbackTransaction();
          this.logger.warn(`Order ${orderId} was already paid (race condition detected)`);
          const redirectUrl = this.configService.get<string>('PAYMENT_SUCCESS_REDIRECT_URL') ||
            'https://caterly.com.au/externalRedirect.html';
          return this.generateRedirectHtml(redirectUrl, 'Payment Already Processed');
        }

        // Mark order as paid
        await queryRunner.query(
          `UPDATE orders 
           SET order_status = 2,
               payment_status = 'paid', 
               payment_date = NOW(),
               mark_paid_comment = '',
               date_modified = NOW()
           WHERE order_id = $1`,
          [orderId]
        );

        await queryRunner.commitTransaction();

        // Send payment confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);

        const redirectUrl = this.configService.get<string>('PAYMENT_SUCCESS_REDIRECT_URL') ||
          'https://caterly.com.au/externalRedirect.html';
        return this.generateRedirectHtml(redirectUrl, 'Payment Successful');

      } else {
        // Payment failed
        this.logger.error("Payment failed:", { rescode, refid, summary_code, response_text });
        const errorMessage = "The order has been cancelled successfully. To pay the invoice, please click on the link sent in the email. Thank You, Caterly team";
        await queryRunner.commitTransaction();
        return this.generateErrorHtml(errorMessage);
      }

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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

        // Send confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);

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
   * Generate SecurePay form HTML
   */
  private generateSecurePayForm(params: {
    securePayUrl: string;
    merchantId: string;
    orderId: number;
    timestamp: string;
    fingerprint: string;
    totalCents: number;
    returnUrl: string;
    cancelUrl: string;
    callbackUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Payment...</title>
</head>
<body onload="document.getElementById('securepay_form').submit()">
  <form id="securepay_form" action="${params.securePayUrl}" method="post">
    <input type="hidden" name="bill_name" value="transact">
    <input type="hidden" name="merchant_id" value="${params.merchantId}">
    <input type="hidden" name="primary_ref" value="${params.orderId}">
    <input type="hidden" name="fp_timestamp" value="${params.timestamp}">
    <input type="hidden" name="fingerprint" value="${params.fingerprint}">
    <input type="hidden" name="amount" value="${params.totalCents}">
    <input type="hidden" name="txn_type" value="0">
    <input type="hidden" name="currency" value="AUD">
    <input type="hidden" name="return_url" value="${params.returnUrl}">
    <input type="hidden" name="return_url_target" value="parent">
    <input type="hidden" name="cancel_url" value="${params.cancelUrl}">
    <input type="hidden" name="callback_url" value="${params.callbackUrl}">
    <input type="hidden" name="template" value="default">
    <input type="hidden" name="card_types" value="VISA|MASTERCARD|AMEX">
    <input type="hidden" name="display_receipt" value="no">
    <input type="hidden" name="display_cardholder_name" value="no">
  </form>
  <p>Redirecting to secure payment gateway...</p>
</body>
</html>
    `;
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
   * Process Pin Payments charge
   * POST /store/payment/:orderId/charge
   */
  async processPinPayment(orderId: number, cardToken: string, ipAddress: string): Promise<any> {
    // SECURITY: Validate order_id is numeric
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      throw new BadRequestException('Valid order ID is required');
    }

    if (!cardToken) {
      throw new BadRequestException('Card token is required');
    }

    if (!ipAddress) {
      throw new BadRequestException('IP address is required');
    }

    // Check if Pin Payments is configured
    if (!this.pinPaymentsService.isConfigured()) {
      throw new InternalServerErrorException('Pin Payments is not configured');
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
        return this.generateRedirectHtml(alreadyPaidUrl, 'Order Already Paid');
      }

      // Calculate total
      let discount = 0;
      if (order.coupon_id) {
        if (order.coupon_type === 'F') {
          discount = parseFloat(order.coupon_discount || 0);
        } else {
          const subtotal = parseFloat(order.order_total || 0) +
            parseFloat(order.late_fee || 0) +
            parseFloat(order.delivery_fee || 0);
          discount = subtotal * (parseFloat(order.coupon_discount || 0) / 100);
        }
      }

      const total = parseFloat(order.order_total || 0) +
        parseFloat(order.late_fee || 0) +
        parseFloat(order.delivery_fee || 0) -
        discount;

      // Convert to cents (Pin Payments uses cents)
      const totalCents = Math.round(total * 100);

      // Get customer email
      const customerEmail = order.customer_order_email || order.email || 'customer@example.com';
      const customerName = order.customer_order_name ||
        `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
        'Customer';

      // Create charge with Pin Payments
      const chargeResponse = await this.pinPaymentsService.createCharge({
        amount: totalCents,
        currency: 'AUD',
        description: `Order #${orderId} - ${customerName}`,
        email: customerEmail,
        ip_address: ipAddress,
        card_token: cardToken,
      });

      if (chargeResponse.response.success) {
        // Double-check order hasn't been paid (race condition protection)
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
          return this.generateRedirectHtml(redirectUrl, 'Payment Already Processed');
        }

        // Mark order as paid
        await queryRunner.query(
          `UPDATE orders 
           SET order_status = 2,
               payment_status = 'paid', 
               payment_date = NOW(),
               mark_paid_comment = 'Paid via Pin Payments - Charge: ${chargeResponse.response.token}',
               date_modified = NOW()
           WHERE order_id = $1`,
          [orderId]
        );

        await queryRunner.commitTransaction();

        // Send payment confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);

        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ||
          this.configService.get<string>('ADMIN_PORTAL_URL') ||
          'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/payment/success?order_id=${orderId}`;
        return { success: true, message: 'Payment Successful', transaction_id: chargeResponse.response.token, redirect_url: redirectUrl };

      } else {
        // Payment failed
        await queryRunner.rollbackTransaction();
        this.logger.error("Pin Payments charge failed:", chargeResponse.response.error_message);
        return {
          success: false,
          message: chargeResponse.response.error_message || "Payment failed. Please try again or contact support."
        };
      }

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Pin Payments processing error:', error);

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
        return this.generateRedirectHtml(alreadyPaidUrl, 'Order Already Paid');
      }

      // Calculate total
      let discount = 0;
      if (order.coupon_id) {
        if (order.coupon_type === 'F') {
          discount = parseFloat(order.coupon_discount || 0);
        } else {
          const subtotal = parseFloat(order.order_total || 0) +
            parseFloat(order.late_fee || 0) +
            parseFloat(order.delivery_fee || 0);
          discount = subtotal * (parseFloat(order.coupon_discount || 0) / 100);
        }
      }

      const total = parseFloat(order.order_total || 0) +
        parseFloat(order.late_fee || 0) +
        parseFloat(order.delivery_fee || 0) -
        discount;

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

        // Send payment confirmation email
        await this.sendPaymentConfirmationEmail(orderId, order);

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
   */
  private async sendPaymentConfirmationEmail(orderId: number, order: any): Promise<void> {
    try {
      const customerName = order.customer_order_name ||
        `${order.firstname || ''} ${order.lastname || ''}`.trim() ||
        'Customer';

      const orderTotal = parseFloat(order.order_total || 0);
      const authToken = crypto.createHash('sha1')
        .update(`${customerName}|${customerName}|${orderId}|${orderTotal}`)
        .digest('hex');

      const toEmail = order.customer_order_email || order.email;
      const managerEmail = order.accounts_email || null;
      const emailList = managerEmail ? [toEmail, managerEmail].filter(Boolean) : [toEmail].filter(Boolean);

      if (emailList.length > 0) {
        const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:9000';
        const invoiceViewUrl = `${backendUrl}/admin/orders/${orderId}/invoice/view?auth=${authToken}&ofrom=backend`;

        const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: serif; line-height: 1.6; color: #000; margin: 0; padding: 0;">
  <div style="max-width: 825px; margin: 0 auto; padding: 25px;">
    <p style="margin: 0; font-size: 18px; line-height: 21px;">Dear ${customerName},</p>
    <p style="margin: 0; font-size: 18px; line-height: 21px;">&#160;</p>
    <div style="margin-top: 20px;">
      <p style="margin: 0; font-size: 18px; line-height: 31px;">
        <strong>The Invoice for your order at Caterly (Order #${orderId}) can be viewed at</strong>
      </p>
      <br/><br/>
      <a href="${invoiceViewUrl}">
        <button style="background-color:#E03A3E;border:solid 1px #E03A3E;cursor:pointer;border-radius:0.25rem;font-weight:600;font-size:0.8125rem;line-height:normal;padding:0.5rem 0.9rem;color:white">
          View Invoice
        </button>
      </a>
      <br/>
      <p>Please call us on Caterly (1300 827 286) for any queries.</p>
    </div>
    <div style="margin-top: 20px;">
      <p style="font-size:18px;line-height:14px;"><strong>Note:</strong> Payment must be made 7 days from the delivery date. Late payment fees will incur after 21 days.</p>
      <p>Please click on this link to view our <a href="https://caterly.com.au/index.php?route=information/information&information_id=5">Terms and Conditions</a></p>
      <p style="margin: 0; font-size: 18px; line-height: 31px;">
        Thank you and have a great day!<br/><br/>
        Kind Regards,<br/>
        Caterly Team
      </p>
    </div>
  </div>
</body>
</html>
            `;

        await this.emailService.sendEmail({
          to: emailList,
          subject: 'Caterly',
          html: emailBody,
        });
      }
    } catch (emailError) {
      this.logger.error("Failed to send payment confirmation email:", emailError);
    }
  }
}
