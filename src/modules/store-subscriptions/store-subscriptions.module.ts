import { Module } from '@nestjs/common';
import { StoreSubscriptionsController } from './store-subscriptions.controller';
import { StoreSubscriptionsService } from './store-subscriptions.service';

@Module({
  imports: [],
  controllers: [StoreSubscriptionsController],
  providers: [StoreSubscriptionsService],
  exports: [StoreSubscriptionsService],
})
export class StoreSubscriptionsModule {}
