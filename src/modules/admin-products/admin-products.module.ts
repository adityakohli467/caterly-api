import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AdminProductsController],
  providers: [AdminProductsService],
  exports: [AdminProductsService],
})
export class AdminProductsModule {}
