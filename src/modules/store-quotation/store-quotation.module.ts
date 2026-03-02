import { Module } from '@nestjs/common';
import { StoreQuotationService } from './store-quotation.service';
import { StoreQuotationController } from './store-quotation.controller';
import { CommonModule } from '../../common/common.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [
        CommonModule,
        AdminNotificationsModule,
        ConfigModule,
    ],
    controllers: [StoreQuotationController],
    providers: [StoreQuotationService],
    exports: [StoreQuotationService],
})
export class StoreQuotationModule { }
