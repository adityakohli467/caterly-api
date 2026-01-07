import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
// Removed fs and path imports - no logo images used, only ZENN text
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
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    total: number;
    comment?: string;
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
  ) {}

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
        c.firstname || ' ' || c.lastname as customer_name,
        c.email as customer_email,
        c.telephone as customer_phone,
        c.customer_type,
        comp.company_name,
        comp.company_abn,
        d.department_name,
        loc.location_name,
        loc.pickup_address as location_address,
        loc.contact as location_phone,
        o.coupon_id,
        o.coupon_discount as stored_coupon_discount,
        cp.coupon_code,
        cp.type as coupon_type,
        cp.coupon_discount,
        o.delivery_method,
        o.delivery_contact,
        o.delivery_details,
        o.standing_order,
        COALESCE((
          SELECT SUM(amount - refund_amount)
          FROM payment_history
          WHERE order_id = o.order_id
          AND payment_status IN ('succeeded', 'paid', 'completed')
        ), 0) as amount_paid
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company comp ON c.company_id = comp.company_id
      LEFT JOIN department d ON c.department_id = d.department_id
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
        op.order_product_comment
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
      const optionsTotal = productOptions.reduce((sum: number, opt: any) => {
        return sum + parseFloat(opt.option_price || 0) * parseFloat(opt.option_quantity || 0);
      }, 0);
      subtotal += productTotal + optionsTotal;

      return {
        product_name: row.product_name,
        quantity: parseInt(row.quantity),
        price: parseFloat(row.price),
        total: productTotal + optionsTotal,
        comment: row.order_product_comment || undefined,
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
    // GST is inclusive: calculate as 11% but display as 10%
    const lateFee = parseFloat(order.late_fee || 0);
    const total = afterDiscount + deliveryFee + lateFee; // Total is inclusive of GST
    const gst = total * (11 / 111); // Calculate GST as 11% but display as 10%

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
          hour12: false,
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
      location_address: order.location_address,
      location_phone: order.location_phone,
      delivery_address: order.delivery_address,
      delivery_contact: deliveryContactDisplay,
      delivery_details: order.delivery_details,
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
        companyName: settings.company_name || this.configService.get<string>('COMPANY_NAME') || 'ZENN',
        companyEmail: settings.company_email || this.configService.get<string>('COMPANY_EMAIL') || 'info@zenn.com.au',
        companyPhone: settings.company_phone || this.configService.get<string>('COMPANY_PHONE') || '+61 3 1234 5678',
        companyAbn: settings.company_abn || this.configService.get<string>('COMPANY_ABN') || 'ABN: 12 345 678 901',
        companyAddress: settings.company_address || this.configService.get<string>('COMPANY_ADDRESS') || '123 Business Street\nMelbourne, VIC 3000',
      };
    } catch (error) {
      this.logger.warn('Could not fetch company settings from database, using defaults:', error);
      return {
        companyName: this.configService.get<string>('COMPANY_NAME') || 'ZENN',
        companyEmail: this.configService.get<string>('COMPANY_EMAIL') || 'info@zenn.com.au',
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
        const companyName = 'ZENN'; // Always use ZENN for branding
        this.logger.log(`Generating ${data.order_status === 0 ? 'Quote' : 'Invoice'} #${data.order_id} for company: ${companyName}`);
        
        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: data.is_quote ? `Quote #${data.order_id}` : `Invoice #${data.order_id}`,
            Author: companyName,
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

        // Colors - ZENN theme (teal)
        const primaryColor = '#055160'; // ZENN teal (rgba(5, 81, 96, 1))
        const darkGray = '#333333';
        const lightGray = '#666666';
        const borderGray = '#e0e0e0';
        const bgGray = '#f8f9fa';

        // Header Section - Logo centered at top, address top right (matching caterly format)
        const headerY = 15;
        const pageWidth = doc.page.width;
        const pageMargin = 40;
        const pageHeight = doc.page.height;
        
        // Company Logo/Text - Centered at top (matching caterly format)
        // For kj4, use "ZENN" text branding instead of logo image
        let logoHeight = 0;
        const logoStartY = headerY; // Start at header position
        const zennText = 'ZENN'; // Hardcode ZENN text for kj4 branding
        doc.fontSize(28).font('Helvetica-Bold').fillColor(primaryColor);
        const logoTextWidth = doc.widthOfString(zennText);
        const logoTextX = (pageWidth - logoTextWidth) / 2; // Center horizontally
        doc.text(zennText, logoTextX, logoStartY);
        logoHeight = 35 + 5; // Add spacing
        
        // Calculate total header height (company name + logo/text)
        const totalHeaderHeight = logoStartY + logoHeight - headerY;

        // Company Information - Address in top right corner (compact) - matching caterly format
        const companyEmail = companySettings.companyEmail;
        const companyPhone = companySettings.companyPhone;
        const companyABN = companySettings.companyAbn;
        const companyAddress = companySettings.companyAddress;

        doc.fontSize(7).font('Helvetica').fillColor(darkGray);
        const addressStartY = headerY + 1; // Start at same level as company name/logo
        const addressWidth = 170; // Width for right-aligned text
        const addressStartX = pageWidth - pageMargin - addressWidth; // Right-aligned
        
        const companyAddressLines = companyAddress.split('\n');
        let addressY = addressStartY;
        
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
          doc.font('Helvetica-Bold').text('Delivery Date:', 40, detailsY + 18);
          const deliveryDate = new Date(data.delivery_date);
          const auDeliveryDateStr = deliveryDate.toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'Australia/Sydney',
          });
          doc.font('Helvetica').text(auDeliveryDateStr, 130, detailsY + 18);
          
          // Add delivery time if available
          if (data.delivery_time) {
            doc.font('Helvetica-Bold').text('Delivery Time:', 40, detailsY + 27);
            doc.font('Helvetica').text(data.delivery_time, 130, detailsY + 27);
          }
        }

        // Bill To Section - adjust Y position if delivery time is shown
        const billToY = data.delivery_time ? detailsY + 9 : detailsY;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text('Bill To:', 360, billToY);

        doc.rect(355, billToY + 9, 205, 1).fillColor(primaryColor).fill();

        doc.fontSize(7).font('Helvetica').fillColor(darkGray);
        let billToInfoY = billToY + 15;

        doc.font('Helvetica-Bold').text(data.customer_name, 360, billToInfoY, { width: 200 });
        billToInfoY += 10;
        doc.font('Helvetica');

        if (data.company_name) {
          doc.text(data.company_name, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.department_name) {
          doc.text(`Dept: ${data.department_name}`, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.customer_email) {
          doc.text(`Email: ${data.customer_email}`, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.customer_phone) {
          doc.text(`Phone: ${data.customer_phone}`, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.location_name) {
          doc.text(`Location: ${data.location_name}`, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.delivery_address) {
          const addressLines = data.delivery_address.split('\n');
          addressLines.forEach((line: string) => {
            if (line.trim()) {
              doc.text(`Delivery: ${line.trim()}`, 360, billToInfoY, { width: 200 });
              billToInfoY += 9;
            }
          });
        }

        if (data.delivery_contact) {
          doc.text(`Delivery Contact: ${data.delivery_contact}`, 360, billToInfoY, { width: 200 });
          billToInfoY += 9;
        }

        if (data.delivery_details) {
          const detailsLines = data.delivery_details.split('\n');
          detailsLines.forEach((line: string) => {
            if (line.trim()) {
              doc.text(`Delivery Notes: ${line.trim()}`, 360, billToInfoY, { width: 200 });
              billToInfoY += 9;
            }
          });
        }

        // Items Table Section - adjust based on delivery time and additional fields
        const baseTableStartY = data.delivery_time ? detailsY + 36 : detailsY + 25;
        const tableStartY = Math.max(baseTableStartY, billToInfoY + 10);

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

          doc.fontSize(7).font('Helvetica');
          doc.text(item.product_name, 50, tableY + 1, { width: 300 });
          
          let extraHeight = 0;
          
          // Show product comment if available
          if (item.comment) {
            doc.fontSize(6).fillColor(lightGray);
            doc.text(`Note: ${item.comment}`, 55, tableY + 8, { width: 295 });
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

        doc.text('GST (10%):', totalsX, currentY, { width: 120, align: 'right' });
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

        // Order Comments Section
        if (data.order_comments && currentY < pageHeight - 40) {
          const commentsY = currentY + 12;
          doc.fontSize(7).font('Helvetica-Bold');
          doc.text('Notes:', 40, commentsY);
          doc.font('Helvetica').fontSize(6);
          const commentLines = doc.heightOfString(data.order_comments, { width: 520 });
          if (commentsY + commentLines < pageHeight - 30) {
            doc.text(data.order_comments, 40, commentsY + 8, {
              width: 520,
              align: 'left',
            });
          }
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
            footerTextY += 7;
            
            doc.font('Helvetica').fontSize(6).fillColor(lightGray);
            const locationInfo: string[] = [];
            
            if (data.location_name) {
              locationInfo.push(data.location_name);
            }
            if (data.location_address) {
              locationInfo.push(data.location_address);
            }
            if (data.location_phone) {
              locationInfo.push(`Phone: ${data.location_phone}`);
            }
            
            if (locationInfo.length > 0) {
              doc.text(locationInfo.join(' | '), 40, footerTextY, {
                width: 520,
                align: 'left',
              });
              footerTextY += 8;
            }
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

