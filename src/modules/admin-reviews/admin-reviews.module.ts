import { Module } from '@nestjs/common';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminReviewsService } from './admin-reviews.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminReviewsController],
  providers: [AdminReviewsService],
  exports: [AdminReviewsService],
})
export class AdminReviewsModule {}

