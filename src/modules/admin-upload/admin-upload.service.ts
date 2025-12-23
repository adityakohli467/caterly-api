import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { S3Service } from '../../common/services/s3.service';

@Injectable()
export class AdminUploadService {
  private readonly logger = new Logger(AdminUploadService.name);

  constructor(
    private s3Service: S3Service,
    private dataSource: DataSource,
  ) {}

  async uploadProductImages(files: Express.Multer.File[], productId?: number): Promise<any> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const productIdFinal = productId || Date.now();
    const uploadedImages: Array<{
      url: string;
      key: string;
      bucket: string;
      originalName: string;
    }> = [];

    for (const file of files) {
      try {
        const result = await this.s3Service.uploadProductImage(
          file.buffer,
          productIdFinal,
          file.originalname,
        );

        uploadedImages.push({
          url: result.url,
          key: result.key,
          bucket: result.bucket,
          originalName: file.originalname,
        });
      } catch (error) {
        this.logger.error(`Failed to upload ${file.originalname}:`, error);
        // Continue with other files even if one fails
      }
    }

    if (uploadedImages.length === 0) {
      throw new BadRequestException('Failed to upload any images');
    }

    return {
      success: true,
      images: uploadedImages,
      count: uploadedImages.length,
    };
  }

  async uploadOrderImage(files: Express.Multer.File[], orderId: number): Promise<any> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }

    if (files.length > 1) {
      throw new BadRequestException('Only one image can be uploaded at a time');
    }

    const file = files[0];
    const result = await this.s3Service.uploadOrderImage(
      file.buffer,
      orderId,
      file.originalname,
    );

    // Update order_image column in orders table
    try {
      await this.dataSource.query(
        `UPDATE orders SET order_image = $1 WHERE order_id = $2`,
        [result.url, orderId],
      );

      // Also insert into order_images table for multiple images support
      await this.dataSource.query(
        `INSERT INTO order_images (order_id, order_image) VALUES ($1, $2)`,
        [orderId, result.url],
      );
    } catch (error) {
      this.logger.error(`Failed to update order image in database:`, error);
      // Don't fail the upload if database update fails
    }

    return {
      success: true,
      image: {
        url: result.url,
        key: result.key,
        bucket: result.bucket,
        originalName: file.originalname,
      },
    };
  }
}
