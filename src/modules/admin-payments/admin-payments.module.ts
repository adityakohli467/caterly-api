import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminPaymentsController],
  providers: [AdminPaymentsService],
  exports: [AdminPaymentsService],
})
export class AdminPaymentsModule {}
