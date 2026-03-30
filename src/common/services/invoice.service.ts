import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

import { S3Service } from './s3.service';
import { Order } from '../../entities/Order';

export interface InvoiceData {
  order_id: number;
  order_date: string;
  delivery_date?: string;
  delivery_time?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  company_name?: string;
  department_name?: string;
  location_name?: string;
  location_address?: string;
  location_phone?: string;
  delivery_address?: string;
  delivery_contact?: string;
  delivery_details?: string;
  location_company_name?: string;
  location_abn?: string;
  location_email?: string;
  customer_company_address?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    total: number;
    comment?: string;
    product_desc_1?: string;
    product_desc_2?: string;
    product_description?: string;
    options?: Array<{
      option_name: string;
      option_value: string;
      option_quantity: number;
      option_price: number;
    }>;
  }>;
  subtotal: number;
  wholesale_discount?: number;
  delivery_fee: number;
  late_fee?: number;
  discount: number;
  gst: number;
  total: number;
  amount_paid: number;
  balance: number;
  order_status: number;
  payment_status: string;
  payment_date?: string;
  order_comments?: string;
  is_quote?: boolean;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_bsb?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private dataSource: DataSource,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) { }

  /**
   * Generate PDF invoice for an order
   */
  async generateInvoice(orderId: number): Promise<string> {
    try {
      const orderData = await this.fetchOrderData(orderId);
      const pdfBuffer = await this.generatePDF(orderData);
      const result = await this.s3Service.uploadInvoice(pdfBuffer, orderId);

      // Update order with invoice URL (if column exists)
      try {
        await this.dataSource.query(`UPDATE orders SET invoice_url = $1 WHERE order_id = $2`, [
          result.url,
          orderId,
        ]);
      } catch (error: any) {
        if (error.message && error.message.includes('invoice_url')) {
          this.logger.warn('invoice_url column does not exist, skipping update');
        } else {
          throw error;
        }
      }

      return result.url;
    } catch (error) {
      this.logger.error('Invoice generation error:', error);
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch order data from database
   */
  private async fetchOrderData(orderId: number): Promise<InvoiceData> {
    const result = await this.dataSource.query(
      `SELECT 
        o.order_id,
        o.date_added as order_date,
        o.delivery_date_time as delivery_date,
        o.delivery_fee,
        o.late_fee,
        o.order_status,
        o.payment_status,
        o.payment_date,
        o.order_comments,
        o.delivery_address,
        o.order_total,
        o.gst as stored_gst,
        COALESCE(NULLIF(o.firstname || ' ' || o.lastname, ' '), c.firstname || ' ' || c.lastname) as customer_name,
        COALESCE(o.email, c.email) as customer_email,
        COALESCE(o.telephone, c.telephone) as customer_phone,
        c.customer_type,
        comp.company_name,
        comp.company_abn,
        comp.company_address as customer_company_address,
        d.department_name,
        loc.location_name,
        loc.company_name as location_company_name,
        loc.abn as location_abn,
        loc.remittance_email as location_email,
        loc.pickup_address as location_address,
        loc.contact as location_phone,
        loc.account_name as bank_account_name,
        loc.account_number as bank_account_number,
        loc.bsb as bank_bsb,
        o.coupon_id,
        o.coupon_discount as stored_coupon_discount,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        o.delivery_method,
        o.delivery_contact,
        o.delivery_details,
        o.pickup_delivery_notes,
        o.standing_order,
        COALESCE((
          SELECT SUM(amount - refund_amount)
          FROM payment_history
          WHERE order_id = o.order_id
          AND payment_status IN ('succeeded', 'paid', 'completed')
        ), 0) as amount_paid
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company comp ON COALESCE(o.company_id, c.company_id) = comp.company_id
      LEFT JOIN department d ON COALESCE(o.department_id, c.department_id) = d.department_id
      LEFT JOIN locations loc ON o.location_id = loc.location_id
      LEFT JOIN coupon cp ON o.coupon_id = cp.coupon_id
      WHERE o.order_id = $1`,
      [orderId],
    );

    if (result.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = result[0];

    // Fetch order items
    const itemsResult = await this.dataSource.query(
      `SELECT 
        p.product_name,
        op.quantity,
        op.price,
        op.total,
        op.order_product_id,
        op.order_product_comment,
        p.product_desc_1,
        p.product_desc_2,
        p.product_description
      FROM order_product op
      LEFT JOIN product p ON op.product_id = p.product_id
      WHERE op.order_id = $1
      ORDER BY op.order_product_id`,
      [orderId],
    );

    // Fetch order product options
    const optionsResult = await this.dataSource.query(
      `SELECT 
        opo.order_product_id,
        opo.option_name,
        opo.option_value,
        opo.option_quantity,
        opo.option_price
      FROM order_product_option opo
      WHERE opo.order_product_id IN (
        SELECT order_product_id FROM order_product WHERE order_id = $1
      )
      ORDER BY opo.order_product_id, opo.order_product_option_id`,
      [orderId],
    );

    // Calculate subtotal
    let subtotal = 0;
    const itemsWithOptions = itemsResult.map((row: any) => {
      const productTotal = parseFloat(row.total) || 0;
      const productOptions = optionsResult.filter((opt: any) => opt.order_product_id === row.order_product_id);
      
      // Note: row.total (from order_product table) already includes options for Caterly
      subtotal += productTotal;

      return {
        product_name: row.product_name,
        quantity: parseInt(row.quantity),
        price: parseFloat(row.price),
        total: productTotal,
        comment: row.order_product_comment || undefined,
        product_desc_1: row.product_desc_1 || undefined,
        product_desc_2: row.product_desc_2 || undefined,
        product_description: row.product_description || undefined,
        options: productOptions.length > 0 ? productOptions.map((opt: any) => ({
          option_name: opt.option_name,
          option_value: opt.option_value,
          option_quantity: parseInt(opt.option_quantity || 1),
          option_price: parseFloat(opt.option_price || 0),
        })) : undefined,
      };
    });

    const deliveryFee = parseFloat(order.delivery_fee || 0);

    // Calculate coupon discount (no wholesale discount - removed as per requirements)
    let couponDiscount = 0;
    if (order.coupon_id) {
      // First, try to use stored coupon_discount from orders table (for historical accuracy)
      if (order.stored_coupon_discount && parseFloat(order.stored_coupon_discount) > 0) {
        couponDiscount = parseFloat(order.stored_coupon_discount);
      } else if (order.coupon_code && order.coupon_discount) {
        // Coupon still exists - calculate from coupon table
        if (order.coupon_type === 'P') {
          couponDiscount = subtotal * (parseFloat(order.coupon_discount) / 100);
        } else if (order.coupon_type === 'F') {
          couponDiscount = parseFloat(order.coupon_discount);
        }
        couponDiscount = Math.min(couponDiscount, subtotal);
      } else {
        // Coupon was deleted - calculate from stored order_total (GST is inclusive)
        const tempAfterDiscount = subtotal;
        const tempTotal = tempAfterDiscount + deliveryFee; // Total is inclusive of GST
        const tempGst = tempTotal * (11 / 111); // Calculate GST as 11% but display as 10%
        const storedTotal = parseFloat(order.order_total || 0);
        if (storedTotal < tempTotal) {
          couponDiscount = tempTotal - storedTotal;
        }
      }
    }

    const afterDiscount = subtotal - couponDiscount;
    const lateFee = parseFloat(order.late_fee || 0);

    // Use stored total and GST if available, otherwise recalculate
    // This ensures consistency with what's stored in the database
    const storedTotal = parseFloat(order.order_total || 0);
    const storedGst = order.stored_gst !== null ? parseFloat(order.stored_gst) : null;

    const total = storedTotal > 0 ? storedTotal : Math.round((afterDiscount + deliveryFee + lateFee) * 100) / 100;
    const gst = storedGst !== null ? storedGst : Math.round((afterDiscount * 0.1) * 100) / 100;

    // Calculate amount paid and balance
    const amountPaid = parseFloat(order.amount_paid || 0);
    // Check payment status: order_status 2 means Paid, OR payment_status is succeeded/paid/completed, OR there's a successful payment in payment_history
    const hasSuccessfulPayment = amountPaid > 0 ||
      order.order_status === 2 ||
      order.payment_status === 'paid' ||
      order.payment_status === 'succeeded' ||
      order.payment_status === 'completed';
    const isPaid = hasSuccessfulPayment;
    const balance = isPaid ? 0 : Math.max(0, total - amountPaid);

    // Determine payment status string
    let paymentStatusStr = 'pending';
    if (hasSuccessfulPayment) {
      paymentStatusStr = 'paid';
    } else if (order.order_status === 1) {
      paymentStatusStr = 'pending';
    } else if (order.order_status === 7) {
      paymentStatusStr = 'completed';
    }

    // Extract delivery time from delivery_date_time
    let deliveryTime: string | undefined = undefined;
    if (order.delivery_date) {
      try {
        const deliveryDateTime = new Date(order.delivery_date);
        deliveryTime = deliveryDateTime.toLocaleTimeString('en-AU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true, // Use AM/PM
        });
      } catch (error) {
        this.logger.warn('Could not parse delivery time:', error);
      }
    }

    // Determine if this is a quote (payment_status = 'quote' or standing_order = 0 and order_status = 0)
    const isQuote = order.payment_status === 'quote' ||
      (order.order_status === 0 && order.standing_order === 0);

    // Parse delivery_contact to extract name and number
    let deliveryContactName: string | undefined = undefined;
    let deliveryContactNumber: string | undefined = undefined;
    let deliveryContactDisplay: string | undefined = undefined;
    if (order.delivery_contact) {
      const parts = order.delivery_contact.split('|');
      deliveryContactName = parts[0]?.trim() || undefined;
      deliveryContactNumber = parts[1]?.trim() || undefined;
      // Combine name and number if both exist, otherwise use whichever is available
      if (deliveryContactName && deliveryContactNumber) {
        deliveryContactDisplay = `${deliveryContactName} - ${deliveryContactNumber}`;
      } else {
        deliveryContactDisplay = deliveryContactNumber || deliveryContactName || order.delivery_contact;
      }
    }

    return {
      order_id: order.order_id,
      order_date: order.order_date,
      delivery_date: order.delivery_date,
      delivery_time: deliveryTime,
      customer_name: order.customer_name || 'N/A',
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      company_name: order.company_name,
      department_name: order.department_name,
      location_name: order.location_name,
      location_company_name: order.location_company_name,
      location_abn: order.location_abn,
      location_email: order.location_email,
      location_address: order.location_address,
      location_phone: order.location_phone,
      customer_company_address: order.customer_company_address,
      delivery_address: order.delivery_address,
      delivery_contact: deliveryContactDisplay,
      delivery_details: order.pickup_delivery_notes || order.order_comments || order.delivery_details,
      items: itemsWithOptions,
      subtotal,
      wholesale_discount: 0, // Removed wholesale discount as per requirements
      delivery_fee: deliveryFee,
      late_fee: lateFee,
      discount: couponDiscount,
      gst,
      total,
      amount_paid: amountPaid,
      balance,
      order_status: order.order_status,
      payment_status: paymentStatusStr,
      payment_date: order.payment_date,
      order_comments: order.order_comments,
      is_quote: isQuote,
      bank_account_name: order.bank_account_name,
      bank_account_number: order.bank_account_number,
      bank_bsb: order.bank_bsb,
    };
  }

  /**
   * Get company settings from database
   */
  private async getCompanySettings(): Promise<{
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAbn: string;
    companyAddress: string;
  }> {
    try {
      const settingsResult = await this.dataSource.query(
        `SELECT setting_key, setting_value 
         FROM settings 
         WHERE setting_key IN ('company_name', 'company_email', 'company_phone', 'company_abn', 'company_address')`
      );

      const settings: Record<string, string> = {};
      settingsResult.forEach((row: any) => {
        settings[row.setting_key] = row.setting_value;
      });

      return {
        companyName: 'Caterly', // Force Caterly branding
        companyEmail: settings.company_email || this.configService.get<string>('COMPANY_EMAIL') || 'info@caterly.com.au',
        companyPhone: settings.company_phone || this.configService.get<string>('COMPANY_PHONE') || '+61 1300 827 286',
        companyAbn: settings.company_abn || this.configService.get<string>('COMPANY_ABN') || 'ABN: 12 345 678 901',
        companyAddress: settings.company_address || this.configService.get<string>('COMPANY_ADDRESS') || '75 Dorcas St, South Melbourne 3205',
      };
    } catch (error) {
      this.logger.warn('Could not fetch company settings from database, using defaults:', error);
      return {
        companyName: 'Caterly',
        companyEmail: this.configService.get<string>('COMPANY_EMAIL') || 'info@caterly.com.au',
        companyPhone: this.configService.get<string>('COMPANY_PHONE') || '+61 3 1234 5678',
        companyAbn: this.configService.get<string>('COMPANY_ABN') || 'ABN: 12 345 678 901',
        companyAddress: this.configService.get<string>('COMPANY_ADDRESS') || '123 Business Street\nMelbourne, VIC 3000',
      };
    }
  }

  /**
   * Generate PDF buffer for an order (for email attachments)
   */
  async generatePDFBuffer(orderId: number): Promise<Buffer> {
    const orderData = await this.fetchOrderData(orderId);
    return this.generatePDF(orderData);
  }

  /**
   * Generate PDF document
   */
  private async generatePDF(data: InvoiceData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // Force ZENN branding - completely ignore database settings
        // Fetch company settings for address and contact info
        const companySettings = await this.getCompanySettings();
        const brandingName = data.location_company_name || 'Caterly'; // Use location company name if available
        this.logger.log(`Generating ${data.order_status === 0 ? 'Quote' : 'Invoice'} #${data.order_id} for company: ${brandingName}`);

        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: data.is_quote ? `Quote #${data.order_id}` : `Invoice #${data.order_id}`,
            Author: brandingName,
            Subject: data.is_quote ? 'Quote' : 'Invoice',
          },
        });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Colors - Caterly theme (red)
        const primaryColor = '#E03A3E'; // Caterly red
        const darkGray = '#333333';
        const lightGray = '#666666';
        const borderGray = '#e0e0e0';
        const bgGray = '#f8f9fa';

        // Header Section - Logo centered at top, address top right (matching caterly format)
        const headerY = 15;
        const pageWidth = doc.page.width;
        const pageMargin = 40;
        const pageHeight = doc.page.height;

        // Branding Name - Top Left
        doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text(brandingName, pageMargin, headerY);

        // Company Logo - below branding name
        let logoHeight = 25; // Height for text branding
        const logoStartY = headerY + 18;

        // Try multiple potential paths for the logo (exhaustive search)
        const potentialLogoPaths = [
          path.join(process.cwd(), 'src', 'assets', 'logo.png'),
          path.resolve(process.cwd(), 'src/assets/logo.png'),
          path.join(__dirname, '..', '..', 'assets', 'logo.png'), // src/assets relative to src/common/services
          path.join(__dirname, '..', '..', '..', 'src', 'assets', 'logo.png'), // src/assets relative to compiled dist
          path.join(__dirname, '..', '..', '..', 'assets', 'logo.png'), // assets relative to dist
          path.join(process.cwd(), 'dist', 'src', 'assets', 'logo.png'),
          path.join(process.cwd(), 'dist', 'assets', 'logo.png'),
          path.join(process.cwd(), 'dist', 'assets', 'assets', 'logo.png'), // Handle messy builds
          path.join(process.cwd(), 'assets', 'logo.png'),
          'src/assets/logo.png',
          'assets/logo.png',
        ];

        let logoPath: string | null = null;
        for (const p of potentialLogoPaths) {
          try {
            if (fs.existsSync(p)) {
              logoPath = p;
              this.logger.log(`PDF logo found at: ${logoPath}`);
              break;
            }
          } catch (_) {}
        }

        if (logoPath) {
          try {
            const logoWidth = 100; // Fixed width for logo
            doc.image(logoPath, pageMargin, logoStartY, { width: logoWidth, fit: [100, 60] });
            logoHeight = 18 + 65; // Branding + Logo
          } catch (error) {
            this.logger.error('Could not add logo image to PDF:', error);
            logoHeight = 25;
          }
        } else {
          logoHeight = 25;
        }

        // Calculate total header height (company name + logo/text)
        const totalHeaderHeight = logoHeight;

        // Company Information - Address in top right corner (compact) - matching caterly format
        const companyEmail = data.location_email || companySettings.companyEmail;
        const companyPhone = data.location_phone || companySettings.companyPhone;
        const companyABN = data.location_abn || companySettings.companyAbn;
        const companyAddress = data.location_address || companySettings.companyAddress;

        doc.fontSize(8).font('Helvetica-Bold').fillColor(darkGray);
        const addressStartY = headerY + 1; // Start at same level as company name/logo
        const addressWidth = 170; // Width for right-aligned text
        const addressStartX = pageWidth - pageMargin - addressWidth; // Right-aligned

        let addressY = addressStartY;
        doc.text(brandingName, addressStartX, addressY, { align: 'right', width: addressWidth });
        addressY += 9; // Spacing after company name

        doc.fontSize(7).font('Helvetica');
        const companyAddressLines = companyAddress.split('\n');

        // Address lines - right aligned (tight spacing) - matching caterly format
        companyAddressLines.forEach((line: string) => {
          if (line.trim()) {
            doc.text(line.trim(), addressStartX, addressY, { align: 'right', width: addressWidth });
            addressY += 7; // Very tight spacing
          }
        });

        // Add spacing before contact information
        addressY += 1;

        // Contact information - right aligned (tight) - matching caterly format
        doc.text(`Phone: ${companyPhone}`, addressStartX, addressY, { align: 'right', width: addressWidth });
        addressY += 7;
        doc.text(`Email: ${companyEmail}`, addressStartX, addressY, { align: 'right', width: addressWidth });
        addressY += 7;
        doc.text(companyABN, addressStartX, addressY, { align: 'right', width: addressWidth });

        doc.fillColor(darkGray);

        // Invoice/Quote Title Section - Below logo/company name (very compact spacing) - matching caterly format
        const documentTitle = data.is_quote ? 'QUOTE' : 'INVOICE';
        const documentNumberLabel = data.is_quote ? 'Quote Number:' : 'Invoice Number:';
        const documentDateLabel = data.is_quote ? 'Quote Date:' : 'Invoice Date:';

        const titleY = Math.max(headerY + totalHeaderHeight + 8, addressY + 5);
        doc.rect(40, titleY, 520, 25).fillColor(primaryColor).fill().fillColor('#ffffff');

        doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text(documentTitle, 40, titleY + 7, { width: 520, align: 'center' });

        doc.fillColor(darkGray);

        // Invoice/Quote Details Section - very compact spacing
        const detailsY = titleY + 32;
        doc.fontSize(8).font('Helvetica');

        doc.font('Helvetica-Bold').text(documentNumberLabel, 40, detailsY);
        doc.font('Helvetica').text(`#${data.order_id}`, 130, detailsY);

        doc.font('Helvetica-Bold').text(documentDateLabel, 40, detailsY + 9);
        // Format date in Australian time (no timezone, just date)
        const quoteDate = new Date(data.order_date);
        const auDateStr = quoteDate.toLocaleDateString('en-AU', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Australia/Sydney',
        });
        doc.font('Helvetica').text(auDateStr, 130, detailsY + 9);

        if (data.delivery_date) {
          doc.font('Helvetica-Bold').text('Delivery Day:', 40, detailsY + 18);
          const deliveryDate = new Date(data.delivery_date);
          const auDeliveryDayStr = deliveryDate.toLocaleDateString('en-AU', {
            weekday: 'long',
            timeZone: 'Australia/Sydney',
          });
          doc.font('Helvetica').text(auDeliveryDayStr, 130, detailsY + 18);

          doc.font('Helvetica-Bold').text('Delivery Date:', 40, detailsY + 27);
          const auDeliveryDateStr = deliveryDate.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'Australia/Sydney',
          });
          doc.font('Helvetica').text(auDeliveryDateStr, 130, detailsY + 27);

          // Add delivery time if available
          if (data.delivery_time) {
            doc.font('Helvetica-Bold').text('Delivery Time:', 40, detailsY + 36);
            doc.font('Helvetica').text(data.delivery_time, 130, detailsY + 36);
          }
        }

        // Bill To Section - Left side
        const billToY = detailsY + (data.delivery_time ? 50 : 40);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text('Bill To:', 40, billToY);
        doc.rect(40, billToY + 10, 240, 1).fillColor(primaryColor).fill();

        doc.fontSize(7).font('Helvetica').fillColor(darkGray);
        let leftColY = billToY + 16;
        doc.font('Helvetica-Bold').text(data.customer_name, 40, leftColY, { width: 230 });
        leftColY += 10;
        doc.font('Helvetica');

        if (data.company_name) {
          doc.text(data.company_name, 40, leftColY, { width: 230 });
          leftColY += 9;
        }
        if (data.customer_company_address) {
          doc.text(data.customer_company_address, 40, leftColY, { width: 230 });
          const compAddrHeight = doc.heightOfString(data.customer_company_address, { width: 230 });
          leftColY += compAddrHeight + 2;
        }
        if (data.department_name) {
          doc.text(`Dept: ${data.department_name}`, 40, leftColY, { width: 230 });
          leftColY += 9;
        }
        if (data.customer_email) {
          doc.text(`Email: ${data.customer_email}`, 40, leftColY, { width: 230 });
          leftColY += 9;
        }
        if (data.customer_phone) {
          doc.text(`Phone: ${data.customer_phone}`, 40, leftColY, { width: 230 });
          leftColY += 9;
        }

        // Delivery Details Section - Right side
        const deliveryDetailsY = billToY;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text('Delivery Details:', 320, deliveryDetailsY);
        doc.rect(320, deliveryDetailsY + 10, 240, 1).fillColor(primaryColor).fill();

        doc.fontSize(7).font('Helvetica').fillColor(darkGray);
        let rightColY = deliveryDetailsY + 16;

        if (data.location_name) {
          doc.text(`Location: ${data.location_name}`, 320, rightColY, { width: 230 });
          rightColY += 9;
        }

        // Add explicit Delivery Date & Time in the Delivery section
        if (data.delivery_date) {
          const deliveryDate = new Date(data.delivery_date);
          const auDeliveryDateStr = deliveryDate.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'Australia/Sydney',
          });
          const timeStr = data.delivery_time ? ` at ${data.delivery_time}` : '';
          doc.font('Helvetica-Bold').text('Date & Time: ', 320, rightColY, { continued: true });
          doc.font('Helvetica').text(`${auDeliveryDateStr}${timeStr}`);
          rightColY += 9;
        }

        if (data.delivery_address) {
          doc.text(`Address: ${data.delivery_address}`, 320, rightColY, { width: 230 });
          const addressHeight = doc.heightOfString(`Address: ${data.delivery_address}`, { width: 230 });
          rightColY += addressHeight + 2;
        }

        if (data.delivery_contact) {
          doc.text(`Contact: ${data.delivery_contact}`, 320, rightColY, { width: 230 });
          rightColY += 9;
        }

        if (data.delivery_details) {
          doc.font('Helvetica-Bold').text('Delivery Notes: ', 320, rightColY, { continued: true });
          doc.font('Helvetica').text(`${data.delivery_details}`, { width: 230 });
          const detailsHeight = doc.heightOfString(`Delivery Notes: ${data.delivery_details}`, { width: 230 });
          rightColY += detailsHeight + 2;
        }

        // Items Table Section
        const tableStartY = Math.max(leftColY, rightColY) + 15;

        doc.rect(40, tableStartY, 520, 18).fillColor(primaryColor).fill().fillColor('#ffffff');

        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Description', 50, tableStartY + 5);
        doc.text('Qty', 360, tableStartY + 5);
        doc.text('Unit Price', 410, tableStartY + 5);
        doc.text('Total', 500, tableStartY + 5, { align: 'right', width: 60 });

        doc.fillColor(darkGray);

        // Table Rows
        let tableY = tableStartY + 20;
        const maxTableY = 750;
        const rowHeight = 12;

        data.items.forEach((item, index) => {
          if (tableY > maxTableY && index > 0) {
            doc.addPage();
            doc.rect(40, 30, 520, 20).fillColor(primaryColor).fill().fillColor('#ffffff');
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Description', 50, 35);
            doc.text('Qty', 360, 35);
            doc.text('Unit Price', 410, 35);
            doc.text('Total', 500, 35, { align: 'right', width: 60 });
            doc.fillColor(darkGray);
            tableY = 58;
          }

          if (index % 2 === 0) {
            doc.rect(40, tableY - 3, 520, rowHeight).fillColor(bgGray).fill().fillColor(darkGray);
          }

          doc.moveTo(40, tableY - 3).lineTo(560, tableY - 3).strokeColor(borderGray).lineWidth(0.5).stroke();

          const sanitizedProductName = item.product_name.replace(/[^\x20-\x7E\n]/g, '');
          doc.fontSize(7).font('Helvetica').fillColor(darkGray);
          doc.text(sanitizedProductName, 50, tableY + 1, { width: 300 });

          let extraHeight = 0;

          // Show product descriptions if available
          if (item.product_description) {
            const sanitizedDesc = item.product_description.replace(/[^\x20-\x7E\n]/g, ''); // Remove non-printable characters like Ð
            doc.fontSize(6).fillColor(lightGray);
            const descHeight = doc.heightOfString(sanitizedDesc, { width: 295 });
            doc.text(sanitizedDesc, 55, tableY + 8 + extraHeight, { width: 295 });
            doc.fillColor(darkGray);
            doc.fontSize(7);
            extraHeight += descHeight + 1;
          }

          if (item.product_desc_1) {
            const sanitizedDesc1 = item.product_desc_1.replace(/[^\x20-\x7E\n]/g, '');
            doc.fontSize(6).fillColor(lightGray);
            doc.text(sanitizedDesc1, 55, tableY + 8 + extraHeight, { width: 295 });
            doc.fillColor(darkGray);
            doc.fontSize(7);
            extraHeight += 7;
          }

          if (item.product_desc_2) {
            const sanitizedDesc2 = item.product_desc_2.replace(/[^\x20-\x7E\n]/g, '');
            doc.fontSize(6).fillColor(lightGray);
            doc.text(sanitizedDesc2, 55, tableY + 8 + extraHeight, { width: 295 });
            doc.fillColor(darkGray);
            doc.fontSize(7);
            extraHeight += 7;
          }

          // Show product comment if available
          if (item.comment) {
            const sanitizedComment = item.comment.replace(/[^\x20-\x7E\n]/g, '');
            doc.fontSize(6).fillColor(lightGray);
            doc.text(`Note: ${sanitizedComment}`, 55, tableY + 8 + extraHeight, { width: 295 });
            doc.fillColor(darkGray);
            doc.fontSize(7);
            extraHeight += 7;
          }

          // Show options if available
          if (item.options && item.options.length > 0) {
            item.options.forEach((opt: any) => {
              doc.fontSize(6).fillColor(lightGray);
              doc.text(`${opt.option_name}: ${opt.option_value} (${opt.option_quantity}x)`, 55, tableY + 8 + extraHeight, { width: 295 });
              doc.fillColor(darkGray);
              doc.fontSize(7);
              extraHeight += 6;
            });
          }

          doc.fillColor(darkGray); // Ensure prices are in darkGray
          doc.text(item.quantity.toString(), 360, tableY + 1);
          doc.text(`$${item.price.toFixed(2)}`, 410, tableY + 1);
          doc.font('Helvetica-Bold');
          doc.text(`$${item.total.toFixed(2)}`, 500, tableY + 1, { align: 'right', width: 60 });
          doc.font('Helvetica');

          tableY += rowHeight + extraHeight;
        });

        // Bottom border of table
        doc.moveTo(40, tableY - 4).lineTo(560, tableY - 4).strokeColor(borderGray).lineWidth(1).stroke();

        // Totals Section
        const totalsStartY = tableY + 3;
        const totalsWidth = 220;
        const totalsX = 340;

        doc.fontSize(7).font('Helvetica');

        let currentY: number;

        doc.text('Subtotal:', totalsX, totalsStartY, { width: 120, align: 'right' });
        doc.text(`$${data.subtotal.toFixed(2)}`, totalsX + 130, totalsStartY, { width: 90, align: 'right' });
        currentY = totalsStartY + 9;

        if (data.wholesale_discount && data.wholesale_discount > 0) {
          doc.fillColor(primaryColor);
          doc.text('Wholesale Discount:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`-$${data.wholesale_discount.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          doc.fillColor(darkGray);
          currentY += 9;
        }

        if (data.discount > 0) {
          doc.fillColor(primaryColor);
          doc.text('Coupon Discount:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`-$${data.discount.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          doc.fillColor(darkGray);
          currentY += 9;
        }

        if (data.delivery_fee > 0) {
          doc.text('Delivery Fee:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`$${data.delivery_fee.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          currentY += 9;
        }

        if (data.late_fee && data.late_fee > 0) {
          doc.text('Late Fee:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`$${data.late_fee.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          currentY += 9;
        }

        const gstLabel = data.is_quote ? 'GST (10%):' : 'GST (10%) (Included):';
        doc.text(gstLabel, totalsX, currentY, { width: 120, align: 'right' });
        doc.text(`$${data.gst.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
        currentY += 10;

        doc.moveTo(totalsX, currentY).lineTo(totalsX + totalsWidth, currentY).strokeColor(primaryColor).lineWidth(1.5).stroke();

        currentY += 4;

        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text('Total Amount:', totalsX, currentY, { width: 120, align: 'right' });
        doc.text(`$${data.total.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
        doc.font('Helvetica').fontSize(7).fillColor(darkGray);
        currentY += 10;

        // Payment Information
        if (data.amount_paid > 0) {
          doc.text('Amount Paid:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`$${data.amount_paid.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          currentY += 9;
        }

        // Balance
        doc.moveTo(totalsX, currentY).lineTo(totalsX + totalsWidth, currentY).strokeColor(borderGray).lineWidth(0.5).stroke();
        currentY += 4;

        doc.fontSize(9).font('Helvetica-Bold');
        if (data.balance === 0) {
          doc.fillColor('#28a745'); // Green for paid
          doc.text('Balance:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`$${data.balance.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
          doc.text('PAID', totalsX + 130, currentY + 10, { width: 90, align: 'right' });
        } else {
          doc.fillColor(primaryColor); // Teal for outstanding
          doc.text('Balance Due:', totalsX, currentY, { width: 120, align: 'right' });
          doc.text(`$${data.balance.toFixed(2)}`, totalsX + 130, currentY, { width: 90, align: 'right' });
        }
        doc.font('Helvetica').fontSize(7).fillColor(darkGray);
        currentY += 15;

        // Delivery Notes Section
        if (data.delivery_details) {
          doc.fontSize(7).font('Helvetica-Bold');
          doc.text('Delivery Notes:', 40, currentY);
          doc.font('Helvetica').fontSize(6);
          doc.text(data.delivery_details, 40, currentY + 8, { width: 520 });
          currentY += doc.heightOfString(data.delivery_details, { width: 520 }) + 15;
        }

        // Payment Terms Section
        doc.fontSize(7).font('Helvetica-Bold');
        doc.text('Payment Terms:', 40, currentY);
        doc.font('Helvetica').fontSize(6);
        const paymentTerms = 'Full payment is required within 7 days of invoice date unless otherwise agreed. Please include the invoice number as your payment reference.';
        doc.text(paymentTerms, 40, currentY + 8, { width: 520 });
        currentY += doc.heightOfString(paymentTerms, { width: 520 }) + 15;

        // Order Comments Section
        if (data.order_comments) {
          doc.fontSize(7).font('Helvetica-Bold');
          doc.text('Order Comments:', 40, currentY);
          doc.font('Helvetica').fontSize(6);
          doc.text(data.order_comments, 40, currentY + 8, { width: 520 });
          currentY += doc.heightOfString(data.order_comments, { width: 520 }) + 15;
        }

        // Footer Section
        const footerY = Math.min(pageHeight - 60, currentY + 20);

        doc.moveTo(40, footerY).lineTo(560, footerY).strokeColor(borderGray).lineWidth(0.5).stroke();

        if (footerY < pageHeight - 55) {
          let footerTextY = footerY + 5;

          // Location Information
          if (data.location_name || data.location_address || data.location_phone) {
            doc.fontSize(6).font('Helvetica-Bold').fillColor(darkGray);
            doc.text('Location Information:', 40, footerTextY, { width: 520, align: 'left' });
            footerTextY = doc.y + 1;

            doc.font('Helvetica').fontSize(6).fillColor(lightGray);
            const locationInfo: string[] = [];
            if (data.location_name) locationInfo.push(data.location_name);
            if (data.location_address) locationInfo.push(data.location_address);
            if (data.location_phone) locationInfo.push(`Phone: ${data.location_phone}`);

            if (locationInfo.length > 0) {
              doc.text(locationInfo.join(' | '), 40, footerTextY, { width: 520, align: 'left' });
              footerTextY = doc.y + 2;
            }
          }

          // Bank Account Information
          if (data.bank_account_name || data.bank_account_number || data.bank_bsb) {
            doc.fontSize(6).font('Helvetica-Bold').fillColor(darkGray);
            doc.text('Payment Information:', 40, footerTextY, { width: 520, align: 'left' });
            footerTextY = doc.y + 1;

            doc.font('Helvetica').fontSize(6).fillColor(lightGray);
            const bankInfo: string[] = [];
            if (data.bank_account_name) bankInfo.push(`Account Name: ${data.bank_account_name}`);
            if (data.bank_bsb) bankInfo.push(`BSB: ${data.bank_bsb}`);
            if (data.bank_account_number) bankInfo.push(`Account No: ${data.bank_account_number}`);

            doc.text(bankInfo.join(' | '), 40, footerTextY, { width: 520, align: 'left' });
            footerTextY = doc.y + 2;
          }

          // Thank you message
          doc.fontSize(6).font('Helvetica').fillColor(lightGray);
          doc.text(`Thank you for your business! For inquiries: ${companyEmail} or ${companyPhone}`, 40, footerTextY, {
            width: 520,
            align: 'center',
          });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get invoice URL for an order (generate if doesn't exist)
   */
  async getInvoiceUrl(orderId: number): Promise<string> {
    try {
      try {
        const result = await this.dataSource.query(`SELECT invoice_url FROM orders WHERE order_id = $1`, [orderId]);

        if (result.length > 0 && result[0].invoice_url) {
          return result[0].invoice_url;
        }
      } catch (error: any) {
        if (error.message && error.message.includes('invoice_url')) {
          this.logger.warn('invoice_url column does not exist, generating new invoice');
        } else {
          throw error;
        }
      }

      return await this.generateInvoice(orderId);
    } catch (error) {
      this.logger.error('Get invoice URL error:', error);
      throw error;
    }
  }

  /**
   * Get invoice PDF buffer for an order (generate if doesn't exist)
   */
  async getInvoicePDF(orderId: number): Promise<Buffer> {
    try {
      const orderData = await this.fetchOrderData(orderId);
      const pdfBuffer = await this.generatePDF(orderData);
      return pdfBuffer;
    } catch (error) {
      this.logger.error('Get invoice PDF error:', error);
      throw error;
    }
  }
}

