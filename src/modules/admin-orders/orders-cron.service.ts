import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminOrdersService } from './admin-orders.service';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  /**
   * Automatically complete orders whose delivery date/time has passed.
   * Runs every hour so statuses stay up to date even when the dashboard is not open.
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'auto-complete-past-delivery-orders',
    timeZone: 'Australia/Sydney',
  })
  async handleAutoCompletePastDeliveryOrders() {
    try {
      const count = await this.adminOrdersService.autoCompletePastDeliveryOrders();
      if (count > 0) {
        this.logger.log(`Scheduled task auto-completed ${count} past-delivery order(s)`);
      }
    } catch (error) {
      this.logger.error('Error in scheduled task: Auto-complete past-delivery orders', error);
    }
  }
}
