import { Module } from '@nestjs/common';
import { AdminEmailConfigController } from './admin-email-config.controller';
import { AdminEmailConfigService } from './admin-email-config.service';
import { NotificationService } from '../../common/services/notification.service';
import { EmailService } from '../../common/services/email.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminEmailConfigController],
  providers: [AdminEmailConfigService, NotificationService],
  exports: [AdminEmailConfigService, NotificationService],
})
export class AdminEmailConfigModule {}

