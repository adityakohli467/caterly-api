/**
 * Notification Integration Examples
 * 
 * This file documents how to integrate notifications into various services.
 * Copy and adapt these examples to your specific service needs.
 */

import { NotificationService } from './notification.service';
import { InvoiceService } from './invoice.service';

/**
 * Example: Customer Registration Notification
 */
export async function sendCustomerRegistrationNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'customer_registration',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      email: customerEmail,
    },
  });
}

/**
 * Example: Wholesale Registration Notification
 */
export async function sendWholesaleRegistrationNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
  approved: boolean,
) {
  return await notificationService.sendNotification({
    templateKey: 'wholesale_registration',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      status: approved ? 'approved' : 'rejected',
      approved: approved,
    },
  });
}

/**
 * Example: Wholesale Enquiry Notification (to admin)
 */
export async function sendWholesaleEnquiryNotification(
  notificationService: NotificationService,
  adminEmail: string,
  enquirerName: string,
  enquirerEmail: string,
  enquirerPhone: string,
  message: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'wholesale_enquiry',
    recipientEmail: adminEmail,
    variables: {
      enquirer_name: enquirerName,
      enquirer_email: enquirerEmail,
      enquirer_phone: enquirerPhone,
      message: message,
    },
  });
}

/**
 * Example: Customer Enquiry Notification
 */
export async function sendCustomerEnquiryNotification(
  notificationService: NotificationService,
  adminEmail: string,
  customerName: string,
  customerEmail: string,
  subject: string,
  message: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'customer_enquiry',
    recipientEmail: adminEmail,
    variables: {
      customer_name: customerName,
      customer_email: customerEmail,
      subject: subject,
      message: message,
    },
  });
}

/**
 * Example: Forgot Password Notification
 */
export async function sendForgotPasswordNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
  resetLink: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'forgot_password',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      reset_link: resetLink,
    },
  });
}

/**
 * Example: Invoice Paid in Full Notification
 */
export async function sendInvoicePaidFullNotification(
  notificationService: NotificationService,
  invoiceService: InvoiceService,
  orderId: number,
  customerEmail: string,
  customerName: string,
) {
  // Generate PDF
  const pdfBuffer = await invoiceService.generatePDFBuffer(orderId);

  return await notificationService.sendNotification({
    templateKey: 'invoice_paid_full',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      invoice_number: orderId.toString(),
      amount_paid: '0.00', // Will be replaced with actual amount from order
    },
    attachments: [
      {
        filename: `invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/**
 * Example: Invoice with Balance Notification
 */
export async function sendInvoiceBalanceNotification(
  notificationService: NotificationService,
  invoiceService: InvoiceService,
  orderId: number,
  customerEmail: string,
  customerName: string,
  totalAmount: number,
  amountPaid: number,
  balance: number,
) {
  // Generate PDF
  const pdfBuffer = await invoiceService.generatePDFBuffer(orderId);

  return await notificationService.sendNotification({
    templateKey: 'invoice_balance',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      invoice_number: orderId.toString(),
      total_amount: totalAmount.toFixed(2),
      amount_paid: amountPaid.toFixed(2),
      balance: balance.toFixed(2),
    },
    attachments: [
      {
        filename: `invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/**
 * Example: Subscription Notification
 */
export async function sendSubscriptionNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
  orderId: number,
  nextDeliveryDate: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'subscription',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      order_id: orderId.toString(),
      next_delivery_date: nextDeliveryDate,
    },
  });
}

/**
 * Example: Send Quote Notification
 */
export async function sendQuoteNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
  quoteId: number,
  totalAmount: number,
  quotePdfBuffer?: Buffer,
) {
  const attachments = quotePdfBuffer ? [
    {
      filename: `quote-${quoteId}.pdf`,
      content: quotePdfBuffer,
      contentType: 'application/pdf',
    },
  ] : undefined;

  return await notificationService.sendNotification({
    templateKey: 'send_quote',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      quote_id: quoteId.toString(),
      total_amount: totalAmount.toFixed(2),
    },
    attachments,
  });
}

/**
 * Example: Send Invoice Notification
 */
export async function sendInvoiceNotification(
  notificationService: NotificationService,
  invoiceService: InvoiceService,
  orderId: number,
  customerEmail: string,
  customerName: string,
  totalAmount: number,
) {
  // Generate PDF
  const pdfBuffer = await invoiceService.generatePDFBuffer(orderId);

  return await notificationService.sendNotification({
    templateKey: 'send_invoice',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      invoice_number: orderId.toString(),
      total_amount: totalAmount.toFixed(2),
    },
    attachments: [
      {
        filename: `invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/**
 * Example: Send Payment Link Notification
 */
export async function sendPaymentLinkNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
  invoiceNumber: number,
  amountDue: number,
  paymentLink: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'send_payment_link',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
      invoice_number: invoiceNumber.toString(),
      amount_due: amountDue.toFixed(2),
      payment_link: paymentLink,
    },
  });
}

/**
 * Example: Customer Feedback Notification
 */
export async function sendCustomerFeedbackNotification(
  notificationService: NotificationService,
  customerEmail: string,
  customerName: string,
) {
  return await notificationService.sendNotification({
    templateKey: 'customer_feedback',
    recipientEmail: customerEmail,
    recipientName: customerName,
    variables: {
      customer_name: customerName,
    },
  });
}

