import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceService } from '../../common/services/invoice.service';
import { EmailService } from '../../common/services/email.service';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminInvoicesService {
  private readonly logger = new Logger(AdminInvoicesService.name);

  constructor(
    private invoiceService: InvoiceService,
    private emailService: EmailService,
    private dataSource: DataSource,
  ) {}

  async generateInvoice(orderId: number): Promise<string> {
    if (!orderId) {
      throw new BadRequestException('Order ID is required');
    }

    // Verify order exists
    const orderResult = await this.dataSource.query('SELECT order_id FROM orders WHERE order_id = $1', [orderId]);
    if (orderResult.length === 0) {
      throw new NotFoundException('Order not found');
    }

    return this.invoiceService.generateInvoice(orderId);
  }

  async getInvoiceUrl(orderId: number): Promise<string> {
    // Verify order exists
    const orderResult = await this.dataSource.query('SELECT order_id FROM orders WHERE order_id = $1', [orderId]);
    if (orderResult.length === 0) {
      throw new NotFoundException('Order not found');
    }

    return this.invoiceService.getInvoiceUrl(orderId);
  }

  async getInvoicePDF(orderId: number): Promise<Buffer> {
    // Verify order exists
    const orderResult = await this.dataSource.query('SELECT order_id FROM orders WHERE order_id = $1', [orderId]);
    if (orderResult.length === 0) {
      throw new NotFoundException('Order not found');
    }

    return this.invoiceService.getInvoicePDF(orderId);
  }

  async sendInvoiceEmail(orderId: number, customMessage?: string): Promise<any> {
    // Get order details
    const orderQuery = `
      SELECT 
        o.*,
        c.email as customer_email,
        c.firstname,
        c.lastname,
        c.telephone,
        co.company_name,
        d.department_name,
        l.location_name
      FROM orders o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN company co ON c.company_id = co.company_id
      LEFT JOIN department d ON c.department_id = d.department_id
      LEFT JOIN locations l ON o.location_id = l.location_id
      WHERE o.order_id = $1
    `;
    const orderResult = await this.dataSource.query(orderQuery, [orderId]);
    const order = orderResult[0];

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Determine recipient email
    const recipientEmail = order.customer_order_email || order.email || order.customer_email;
    if (!recipientEmail) {
      throw new BadRequestException('Customer email not found');
    }

    // Generate invoice PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.invoiceService.getInvoicePDF(orderId);
    } catch (error) {
      this.logger.error('Could not generate invoice PDF:', error);
      throw new BadRequestException('Failed to generate invoice PDF');
    }

    // Send email
    const customerName = order.customer_order_name || `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Customer';
    const emailResult = await this.emailService.sendInvoiceEmail(
      recipientEmail,
      orderId,
      pdfBuffer,
      customMessage,
      customerName,
    );

    return {
      success: emailResult.success,
      message: emailResult.success
        ? 'Invoice email sent successfully'
        : emailResult.error
          ? `Failed to send email: ${emailResult.error}`
          : 'Email service not configured',
      email_sent: emailResult.success,
      recipient: recipientEmail,
      order_id: orderId,
      message_id: emailResult.messageId,
      error: emailResult.error,
    };
  }
}
