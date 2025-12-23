import { Module } from '@nestjs/common';
import { AdminQuotesController } from './admin-quotes.controller';
import { AdminQuotesService } from './admin-quotes.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminQuotesController],
  providers: [AdminQuotesService],
  exports: [AdminQuotesService],
})
export class AdminQuotesModule {}
