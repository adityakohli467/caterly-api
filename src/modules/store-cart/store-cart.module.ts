import { Module } from '@nestjs/common';
import { StoreCartController } from './store-cart.controller';
import { StoreCartService } from './store-cart.service';

@Module({
  imports: [],
  controllers: [StoreCartController],
  providers: [StoreCartService],
  exports: [StoreCartService],
})
export class StoreCartModule {}
