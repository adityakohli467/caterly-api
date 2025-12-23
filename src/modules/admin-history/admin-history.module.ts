import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminHistoryController } from './admin-history.controller';
import { AdminHistoryService } from './admin-history.service';
import { ApiHistory } from '../../entities/ApiHistory.entity';
import { CommonModule } from '../../common/common.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiHistory]), 
    CommonModule,
    DatabaseModule, // Import DatabaseModule to get DataSource
  ],
  controllers: [AdminHistoryController],
  providers: [AdminHistoryService],
  exports: [AdminHistoryService],
})
export class AdminHistoryModule {}

