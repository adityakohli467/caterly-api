import { Module } from '@nestjs/common';
import { StoreQuotesController } from './store-quotes.controller';
import { StoreQuotesService } from './store-quotes.service';

@Module({
  imports: [],
  controllers: [StoreQuotesController],
  providers: [StoreQuotesService],
  exports: [StoreQuotesService],
})
export class StoreQuotesModule {}

