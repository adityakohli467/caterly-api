import { Module } from '@nestjs/common';
import { AdminCateringController } from './admin-catering.controller';
import { AdminCateringService } from './admin-catering.service';

@Module({
  imports: [],
  controllers: [AdminCateringController],
  providers: [AdminCateringService],
  exports: [AdminCateringService],
})
export class AdminCateringModule {}
