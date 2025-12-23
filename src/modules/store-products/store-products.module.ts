import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { StoreProductsController } from './store-products.controller';
import { StoreProductsService } from './store-products.service';

@Module({
  imports: [
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'supersecret',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [StoreProductsController],
  providers: [StoreProductsService],
  exports: [StoreProductsService],
})
export class StoreProductsModule {}
