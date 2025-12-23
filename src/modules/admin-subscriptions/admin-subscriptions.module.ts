import { Module } from '@nestjs/common';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';

@Module({
  imports: [],
  controllers: [AdminSubscriptionsController],
  providers: [AdminSubscriptionsService, SubscriptionSchedulerService],
  exports: [AdminSubscriptionsService, SubscriptionSchedulerService],
})
export class AdminSubscriptionsModule {}
