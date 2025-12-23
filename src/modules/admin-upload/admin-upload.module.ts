import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUploadController } from './admin-upload.controller';
import { AdminUploadService } from './admin-upload.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule, TypeOrmModule.forFeature([])],
  controllers: [AdminUploadController],
  providers: [AdminUploadService],
  exports: [AdminUploadService],
})
export class AdminUploadModule {}
