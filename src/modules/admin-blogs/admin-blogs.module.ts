import { Module } from '@nestjs/common';
import { AdminBlogsController } from './admin-blogs.controller';
import { AdminBlogsService } from './admin-blogs.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminBlogsController],
  providers: [AdminBlogsService],
  exports: [AdminBlogsService],
})
export class AdminBlogsModule {}

