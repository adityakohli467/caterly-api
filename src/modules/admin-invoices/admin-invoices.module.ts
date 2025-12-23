import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminInvoicesController } from './admin-invoices.controller';
import { AdminInvoicesService } from './admin-invoices.service';
import { CommonModule } from '../../common/common.module';
import { Order } from '../../entities/Order';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), CommonModule],
  controllers: [AdminInvoicesController],
  providers: [AdminInvoicesService],
  exports: [AdminInvoicesService],
})
export class AdminInvoicesModule {}
