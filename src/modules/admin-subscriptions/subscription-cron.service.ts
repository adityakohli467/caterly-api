import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionSchedulerService } from './subscription-scheduler.service';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(private schedulerService: SubscriptionSchedulerService) {}

  /**
   * Generate future orders for all active subscriptions
   * Runs daily at 2:00 AM
   */
  @Cron('0 2 * * *', {
    name: 'generate-future-orders',
    timeZone: 'Australia/Sydney',
  })
  async handleGenerateFutureOrders() {
    this.logger.log('Starting scheduled task: Generate future orders for subscriptions');
    
    try {
      const result = await this.schedulerService.generateFutureOrders();
      this.logger.log(`Successfully generated future orders for ${result.generated} subscriptions`);
    } catch (error) {
      this.logger.error('Error in scheduled task: Generate future orders', error);
    }
  }

  /**
   * Process all future orders that are due today
   * Runs daily at 3:00 AM (after generating future orders)
   */
  @Cron('0 3 * * *', {
    name: 'process-due-future-orders',
    timeZone: 'Australia/Sydney',
  })
  async handleProcessDueFutureOrders() {
    this.logger.log('Starting scheduled task: Process due future orders');
    
    try {
      const result = await this.schedulerService.processDueFutureOrders();
      this.logger.log(
        `Successfully processed ${result.processed} future orders, ${result.errors} errors, ${result.total} total due`,
      );
    } catch (error) {
      this.logger.error('Error in scheduled task: Process due future orders', error);
    }
  }
}

