import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private storageDirName: string = 'local-uploads';
  private uploadsDir: string;
  private backendUrl: string;

  constructor(private configService: ConfigService) {
    // Determine backend URL for serving files using static paths
    this.backendUrl = this.configService.get<string>('BACKEND_URL') || `http://localhost:${this.configService.get<string>('PORT') || 9000}`;
    
    // Set up local uploads directory
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    
    this.logger.log(`Local storage configured. Saving to: ${this.uploadsDir}`);
  }

  /**
   * Upload a file to local storage
   */
  async uploadFile(
    file: Buffer,
    folder: string,
    fileName?: string,
    contentType: string = 'application/octet-stream',
  ): Promise<UploadResult> {
    try {
      const fileExtension = fileName ? path.extname(fileName) : '';
      const finalFileName = fileName || `${crypto.randomUUID()}${fileExtension}`;
      const folderPath = path.join(this.uploadsDir, folder);
      
      // Ensure folder exists
      if (!fs.existsSync(folderPath)) {
        await fs.promises.mkdir(folderPath, { recursive: true });
      }

      const filePath = path.join(folderPath, finalFileName);
      const key = `${folder}/${finalFileName}`;
      
      await fs.promises.writeFile(filePath, file);

      // Construct the public URL
      const url = `${this.backendUrl}/uploads/${key}`;

      return {
        url,
        key: key,
        bucket: this.storageDirName,
      };
    } catch (error) {
      this.logger.error('Local upload error:', error);
      throw new Error(`Failed to upload file locally: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a product image locally
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

    return this.uploadFile(file, 'caterly_assets', fileName, contentType);
  }

  /**
   * Upload an invoice PDF locally
   */
  async uploadInvoice(pdfBuffer: Buffer, orderId: number): Promise<UploadResult> {
    const fileName = `invoice-${orderId}-${Date.now()}.pdf`;
    return this.uploadFile(pdfBuffer, 'invoices', fileName, 'application/pdf');
  }

  /**
   * Upload an order image locally
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

    return this.uploadFile(file, 'order_images', fileName, contentType);
  }

  /**
   * Delete a file locally
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadsDir, key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Local delete error:', error);
      return false;
    }
  }

  /**
   * Get a local public URL acting as signed URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Return public URL directly since all files are served statically
      return `${this.backendUrl}/uploads/${key}`;
    } catch (error) {
      this.logger.error('Signed URL generation error:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
