import { Module } from '@nestjs/common';
import { StoreQuotesController } from './store-quotes.controller';
import { StoreQuotesService } from './store-quotes.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StoreQuotesController],
  providers: [StoreQuotesService],
  exports: [StoreQuotesService],
})
export class StoreQuotesModule {}

