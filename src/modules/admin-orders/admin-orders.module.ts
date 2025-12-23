import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { Order } from '../../entities/Order';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), CommonModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
