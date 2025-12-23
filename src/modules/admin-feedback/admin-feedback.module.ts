import { Module } from '@nestjs/common';
import { AdminFeedbackController } from './admin-feedback.controller';
import { AdminFeedbackService } from './admin-feedback.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminFeedbackController],
  providers: [AdminFeedbackService],
  exports: [AdminFeedbackService],
})
export class AdminFeedbackModule {}
