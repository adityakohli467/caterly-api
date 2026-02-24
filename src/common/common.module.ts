import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { S3Service } from './services/s3.service';
import { InvoiceService } from './services/invoice.service';
import { StripeService } from './services/stripe.service';
import { PricingService } from './services/pricing.service';
import { PinPaymentsService } from './services/pinpayments.service';
import { Order } from '../entities/Order';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Order])],
  providers: [EmailService, NotificationService, S3Service, InvoiceService, StripeService, PricingService, PinPaymentsService],
  exports: [EmailService, NotificationService, S3Service, InvoiceService, StripeService, PricingService, PinPaymentsService],
})
export class CommonModule { }
