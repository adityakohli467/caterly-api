import { Module } from '@nestjs/common';
import { StoreBlogsController } from './store-blogs.controller';
import { AdminBlogsModule } from '../admin-blogs/admin-blogs.module';

@Module({
  imports: [AdminBlogsModule],
  controllers: [StoreBlogsController],
})
export class StoreBlogsModule {}

