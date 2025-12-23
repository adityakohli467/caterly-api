import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoreCartService } from './store-cart.service';

@ApiTags('Store Cart')
@Controller('store/cart')
export class StoreCartController {
  constructor(private readonly storeCartService: StoreCartService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add item to cart (validation endpoint)' })
  async addToCart(
    @Body() data: {
      product_id: number;
      quantity?: number;
      options?: any[];
    },
  ) {
    return this.storeCartService.addToCart(data);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate entire cart before checkout' })
  async validateCart(
    @Body() data: {
      items: any[];
      coupon_code?: string;
    },
  ) {
    return this.storeCartService.validateCart(data);
  }
}
