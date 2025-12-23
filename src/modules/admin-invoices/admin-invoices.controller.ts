import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Res,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AdminInvoicesService } from './admin-invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Invoices')
@Controller('admin/invoices')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminInvoicesController {
  constructor(private adminInvoicesService: AdminInvoicesService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate invoice PDF and upload to S3' })
  @ApiBody({ schema: { type: 'object', properties: { order_id: { type: 'number' } }, required: ['order_id'] } })
  async generateInvoice(@Body() body: { order_id?: number }) {
    if (!body || typeof body !== 'object' || body.order_id === undefined || body.order_id === null) {
      throw new BadRequestException('Order ID is required');
    }
    const url = await this.adminInvoicesService.generateInvoice(body.order_id);
    return {
      success: true,
      url,
      message: 'Invoice generated successfully',
    };
  }

  @Get(':order_id')
  @ApiOperation({ summary: 'Get invoice URL from S3' })
  async getInvoiceUrl(@Param('order_id', ParseIntPipe) orderId: number) {
    const url = await this.adminInvoicesService.getInvoiceUrl(orderId);
    return {
      success: true,
      url,
    };
  }

  @Get(':order_id/download')
  @ApiOperation({ summary: 'Download invoice PDF' })
  async downloadInvoice(@Param('order_id', ParseIntPipe) orderId: number, @Res() res: Response) {
    const pdfBuffer = await this.adminInvoicesService.getInvoicePDF(orderId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${orderId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(pdfBuffer);
  }

  @Post(':order_id/send')
  @ApiOperation({ summary: 'Send invoice email to customer with PDF attachment' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        custom_message: { type: 'string', description: 'Optional custom message to include in email' },
      },
    },
    required: false,
  })
  async sendInvoiceEmail(
    @Param('order_id', ParseIntPipe) orderId: number,
    @Body() body: { custom_message?: string },
  ) {
    return this.adminInvoicesService.sendInvoiceEmail(orderId, body.custom_message);
  }
}
