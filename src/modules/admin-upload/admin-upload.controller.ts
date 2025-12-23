import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AdminUploadService } from './admin-upload.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CommonModule } from '../../common/common.module';

@ApiTags('Admin Upload')
@Controller('admin/upload')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminUploadController {
  constructor(private adminUploadService: AdminUploadService) {}

  @Post('product-image')
  @ApiOperation({ summary: 'Upload single product image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('image', 1))
  async uploadSingleProductImage(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { product_id?: string },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    const productId = body.product_id ? parseInt(body.product_id) : undefined;
    return this.adminUploadService.uploadProductImages(files, productId);
  }

  @Post('product-images')
  @ApiOperation({ summary: 'Upload multiple product images (max 10)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadMultipleProductImages(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { product_id?: string },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    const productId = body.product_id ? parseInt(body.product_id) : undefined;
    return this.adminUploadService.uploadProductImages(files, productId);
  }

  @Post('order-image')
  @ApiOperation({ summary: 'Upload order image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('image', 1))
  async uploadOrderImage(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: { order_id: string },
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    if (!body.order_id) {
      throw new BadRequestException('Order ID is required');
    }
    const orderId = parseInt(body.order_id);
    return this.adminUploadService.uploadOrderImage(files, orderId);
  }
}
