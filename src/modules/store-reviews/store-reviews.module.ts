import { Module } from '@nestjs/common';
import { StoreReviewsController } from './store-reviews.controller';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StoreReviewsController],
})
export class StoreReviewsModule {}

