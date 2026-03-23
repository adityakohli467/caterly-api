import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Logger,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StoreOrdersService } from './store-orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminUploadService } from '../admin-upload/admin-upload.service';

@ApiTags('Store Orders')
@Controller('store/orders')
export class StoreOrdersController {
  private readonly logger = new Logger(StoreOrdersController.name);

  constructor(
    private readonly storeOrdersService: StoreOrdersService,
    private readonly adminUploadService: AdminUploadService,
  ) { }

  @Get(':id/invoice/view')
  @ApiOperation({ summary: 'View invoice (redirects to frontend)' })
  async viewInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Query('auth') auth: string,
    @Res() res: Response,
  ) {
    const verified = await this.storeOrdersService.verifyInvoiceToken(id, auth);
    if (!verified) {
      throw new UnauthorizedException('Invalid invoice token');
    }

    const frontendUrl = process.env.STORE_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/orders/${id}/invoice?auth=${auth}`);
  }

  @Get(':id/invoice/pdf')
  @ApiOperation({ summary: 'Get invoice PDF (public with token)' })
  async getInvoicePdf(
    @Param('id', ParseIntPipe) id: number,
    @Query('auth') auth: string,
    @Res() res: Response,
  ) {
    const verified = await this.storeOrdersService.verifyInvoiceToken(id, auth);
    if (!verified) {
      throw new UnauthorizedException('Invalid invoice token');
    }

    // Logic to serve PDF - we can get it via StoreOrdersService if we add a method there
    // or use InvoiceService directly if we inject it here.
    // Let's assume we can get it from the service.
    const pdfBuffer = await this.storeOrdersService.getInvoicePdf(id);
    const filename = `invoice-${id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create order (checkout)' })
  async createOrder(
    @Request() req: any,
    @Body() orderData: any,
  ) {
    try {
      this.logger.debug(`Creating order for user: ${req.user?.user_id || 'Guest'}`);
      const userId = req.user?.user_id || null;
      return await this.storeOrdersService.createOrder(userId, orderData);
    } catch (error) {
      this.logger.error('Order creation error in controller:', error);
      throw error;
    }
  }

  @Post('guest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create guest order' })
  async createGuestOrder(
    @Body() orderData: any,
  ) {
    return this.storeOrdersService.createOrder(null, orderData);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer orders' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listOrders(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.storeOrdersService.listOrders(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('guest/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get single guest order details (public)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'auth', required: false, type: String })
  async getGuestOrder(
    @Param('id', ParseIntPipe) id: number,
    @Query('auth') auth?: string,
  ) {
    return this.storeOrdersService.getGuestOrder(id, auth);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single order details' })
  @ApiParam({ name: 'id', type: Number })
  async getOrder(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new BadRequestException('Unauthorized');
    }
    return this.storeOrdersService.getOrder(userId, id);
  }

  @Post(':id/upload-image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload order image (delivery notes)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('image', 1))
  async uploadOrderImage(
    @Request() req: any,
    @Param('id', ParseIntPipe) orderId: number,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const userId = req.user?.user_id || null;

    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify that the order belongs to the user (if user is logged in)
    if (userId) {
      const order = await this.storeOrdersService.getOrder(userId, orderId);
      if (!order) {
        throw new BadRequestException('Order not found or access denied');
      }
    }

    return this.adminUploadService.uploadOrderImage(files, orderId);
  }
}
