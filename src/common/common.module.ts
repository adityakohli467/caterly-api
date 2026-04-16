import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { FileUploadService } from './services/file-upload.service';
import { InvoiceService } from './services/invoice.service';
import { StripeService } from './services/stripe.service';
import { PricingService } from './services/pricing.service';
import { PinPaymentsService } from './services/pinpayments.service';
import { FatZebraService } from './services/fatzebra.service';
import { Order } from '../entities/Order';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order])],
  providers: [EmailService, NotificationService, FileUploadService, InvoiceService, StripeService, PricingService, PinPaymentsService, FatZebraService],
  exports: [EmailService, NotificationService, FileUploadService, InvoiceService, StripeService, PricingService, PinPaymentsService, FatZebraService],
})
export class CommonModule { }
