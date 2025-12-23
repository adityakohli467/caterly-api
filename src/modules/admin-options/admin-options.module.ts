import { Module } from '@nestjs/common';
import { AdminOptionsController } from './admin-options.controller';
import { AdminOptionsService } from './admin-options.service';

@Module({
  imports: [],
  controllers: [AdminOptionsController],
  providers: [AdminOptionsService],
  exports: [AdminOptionsService],
})
export class AdminOptionsModule {}
