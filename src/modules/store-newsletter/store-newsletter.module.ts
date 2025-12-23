import { Module } from '@nestjs/common';
import { StoreNewsletterController } from './store-newsletter.controller';
import { StoreNewsletterService } from './store-newsletter.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StoreNewsletterController],
  providers: [StoreNewsletterService],
  exports: [StoreNewsletterService],
})
export class StoreNewsletterModule {}

