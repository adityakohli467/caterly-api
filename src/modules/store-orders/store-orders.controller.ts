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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StoreOrdersService } from './store-orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminUploadService } from '../admin-upload/admin-upload.service';

@ApiTags('Store Orders')
@Controller('store/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoreOrdersController {
  constructor(
    private readonly storeOrdersService: StoreOrdersService,
    private readonly adminUploadService: AdminUploadService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create order (checkout)' })
  async createOrder(
    @Request() req: any,
    @Body() orderData: {
      items: any[];
      delivery_address: string;
      delivery_date?: string;
      delivery_time?: string;
      delivery_fee?: number;
      payment_method?: string;
      notes?: string;
      coupon_code?: string;
      postcode?: string;
    },
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeOrdersService.createOrder(userId, orderData);
  }

  @Get()
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
      throw new Error('Unauthorized');
    }
    return this.storeOrdersService.listOrders(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order details' })
  @ApiParam({ name: 'id', type: Number })
  async getOrder(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
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
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify that the order belongs to the user
    const order = await this.storeOrdersService.getOrder(userId, orderId);
    if (!order) {
      throw new BadRequestException('Order not found or access denied');
    }

    return this.adminUploadService.uploadOrderImage(files, orderId);
  }
}
