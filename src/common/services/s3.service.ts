import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-2';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('⚠️  WARNING: AWS credentials not found in environment variables!');
    }

    this.s3Client = new S3Client({
      region: region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      } : undefined,
    });

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'caterly-uploads-unique-id';

    this.logger.log('S3 Configuration:', {
      region: region,
      bucket: this.bucketName,
      hasCredentials: !!(accessKeyId && secretAccessKey),
    });
  }

  /**
   * Upload a file to S3
   */
  async uploadToS3(
    file: Buffer,
    folder: string,
    fileName?: string,
    contentType: string = 'application/octet-stream',
  ): Promise<UploadResult> {
    try {
      const fileExtension = fileName ? path.extname(fileName) : '';
      const key = fileName ? `${folder}/${fileName}` : `${folder}/${crypto.randomUUID()}${fileExtension}`;

      // Try to upload with public-read ACL, fallback if ACLs are disabled
      let command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        ACL: 'public-read', // Make images publicly accessible
      });

      try {
        await this.s3Client.send(command);
      } catch (aclError: any) {
        // If ACL fails (bucket might have ACLs disabled), retry without ACL
        if (aclError.name === 'AccessControlListNotSupported' || aclError.message?.includes('ACL')) {
          this.logger.warn(`ACL not supported for bucket ${this.bucketName}, uploading without ACL`);
          command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file,
            ContentType: contentType,
          });
          await this.s3Client.send(command);
        } else {
          throw aclError;
        }
      }

      // Construct the public URL
      const region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-2';
      const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

      return {
        url: url,
        key: key,
        bucket: this.bucketName,
      };
    } catch (error) {
      this.logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a product image to S3
   */
  async uploadProductImage(file: Buffer, productId: number, originalFileName: string): Promise<UploadResult> {
    const fileExtension = path.extname(originalFileName);
    const fileName = `product-${productId}-${Date.now()}${fileExtension}`;

    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    return this.uploadToS3(file, 'zenn_assets', fileName, contentType);
  }

  /**
   * Upload an invoice PDF to S3
   */
  async uploadInvoice(pdfBuffer: Buffer, orderId: number): Promise<UploadResult> {
    const fileName = `invoice-${orderId}-${Date.now()}.pdf`;
    return this.uploadToS3(pdfBuffer, 'invoices', fileName, 'application/pdf');
  }

  /**
   * Upload an order image to S3
   */
  async uploadOrderImage(file: Buffer, orderId: number, originalFileName: string): Promise<UploadResult> {
    const fileExtension = path.extname(originalFileName);
    const fileName = `order-${orderId}-${Date.now()}${fileExtension}`;

    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    return this.uploadToS3(file, 'order_images', fileName, contentType);
  }

  /**
   * Delete a file from S3
   */
  async deleteFromS3(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error('S3 delete error:', error);
      return false;
    }
  }

  /**
   * Get a signed URL for temporary access to a private file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('S3 signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
